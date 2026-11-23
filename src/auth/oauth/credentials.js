/**
 * @fileoverview OAuth 2.0 Credentials manager for Device Authorization Grant flow.
 */
import {
    OAUTH_CODE_URL,
    OAUTH_SCOPE,
    OAUTH_TOKEN_URL,
    OAUTH_USER_AGENT,
    OAUTH_GRANT_TYPE_URL
} from '../../core/constants.js';
import {
    BadOAuthClientError,
    UnauthorizedOAuthClientError
} from './exceptions.js';

/**
 * Class for handling OAuth credential retrieval and refreshing.
 */
export class OAuthCredentials {
    /**
     * @param {string} clientId - The GoogleAPI client_id used for auth flows.
     * @param {string} clientSecret - Corresponding secret for provided client_id.
     */
    constructor(clientId, clientSecret) {
        if (typeof clientId !== typeof clientSecret) {
            throw new Error("[YTM-JS] OAuthCredential init failure. Provide both clientId and clientSecret or neither.");
        }

        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    /**
     * Internal method for sending POST requests with required client_id and User-Agent modifications.
     * Formats the payload as application/x-www-form-urlencoded.
     * @param {string} url - The OAuth endpoint URL.
     * @param {Object} data - The payload to send.
     * @returns {Promise<Object>} The parsed JSON response.
     * @private
     */
    async _sendRequest(url, data) {
        // TODO: Comprobar si Google exige algún otro header extraño en entornos Edge (Cloudflare)
        const payload = new URLSearchParams({
            client_id: this.clientId,
            ...data
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'User-Agent': OAUTH_USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: payload.toString()
        });

        if (response.status === 401) {
            const errorData = await response.json().catch(() => ({}));
            const issue = errorData.error;

            if (issue === "unauthorized_client") {
                throw new UnauthorizedOAuthClientError();
            } else if (issue === "invalid_client") {
                throw new BadOAuthClientError();
            } else {
                throw new Error(`[YTM-JS] OAuth request error. status_code: ${response.status}, url: ${url}, content: ${JSON.stringify(errorData)}`);
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`[YTM-JS] OAuth request error. status_code: ${response.status}, url: ${url}, content: ${JSON.stringify(errorData)}`);
        }

        return response.json();
    }

    /**
     * Method for obtaining a new user auth code. First step of token creation.
     * @returns {Promise<Object>} Object containing device_code, user_code, etc.
     */
    async getCode() {
        return this._sendRequest(OAUTH_CODE_URL, { scope: OAUTH_SCOPE });
    }

    /**
     * Method for verifying user auth code and conversion into a refreshable token.
     * @param {string} deviceCode - The device code obtained from getCode().
     * @returns {Promise<Object>} The full token object.
     */
    async tokenFromCode(deviceCode) {
        return this._sendRequest(OAUTH_TOKEN_URL, {
            client_secret: this.clientSecret,
            grant_type: OAUTH_GRANT_TYPE_URL,
            code: deviceCode
        });
    }

    /**
     * Method for requesting a new access token for a given refresh_token.
     * Token must have been created by the same OAuth client.
     * @param {string} refreshToken - Corresponding refresh_token for a matching access_token.
     * @returns {Promise<Object>} The new token object.
     */
    async refreshToken(refreshToken) {
        return this._sendRequest(OAUTH_TOKEN_URL, {
            client_secret: this.clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken
        });
    }
}