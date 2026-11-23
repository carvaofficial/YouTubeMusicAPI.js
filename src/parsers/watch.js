/**
 * @fileoverview Parsers for the watch playlist (up next queue) and tabs (lyrics, related).
 */

import {
    nav,
    MENU_ITEMS,
    TOGGLE_MENU,
    TITLE_TEXT,
    THUMBNAIL,
    NAVIGATION_VIDEO_TYPE,
    PAGE_TYPE
} from '../core/navigation.js';

import { parseLikeStatus, parseSongMenuData, parseSongRuns } from './songs.js';

/**
 * Parses the watch playlist (the queue of upcoming songs).
 * @param {Array} results - Raw JSON list of playlist items.
 * @returns {Array} List of parsed tracks.
 */
export function parseWatchPlaylist(results) {
    const tracks = [];
    if (!results || !Array.isArray(results)) return tracks;

    const PPVWR = "playlistPanelVideoWrapperRenderer";
    const PPVR = "playlistPanelVideoRenderer";

    for (let result of results) {
        let counterpart = null;

        if (PPVWR in result) {
            counterpart = result[PPVWR].counterpart[0].counterpartRenderer[PPVR];
            result = result[PPVWR].primaryRenderer;
        }

        if (!(PPVR in result)) {
            continue;
        }

        const data = result[PPVR];

        // Saltamos los audios que no están disponibles/reproducibles
        if ("unplayableText" in data) {
            continue;
        }

        const track = parseWatchTrack(data);
        if (counterpart) {
            track.counterpart = parseWatchTrack(counterpart);
        }
        tracks.push(track);
    }

    return tracks;
}

/**
 * Parses a single track from the watch playlist queue.
 * @param {Object} data - Raw JSON data of the track.
 * @returns {Object} Parsed track metadata.
 */
export function parseWatchTrack(data) {
    let likeStatus = null;
    const menuItems = nav(data, MENU_ITEMS, true) || [];

    for (const item of menuItems) {
        if (TOGGLE_MENU in item) {
            const service = item[TOGGLE_MENU].defaultServiceEndpoint;
            if (service && "likeEndpoint" in service) {
                likeStatus = parseLikeStatus(service);
            }
        }
    }

    const track = {
        videoId: data.videoId,
        title: nav(data, TITLE_TEXT, true),
        length: nav(data, ["lengthText", "runs", 0, "text"], true),
        thumbnail: nav(data, THUMBNAIL, true),
        likeStatus: likeStatus,
        videoType: nav(data, ["navigationEndpoint", ...NAVIGATION_VIDEO_TYPE], true),
    };

    // Añadimos datos de la biblioteca y pines (sobrenscribiendo los valores por defecto a null)
    Object.assign(track, {
        inLibrary: null,
        feedbackTokens: null,
        pinnedToListenAgain: null,
        listenAgainFeedbackTokens: null,
        ...parseSongMenuData(data)
    });

    const longBylineText = nav(data, ["longBylineText"], true);
    if (longBylineText && longBylineText.runs) {
        const songInfo = parseSongRuns(longBylineText.runs);
        Object.assign(track, songInfo);
    }

    return track;
}

/**
 * Gets the browse IDs for the tabs in the watch menu (Up Next, Lyrics, Related).
 * @param {Object} watchNextRenderer - Raw JSON watchNextRenderer object.
 * @returns {Object} Dictionary mapping pageTypes to browseIds.
 */
export function getTabBrowseIds(watchNextRenderer) {
    const browseIds = {};
    if (!watchNextRenderer || !watchNextRenderer.tabs) return browseIds;

    for (const tab of watchNextRenderer.tabs) {
        if ("unselectable" in tab.tabRenderer) {
            continue;
        }

        const browseEndpoint = nav(tab, ["tabRenderer", "endpoint", "browseEndpoint"], true);
        if (browseEndpoint) {
            // Usa el tipo de página como clave (ej. "MUSIC_PAGE_TYPE_TRACK_LYRICS")
            const pageType = nav(browseEndpoint, PAGE_TYPE, true);
            if (pageType && browseEndpoint.browseId) {
                browseIds[pageType] = browseEndpoint.browseId;
            }
        }
    }

    return browseIds;
}