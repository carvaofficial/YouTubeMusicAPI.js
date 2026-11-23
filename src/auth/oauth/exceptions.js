/**
 * @fileoverview Custom OAuth exceptions.
 */

/**
 * OAuth client request failure.
 * Ensure provided client_id and secret are correct and YouTube Data API is enabled.
 */
export class BadOAuthClientError extends Error {
    constructor(message = "OAuth client request failure. Ensure provided client_id and secret are correct and YouTube Data API is enabled.") {
        super(message);
        this.name = "BadOAuthClientError";
    }
}

/**
 * OAuth client lacks permissions for specified token.
 * Token can only be refreshed by OAuth credentials used for its creation.
 */
export class UnauthorizedOAuthClientError extends Error {
    constructor(message = "OAuth client lacks permissions for specified token. Token can only be refreshed by OAuth credentials used for its creation.") {
        super(message);
        this.name = "UnauthorizedOAuthClientError";
    }
}