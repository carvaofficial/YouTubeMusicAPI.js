/**
 * @fileoverview Parsers for song metadata, runs, and menus.
 */

import {
    nav,
    NAVIGATION_BROWSE_ID,
    TEXT_RUN,
    MENU_ITEMS,
    TOGGLE_MENU,
    FEEDBACK_TOKEN
} from '../core/navigation.js';
import { LikeStatus } from '../core/enums.js';

import { getFlexColumnItem, getItemText, parseDuration } from './utils.js';
import { parseArtistsRuns } from './artists.js';

/**
 * Extracts artists from a specific flex column index.
 * @param {Object} data - The item data.
 * @param {number} index - The index of the flex column.
 * @returns {Array} List of parsed artists.
 */
export function parseSongArtists(data, index) {
    const flexItem = getFlexColumnItem(data, index);
    if (!flexItem) return [];

    return parseArtistsRuns(flexItem.text.runs);
}

/**
 * Classifies a single text run (album, artist, views, duration, year).
 * @param {Object} run - A single text run object.
 * @returns {Object} An object with the type and the extracted data.
 */
export function parseSongRun(run) {
    const text = run.text;

    if ("navigationEndpoint" in run) {
        // Tiene enlace, así que es un Artista o un Álbum
        const item = { name: text, id: nav(run, NAVIGATION_BROWSE_ID, true) };

        if (item.id && (item.id.startsWith("MPRE") || item.id.includes("release_detail"))) {
            return { type: "album", data: item };
        } else {
            return { type: "artist", data: item };
        }
    } else {
        // No tiene enlace: parseamos por patrones usando Regex

        // Vistas: ej. "14M views" o "14M vistas" (YouTube usa \xa0, un non-breaking space)
        if (/^\d\S* \S*$/.test(text)) {
            return { type: "views", data: text.split(" ")[0] };
        }
        // Duración: ej. "3:45" o "1:03:45"
        else if (/^(\d+:)*\d+:\d+$/.test(text)) {
            return { type: "duration", data: text };
        }
        // Año: ej. "2024"
        else if (/^\d{4}$/.test(text)) {
            return { type: "year", data: text };
        }
        // Si no encaja en nada, lo asumimos como un artista sin ID en YTMusic
        else {
            return { type: "artist", data: { name: text, id: null } };
        }
    }
}

/**
 * Parses an array of song runs, extracting artists, album, duration, etc.
 * @param {Array} runs - Array of text runs.
 * @param {boolean} [skipTypeSpec=false] - If true, skips the type specifier (e.g., "Song • Eminem").
 * @returns {Object} Parsed metadata.
 */
export function parseSongRuns(runs, skipTypeSpec = false) {
    const parsed = {};
    if (!runs || !Array.isArray(runs)) return parsed;

    let runsToProcess = runs;

    // Previene que el especificador de tipo (ej "Song") se parsee como artista
    if (
        skipTypeSpec &&
        runs.length > 2 &&
        parseSongRun(runs[0]).type === "artist" &&
        runs[1]?.text === " • " &&
        parseSongRun(runs[2]).type === "artist"
    ) {
        runsToProcess = runs.slice(2);
    }

    for (let i = 0; i < runsToProcess.length; i++) {
        // Los índices impares siempre son separadores (" • " o ", "), los saltamos
        if (i % 2 !== 0) continue;

        const parsedRun = parseSongRun(runsToProcess[i]);
        const data = parsedRun.data;

        switch (parsedRun.type) {
            case "album":
                parsed.album = data;
                break;
            case "artist":
                if (!parsed.artists) parsed.artists = [];
                parsed.artists.push(data);
                break;
            case "views":
                parsed.views = data;
                break;
            case "duration":
                parsed.duration = data;
                parsed.duration_seconds = parseDuration(data);
                break;
            case "year":
                parsed.year = data;
                break;
        }
    }

    return parsed;
}

/**
 * Extracts the album name and ID from a flex column.
 * @param {Object} data - The item data.
 * @param {number} index - Flex column index.
 * @returns {Object|null}
 */
export function parseSongAlbum(data, index) {
    const flexItem = getFlexColumnItem(data, index);
    if (!flexItem) return null;

    const browseId = nav(flexItem, [...TEXT_RUN, ...NAVIGATION_BROWSE_ID], true);
    return { name: getItemText(data, index), id: browseId };
}

/**
 * Parses the context menu of a song to determine library status and tokens.
 * @param {Object} data - The item containing the menu.
 * @returns {Object} Dictionary with library status and tokens.
 */
export function parseSongMenuData(data) {
    if (!data || !data.menu) return {};

    const songData = {
        inLibrary: false,
        pinnedToListenAgain: false
    };

    const menuItems = nav(data, MENU_ITEMS, true) || [];

    for (const item of menuItems) {
        const menuItem = nav(item, TOGGLE_MENU, true) || nav(item, ["menuServiceItemRenderer"], true);
        if (!menuItem) continue;

        const currentIconType = nav(menuItem, ["defaultIcon", "iconType"], true) || nav(menuItem, ["icon", "iconType"], true);
        const feedbackToken = (endpointType) => nav(menuItem, [endpointType, ...FEEDBACK_TOKEN], true);

        switch (currentIconType) {
            case "KEEP": // pin to listen again
                songData.listenAgainFeedbackTokens = {
                    pin: feedbackToken("defaultServiceEndpoint"),
                    unpin: feedbackToken("toggledServiceEndpoint")
                };
                break;
            case "KEEP_OFF": // unpin from listen again
                songData.pinnedToListenAgain = true;
                songData.listenAgainFeedbackTokens = {
                    pin: feedbackToken("toggledServiceEndpoint"),
                    unpin: feedbackToken("defaultServiceEndpoint")
                };
                break;
            case "BOOKMARK_BORDER": // add to library
                songData.feedbackTokens = {
                    add: feedbackToken("defaultServiceEndpoint"),
                    remove: feedbackToken("toggledServiceEndpoint")
                };
                break;
            case "BOOKMARK": // remove from library
                songData.inLibrary = true;
                songData.feedbackTokens = {
                    add: feedbackToken("toggledServiceEndpoint"),
                    remove: feedbackToken("defaultServiceEndpoint")
                };
                break;
            case "REMOVE_FROM_HISTORY":
                songData.feedbackToken = feedbackToken("serviceEndpoint");
                break;
        }
    }

    return songData;
}

/**
 * Parses the like status from a defaultServiceEndpoint.
 * @param {Object} service - The service endpoint object.
 * @returns {string} The LikeStatus enum value.
 */
export function parseLikeStatus(service) {
    if (!service || !service.likeEndpoint) return LikeStatus.INDIFFERENT;
    
    // Si el endpoint de acción es "LIKE", nuestro estado actual es "INDIFFERENT" y viceversa
    return service.likeEndpoint.status === LikeStatus.LIKE ? LikeStatus.INDIFFERENT : LikeStatus.LIKE;
}