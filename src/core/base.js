/**
 * @fileoverview Main engine of the library. Equivalent to YTMusicBase in Python.
 */
import fs from 'fs';
import {
    YTM_DOMAIN,
    YTM_BASE_API,
    YTM_PARAMS,
    YTM_PARAMS_KEY,
    SUPPORTED_LANGUAGES,
    SUPPORTED_LOCATIONS,
    USER_AGENT
} from './constants.js';

import { OAuthCredentials } from '../auth/oauth/credentials.js';
import { AuthType } from '../auth/types.js';
import { parseAuth, parseAuthSync, determineAuthType } from '../auth/parser.js';
import { getSapisidFromCookie, generateAuthorization } from '../auth/crypto.js';
import { RefreshingToken } from '../auth/oauth/token.js';
import { I18n } from './i18n.js';
import { getVisitorId } from './utils.js';

export class YTMusicBase {
    /**
     * Client base initialization.
     * @param {Object} options 
     * @param {string|Object} [options.auth=null] - Raw auth string, path to JSON, or dictionary.
     * @param {Object} [options.oauthCredentials=null] - Required if using OAuth custom client.
     * @param {string} [options.language="en"] - Language for the results.
     * @param {string} [options.location=""] - Location (e.g., "ES").
     */
    constructor({ auth = null, oauthCredentials = null, language = "en", location = "" } = {}) {
        this.language = String(language).toLowerCase();
        this.location = String(location).toUpperCase();
        this.i18n = new I18n(this.language);

        if (this.location && !SUPPORTED_LOCATIONS.has(this.location)) {
            throw new Error("[YTM-JS] Location not supported. Check the FAQ for supported locations.");
        }

        if (!SUPPORTED_LANGUAGES.has(this.language)) {
            throw new Error(`[YTM-JS] Language not supported. Supported languages are: ${Array.from(SUPPORTED_LANGUAGES).join(', ')}.`);
        }

        // Initial state
        this.cookies = "SOCS=CAI;"; // Mandatory Google cookie (consent)
        this.params = YTM_PARAMS;

        // Auth state
        this.authType = AuthType.UNAUTHORIZED;
        this.authHeaders = {};
        this.sapisid = null;
        this.origin = null;
        this.token = null;
        this.visitorId = null; // Cache for X-Goog-Visitor-Id

        this._initializeContext();

        // Inicializar autenticación de forma síncrona si se proporciona
        // this.setupAuth(auth, oauthCredentials);
        this.setupAuthSync(auth, oauthCredentials);
    }



    /**
     * Asynchronously configures the authentication state for the client.
     * @param {string|Object} authParam - Raw auth string, path to JSON, or dictionary.
     * @param {import('../auth/oauth/credentials.js').OAuthCredentials} [oauthCredentials=null] - Required if using OAuth custom client.
     * @returns {Promise<void>}
     */
    async setupAuth(authParam, oauthCredentials = null) {
        if (!authParam) return;

        const { headers, authPath } = await parseAuth(authParam);
        this.authHeaders = headers;
        this.authType = determineAuthType(headers);

        if (this.authType === AuthType.BROWSER) {
            this.params += YTM_PARAMS_KEY;
            this.cookies = this.authHeaders['cookie'] || this.cookies;
            this.sapisid = getSapisidFromCookie(this.cookies);
            this.origin = this.authHeaders['origin'] || this.authHeaders['x-origin'] || YTM_DOMAIN;

            if (!this.sapisid) {
                throw new Error("[YTM-JS Error] Your cookie is missing the required value __Secure-3PAPISID");
            }
        } else if (this.authType === AuthType.OAUTH_CUSTOM_CLIENT) {
            if (!oauthCredentials) {
                throw new Error("[YTM-JS Error] OAuth JSON provided, but oauthCredentials not provided.");
            }

            this.token = new RefreshingToken({
                ...this.authHeaders,
                credentials: oauthCredentials,
                localCache: authPath
            });
        }
    }

