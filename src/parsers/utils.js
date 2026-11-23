/**
 * @fileoverview Utility functions for parsers.
 */

import {
    nav,
    findObjectsByKey,
    MENU_ITEMS,
    MNIR,
    ICON_TYPE,
    NAVIGATION_BROWSE_ID
} from '../core/navigation.js';

/**
 * Performs in-place replacement based on data in result object.
 * Extracts watch playlist IDs (shuffle/radio) from menus.
 * @param {Object} data - The raw JSON data containing the menu.
 * @param {Object} result - The result dictionary to mutate.
 */
export function parseMenuPlaylists(data, result) {
    const menuItems = nav(data, MENU_ITEMS, true);
    if (!menuItems) return;

    const watchMenu = findObjectsByKey(menuItems, MNIR);
    for (const itemWrapper of watchMenu) {
        const item = itemWrapper[MNIR];
        const icon = nav(item, ICON_TYPE, true);
        let watchKey;

        if (icon === "MUSIC_SHUFFLE") {
            watchKey = "shuffleId";
        } else if (icon === "MIX") {
            watchKey = "radioId";
        } else {
            continue;
        }

        let watchId = nav(item, ["navigationEndpoint", "watchPlaylistEndpoint", "playlistId"], true);
        if (!watchId) {
            watchId = nav(item, ["navigationEndpoint", "watchEndpoint", "playlistId"], true);
        }

        if (watchId) {
            result[watchKey] = watchId;
        }
    }
}

/**
 * Safely extracts the flex column item from a responsive list item.
 * @param {Object} item - The list item.
 * @param {number} index - The index of the flex column.
 * @returns {Object|null}
 */
export function getFlexColumnItem(item, index) {
    if (
        !item.flexColumns ||
        item.flexColumns.length <= index ||
        !item.flexColumns[index]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
    ) {
        return null;
    }

    return item.flexColumns[index].musicResponsiveListItemFlexColumnRenderer;
}

/**
 * Extracts text from a specific run inside a flex column.
 * @param {Object} item - The list item.
 * @param {number} index - The index of the flex column.
 * @param {number} [runIndex=0] - The index of the text run.
 * @param {boolean} [noneIfAbsent=false] - Return null instead of crashing if the run doesn't exist.
 * @returns {string|null}
 */
export function getItemText(item, index, runIndex = 0, noneIfAbsent = false) {
    const column = getFlexColumnItem(item, index);
    if (!column) return null;

    if (noneIfAbsent && column.text.runs.length < runIndex + 1) {
        return null;
    }

    return column.text.runs[runIndex]?.text || null;
}

/**
 * Safely extracts the fixed column item from a responsive list item.
 * @param {Object} item - The list item.
 * @param {number} index - The index of the fixed column.
 * @returns {Object|null}
 */
export function getFixedColumnItem(item, index) {
    if (
        !item.fixedColumns ||
        item.fixedColumns.length <= index ||
        !item.fixedColumns[index]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs
    ) {
        return null;
    }

    return item.fixedColumns[index].musicResponsiveListItemFixedColumnRenderer;
}

/**
 * Finds the index of the bullet point (" • ") separator in a text runs array.
 * @param {Array} runs - The text runs array.
 * @returns {number} The index of the separator, or the length of the array if not found.
 */
export function getDotSeparatorIndex(runs) {
    if (!Array.isArray(runs)) return 0;

    // En YTMusic, el separador siempre es un punto volado con espacios
    const index = runs.findIndex(run => run.text === " • ");
    return index !== -1 ? index : runs.length;
}

/**
 * Parse duration string to a value in seconds.
 * @param {string|null} duration - Duration string (e.g., "3:45").
 * @returns {number|null} Duration in seconds.
 */
export function parseDuration(duration) {
    // duration may be falsy or a single space: ' '
    if (!duration || typeof duration !== 'string' || !duration.trim()) {
        return null;
    }

    const durationSplit = duration.trim().split(":");

    // Check for weird formats like "2,343" (e.g., views instead of duration)
    for (const d of durationSplit) {
        if (!/^\d+$/.test(d)) return null;
    }

    const mappedIncrements = [1, 60, 3600];
    let seconds = 0;
    const reversedSplit = [...durationSplit].reverse();

    for (let i = 0; i < reversedSplit.length; i++) {
        if (mappedIncrements[i]) {
            seconds += mappedIncrements[i] * parseInt(reversedSplit[i], 10);
        }
    }

    return seconds;
}

/**
 * Extracts a basic ID and name object from a text run.
 * @param {Object|null} subRun - The text run containing navigation info.
 * @returns {{id: string|null, name: string|null}}
 */
export function parseIdName(subRun) {
    return {
        id: nav(subRun, NAVIGATION_BROWSE_ID, true),
        name: nav(subRun, ["text"], true)
    };
}