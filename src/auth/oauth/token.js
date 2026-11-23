/**
 * @fileoverview OAuth Token management with auto-refresh capabilities and bug-free parsing.
 */

export class Token {
    /**
     * Base class representation of the YouTubeMusicAPI OAuth token.
     * @param {Object} data - Token data
     */
    constructor({ access_token, refresh_token, scope, token_type, expires_in, expires_at = 0 }) {
        this.accessToken = access_token;
        this.refreshToken = refresh_token;
        this.scope = scope;
        this.tokenType = token_type;

        // Bug-proof assignment: fallback to 0 if not present or invalid
        this.expiresIn = parseInt(expires_in) || 0;
        this.expiresAt = parseInt(expires_at) || 0;
    }

    /**
     * @returns {Object} Dictionary containing underlying token values.
     */
    asDict() {
        return {
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            scope: this.scope,
            token_type: this.tokenType,
            expires_in: this.expiresIn,
            expires_at: this.expiresAt
        };
    }

    asJson() {
        return JSON.stringify(this.asDict());
    }

    /**
     * @returns {string} Authorization header ready string.
     */
    asAuth() {
        return `${this.tokenType} ${this.accessToken}`;
    }

    /**
     * @returns {boolean} True if the token expires in less than 60 seconds.
     */
    get isExpiring() {
        // If expiresAt is 0, we assume it's a non-expiring token (defensive check)
        if (this.expiresAt === 0) return false;

        const now = Math.floor(Date.now() / 1000);
        return (this.expiresAt - now) < 60;
    }
}

export class OAuthToken extends Token {
    /**
     * Checks if a headers object contains all required token members.
     * @param {Object} headers - Case-insensitive headers object.
     * @returns {boolean}
     */
    static isOauth(headers) {
        const requiredKeys = ['access_token', 'refresh_token', 'scope', 'token_type'];
        return requiredKeys.every(key => key in headers);
    }

    /**
     * Update access_token and expiration attributes with fresh data inplace.
     * @param {Object} freshAccess - The new token data from Google.
     */
    update(freshAccess) {
        this.accessToken = freshAccess.access_token;

        // Defensive parsing for the refresh duration (fixes Google API inconsistencies)
        const newExpiresIn = parseInt(freshAccess.expires_in) || 0;
        const now = Math.floor(Date.now() / 1000);

        this.expiresAt = now + newExpiresIn;
    }
}

export class RefreshingToken extends OAuthToken {
    /**
     * Compositional implementation that automatically refreshes an underlying
     * OAuthToken when required (expiration <= 1 min).
     * * @param {Object} config - Token configuration.
     * @param {import('./credentials.js').OAuthCredentials} config.credentials - Credentials used for refreshing.
     * @param {string|null} [config.localCache=null] - Path to automatically save the token.
     */
    constructor(config) {
        super(config);
        this.credentials = config.credentials;
        this.localCache = config.localCache || null;
    }

    /**
     * Intercepts the access to the access token to perform auto-refresh if needed.
     * We must use an async method here since refreshing is an HTTP request.
     * @returns {Promise<string>} The valid access token.
     */
    async getValidAccessToken() {
        if (this.isExpiring) {
            try {
                const fresh = await this.credentials.refreshToken(this.refreshToken);
                this.update(fresh);
                await this.storeToken();
            } catch (err) {
                throw new Error(`[YTM-JS Error] Failed to auto-refresh token: ${err.message}`);
            }
        }
        return this.accessToken;
    }

    /**
     * Write token values to json file.
     * Environment agnostic: Will skip quietly if no file system is available.
     * @param {string|null} [path=null] - Override save path.
     */
    async storeToken(path = null) {
        const filePath = path || this.localCache;
        if (!filePath) return;

        try {
            const fs = await import('node:fs/promises');
            await fs.writeFile(filePath, JSON.stringify(this.asDict(), null, 2), 'utf-8');
        } catch (err) {
            // Ignore FS errors for browser/edge environments
        }
    }

    /**
     * Overridden asAuth to ensure it awaits the valid token.
     * @returns {Promise<string>} Authorization header string.
     */
    async asAuthAsync() {
        const validToken = await this.getValidAccessToken();
        return `${this.tokenType} ${validToken}`;
    }
}