    /**
     * Configures the authentication state synchronously during construction.
     * @private
     */
    setupAuthSync(authParam, oauthCredentials = null) {
        let headers = {};
        let authPath = null;

        if (!authParam) return;

        if (typeof authParam === 'string') {
            try {
                // Comprobar si es una ruta de archivo existente
                if (fs.existsSync(authParam)) {
                    authPath = authParam;
                    const rawData = fs.readFileSync(authParam, 'utf8');
                    headers = JSON.parse(rawData);
                } else {
                    // Si es una cadena JSON directa
                    headers = JSON.parse(authParam);
                }
            } catch (e) {
                // Si falla el parseo como JSON, tratamos de parsearlo como cabeceras de texto plano (cookies)
                ({ headers, authPath } = parseAuthSync(authParam));
            }
        } else if (typeof authParam === 'object') {
            headers = authParam;
        }

        this.authHeaders = headers;
        this.authType = determineAuthType(headers);

        if (this.authType === AuthType.BROWSER) {
            this.params += YTM_PARAMS_KEY;
            this.cookies = this.authHeaders['cookie'] || this.cookies;
            this.sapisid = getSapisidFromCookie(this.cookies);
            this.origin = this.authHeaders['origin'] || this.authHeaders['x-origin'] || YTM_DOMAIN;

            if (!this.sapisid) {
                throw new Error("[YTM-JS Error] Your cookie is missing the required value __Secure-3PAPISID");
            }
        } else if (this.authType === AuthType.OAUTH_CUSTOM_CLIENT) {
            if (!oauthCredentials) {
                throw new Error("[YTM-JS Error] OAuth JSON provided, but oauthCredentials not provided.");
            }

            // Token refrescable de OAuth
            // Si el usuario no pasó oauthCredentials explícitamente, pero el oauth.json ya trae las credenciales del cliente:
            const credentialsInstance = oauthCredentials instanceof OAuthCredentials
                ? oauthCredentials
                : new OAuthCredentials(
                    this.authHeaders.client_id || oauthCredentials?.clientId,
                    this.authHeaders.client_secret || oauthCredentials?.clientSecret
                );

            this.token = new RefreshingToken({
                ...this.authHeaders,
                credentials: credentialsInstance,
                localCache: authPath
            });
        }
    }

    /**
     * Loads the language JSON into memory.
     * Since the constructor cannot be async, we call this method just before making the first request that requires translations.
     */
    async setupI18n() {
        await this.i18n.setup();
    }

    /**
     * Short helper to translate texts (identical to Python's _("text")).
     * Modules will use it like this: this._("Songs")
     * @param {string} text - The original text in English.
     * @returns {string} The translated text.
     */
    _(text) {
        return this.i18n.getTranslation(text);
    }

    /**
     * Prepares the context object (`context`) that Google requires in the body of POST requests.
     * @private
     */
    _initializeContext() {
        this.context = {
            context: {
                client: {
                    clientName: "WEB_REMIX",
                    clientVersion: "1.20260601.01.00",
                    hl: this.language,
                    gl: this.location,
                },
                user: {}
            }
        };

        if (this.location) {
            this.context.context.client.gl = this.location;
        }
    }

    /**
     * Equivalent in JS to the Python context manager `with yt.as_mobile():`.
     * Temporarily switches the client to ANDROID_MUSIC, executes the function, and restores the original context.
     * @param {Function} callback - Asynchronous function to execute under the mobile context.
     * @returns {Promise<any>} The result of the callback.
     */
    async withMobileContext(callback) {
        const originalClient = { ...this.context.context.client };

        this.context.context.client.clientName = "ANDROID_MUSIC";
        this.context.context.client.clientVersion = "7.21.50";

        try {
            return await callback();
        } finally {
            this.context.context.client = originalClient;
        }
    }

