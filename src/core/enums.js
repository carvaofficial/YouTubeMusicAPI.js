/**
 * @fileoverview Global enumerations for YouTube Music API.
 */

/**
 * Enum for YouTube Music API response statuses.
 * @enum {string}
 */
export const ResponseStatus = Object.freeze({
    SUCCEEDED: "STATUS_SUCCEEDED"
});

/**
 * Enum for playlist privacy status.
 * @enum {string}
 */
export const PrivacyStatus = Object.freeze({
    PUBLIC: "PUBLIC",
    PRIVATE: "PRIVATE",
    UNLISTED: "UNLISTED"
});

/**
 * Enum for YouTube Music API like statuses.
 * @enum {string}
 */
export const LikeStatus = Object.freeze({
    LIKE: "LIKE",
    DISLIKE: "DISLIKE",
    INDIFFERENT: "INDIFFERENT"
});

/**
 * Enum for YouTube Music API video types.
 * @enum {string}
 */
export const VideoType = Object.freeze({
    OMV: "MUSIC_VIDEO_TYPE_OMV",
    UGC: "MUSIC_VIDEO_TYPE_UGC",
    ATV: "MUSIC_VIDEO_TYPE_ATV",
    OFFICIAL_SOURCE_MUSIC: "MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC"
});

/**
 * Enum for playlist sort orders.
 * @enum {number}
 */
export const PlaylistSortOrder = Object.freeze({
    MANUAL: 0,
    NEWEST_FIRST: 1,
    NEWEST_LAST: 2,
    TOP_VOTED: 6
});

/**
 * Enum for YouTube Music API community vote statuses.
 * @enum {string}
 */
export const VoteStatus = Object.freeze({
    UPVOTED: "VOTE_STATUS_UPVOTED",
    DOWNVOTED: "VOTE_STATUS_DOWNVOTED",
    UNSPECIFIED: "VOTE_STATUS_UNSPECIFIED"
});

/**
 * Enum for playlist community vote edit options.
 * Includes a helper to get the integer argument required by the API.
 * @enum {string}
 */
export const PlaylistVoteEditOptions = Object.freeze({
    EVERYONE_CAN_VOTE: "EVERYONE_CAN_VOTE",
    COLLABORATORS_ONLY: "COLLABORATORS_ONLY", // only available for playlists where collaborate is on
    OFF: "OFF",

    /**
     * Gets the integer argument required for the API request.
     * @param {string} option 
     * @returns {number}
     */
    getArgumentForRequest(option) {
        switch (option) {
            case this.EVERYONE_CAN_VOTE: return 1;
            case this.COLLABORATORS_ONLY: return 2;
            case this.OFF: return 3;
            default: throw new Error(`Invalid PlaylistVoteEditOptions: ${option}`);
        }
    }
});