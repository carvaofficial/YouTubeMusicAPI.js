/**
 * @fileoverview Custom exception classes for ytmusicapi.
 */

/**
 * Base error class for ytmusicapi.
 * Shall only be raised if none of the subclasses below are fitting.
 */
export class YTMusicError extends Error {
    constructor(message) {
        super(message);
        this.name = "YTMusicError";
    }
}

/**
 * Error caused by invalid usage of ytmusicapi.
 */
export class YTMusicUserError extends YTMusicError {
    constructor(message) {
        super(message);
        this.name = "YTMusicUserError";
    }
}

/**
 * Error caused by the YouTube Music backend.
 */
export class YTMusicServerError extends YTMusicError {
    constructor(message) {
        super(message);
        this.name = "YTMusicServerError";
    }
}

/**
 * The YouTube Music backend did not perform a request and asked for interaction with a dialog.
 */
export class YTMusicGatedError extends YTMusicError {
    constructor(message) {
        super(message);
        this.name = "YTMusicGatedError";
    }
}