    /**
     * Generates the base HTTP headers synchronously.
     * @returns {Object}
     * @private
     */
    get _baseHeaders() {
        const headers = {
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Content-Type": "application/json",
            "Origin": YTM_DOMAIN,
            "Cookie": this.cookies
        };

        // Inject saved auth headers (like x-goog-authuser) if logged in via browser or full OAuth
        if (this.authType === AuthType.BROWSER || this.authType === AuthType.OAUTH_CUSTOM_FULL) {
            return { ...this.authHeaders, ...headers };
        }

        return headers;
    }

    /**
     * Generates the final headers, dynamically computing async authorizations.
     * @returns {Promise<Object>}
     * @private
     */
    async _getHeaders() {
        if (this.language !== 'en' && Object.keys(this.i18n.translations).length === 0) {
            await this.setupI18n();
        }

        const rawHeaders = { ...this._baseHeaders };
        const headers = {};

        // 1. Normalizar todas las cabeceras a minúsculas para evitar duplicados
        for (const [key, value] of Object.entries(rawHeaders)) {
            headers[key.toLowerCase()] = value;
        }

        // 2. Generar e inyectar nuestra autorización fresca (machacando cualquiera vieja)
        if (this.authType === AuthType.BROWSER && this.sapisid) {
            headers["authorization"] = await generateAuthorization(this.sapisid, this.origin);
        } else if (this.authType === AuthType.OAUTH_CUSTOM_CLIENT && this.token) {
            // headers["origin"] = YTM_DOMAIN;
            headers["x-origin"] = YTM_DOMAIN;
            headers["cookie"] = "SOCS=CAI;";
            headers["authorization"] = await this.token.asAuthAsync();
            headers["x-goog-request-time"] = Math.floor(Date.now() / 1000).toString();
        }

        // Cache system for Visitor ID
        if (!this.visitorId) {
            // Perform a raw fetch to avoid infinite loops with _sendGetRequest
            this.visitorId = await getVisitorId(async (url) => {
                const res = await fetch(url);
                return res.text();
            });
        }

        if (this.visitorId) {
            headers["x-goog-visitor-id"] = this.visitorId;
        }

        return headers;
    }

    /**
     * Main wrapper for POST requests to the InnerTube API.
     * @param {string} endpoint - API endpoint (e.g., "browse", "search").
     * @param {Object} body - Request body.
     * @param {string} additionalParams - Additional URL parameters.
     * @returns {Promise<Object>} The parsed JSON response.
     */
    async _sendRequest(endpoint, body = {}, additionalParams = "") {
        const payload = { ...this.context, ...body };
        const url = `${YTM_BASE_API}${endpoint}${this.params}${additionalParams}`;

        const finalHeaders = await this._getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: finalHeaders,
            body: JSON.stringify(payload),
        });

        const responseData = await response.json();

        if (!response.ok || response.status >= 400) {
            const errorMessage = responseData?.error?.message || response.statusText;
            throw new Error(`[YTM-JS Server Error] HTTP ${response.status}: ${errorMessage}`);
        }

        return responseData;
    }

    /**
     * Support GET requests (generally used to obtain the visitor cookie or tokens).
     * @param {string} url - Full URL to request.
     * @param {Object} params - Query parameters.
     * @returns {Promise<Response>} The native Response object.
     */
    async _sendGetRequest(url, params = {}) {
        const urlObj = new URL(url);
        Object.entries(params).forEach(([k, v]) => urlObj.searchParams.append(k, v));

        const finalHeaders = await this._getHeaders();

        return fetch(urlObj.toString(), {
            method: 'GET',
            headers: finalHeaders,
        });
    }

    /**
     * Checks if the user has provided authorization credentials.
     * @throws {Error} if the user is not authorized.
     */
    _checkAuth() {
        if (this.authType === AuthType.UNAUTHORIZED) {
            throw new Error("Please provide authentication before using this function");
        }
    }
}