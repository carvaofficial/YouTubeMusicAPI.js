/**
 * @fileoverview Utility functions specifically for mixin modules.
 */

import { YTMusicUserError, YTMusicGatedError } from '../core/exceptions.js';
import { LikeStatus } from '../core/enums.js';
import { nav } from '../core/navigation.js';

/** @typedef {"a_to_z" | "z_to_a" | "recently_added"} LibraryOrderType */
const VALID_ORDERS = ["a_to_z", "z_to_a", "recently_added"];

/**
 * Returns the correct endpoint for a given rating.
 * @param {string} rating - The LikeStatus value.
 * @returns {string} The formatted endpoint string.
 * @throws {YTMusicUserError} If the rating is invalid.
 */
export function prepareLikeEndpoint(rating) {
    switch (rating) {
        case LikeStatus.LIKE:
            return "like/like";
        case LikeStatus.DISLIKE:
            return "like/dislike";
        case LikeStatus.INDIFFERENT:
            return "like/removelike";
        default:
            const validValues = Object.values(LikeStatus).join(', ');
            throw new YTMusicUserError(`Invalid rating provided. Use one of [${validValues}].`);
    }
}

/**
 * Validates the provided order parameter.
 * @param {LibraryOrderType|null|undefined} order - The order to validate.
 * @throws {YTMusicUserError} If the order is invalid.
 */
export function validateOrderParameter(order) {
    if (order && !VALID_ORDERS.includes(order)) {
        throw new YTMusicUserError(
            `Invalid order provided. Please use one of the following orders or leave out the parameter: ${VALID_ORDERS.join(", ")}`
        );
    }
}

/**
 * Returns request params belonging to a specific sorting order.
 * @param {LibraryOrderType} order - The validated order type.
 * @returns {string} The base64-like parameter string.
 */
export function prepareOrderParams(order) {
    const orderParamsMap = {
        "a_to_z": "ggMGKgQIARAA",
        "z_to_a": "ggMGKgQIARAB",
        "recently_added": "ggMGKgQIABAB"
    };
    return orderParamsMap[order];
}

/**
 * Sanitizes tags from HTML.
 * @param {string} htmlText - String containing html tags.
 * @returns {string} String without < > characters.
 */
export function htmlToTxt(htmlText) {
    if (!htmlText) return "";
    return htmlText.replace(/<[^>]+>/g, "");
}

/**
 * Check that YTM performed a write request instead of answering with a dialog.
 * @param {Object} response - The response JSON object.
 * @throws {YTMusicGatedError} If the request was gated/not performed.
 */
export function validateWriteResponse(response) {
    const panel = nav(response, ["actions", 0, "showEngagementPanelEndpoint"], true);
    if (panel === null) {
        return;
    }

    const tag = nav(panel, ["identifier", "tag"], true);
    throw new YTMusicGatedError(
        `YouTube Music did not perform this request and asked for interaction with its '${tag}' dialog. The account may be temporarily restricted from this action.`
    );
}

/**
 * Returns the number of days since January 1, 1970.
 * Currently only used for the signature timestamp in get_song.
 * @returns {number} Days since UNIX epoch.
 */
export function getDatestamp() {
    return Math.floor(Date.now() / (1000 * 60 * 60 * 24));
}