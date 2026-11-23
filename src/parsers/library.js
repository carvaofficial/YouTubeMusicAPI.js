/**
 * @fileoverview Parsers for the user's library contents (albums, artists, songs, podcasts).
 */


import { getContinuations } from '../core/continuations.js';
import {
    nav,
    findObjectByKey,
    MRLIR,
    NAVIGATION_BROWSE_ID,
    NAVIGATION_BROWSE,
    PAGE_TYPE,
    THUMBNAILS,
    GRID,
    MTRIR,
    TITLE,
    MENU_PLAYLIST_ID,
    TITLE_TEXT,
    THUMBNAIL_RENDERER,
    SUBTITLE,
    MUSIC_SHELF,
    SINGLE_COLUMN_TAB,
    SECTION_LIST,
    SINGLE_COLUMN,
    TAB_1_CONTENT,
    TAB_2_CONTENT,
    SECTION_LIST_ITEM,
    ITEM_SECTION
} from '../core/navigation.js';

import { getFlexColumnItem, getItemText, parseMenuPlaylists } from './utils.js';
import { parseContentList } from './browsing.js';
import { parseSongRuns } from './songs.js';
import { parsePlaylistItems } from './playlists.js';
import { parsePodcast } from './podcasts.js';

/**
 * Parses a list of library artists.
 * @param {Array} results - Raw JSON list of results.
 * @param {boolean} [uploaded=false] - Whether these are uploaded artists.
 * @returns {Array} List of parsed artists.
 */
export function parseArtists(results, uploaded = false) {
    const artists = [];
    if (!results || !Array.isArray(results)) return artists;

    for (const result of results) {
        const data = result[MRLIR];
        if (!data) continue;

        const artist = {};
        artist.browseId = nav(data, NAVIGATION_BROWSE_ID, true);
        artist.artist = getItemText(data, 0);

        const pageType = nav(data, [...NAVIGATION_BROWSE, ...PAGE_TYPE], true);
        if (pageType === "MUSIC_PAGE_TYPE_USER_CHANNEL") {
            artist.type = "channel";
        } else if (pageType === "MUSIC_PAGE_TYPE_ARTIST") {
            artist.type = "artist";
        }

        parseMenuPlaylists(data, artist);

        if (uploaded) {
            artist.songs = (getItemText(data, 1) || "").split(" ")[0];
        } else {
            const subtitle = getItemText(data, 1);
            if (subtitle) {
                artist.subscribers = subtitle.split(" ")[0];
            }
        }

        artist.thumbnails = nav(data, THUMBNAILS, true);
        artists.push(artist);
    }

    return artists;
}

/**
 * Parses library albums with potential continuations.
 * @param {Object} response - Raw JSON response.
 * @param {Function} requestFunc - Async function to request continuations.
 * @param {number|null} limit - Maximum number of items to retrieve.
 * @returns {Promise<Array>} List of parsed albums.
 */
export async function parseLibraryAlbums(response, requestFunc, limit = null) {
    const results = getLibraryContents(response, GRID);
    if (!results) return [];

    const albums = parseAlbums(results.items || []);

    if ("continuations" in results) {
        const parseFunc = (contents) => parseAlbums(contents);
        const remainingLimit = limit === null ? null : (limit - albums.length);

        const continuations = await getContinuations(results, "gridContinuation", remainingLimit, requestFunc, parseFunc);
        albums.push(...continuations);
    }

    return albums;
}

/**
 * Parses a list of album results.
 * @param {Array} results - Raw JSON list of results.
 * @returns {Array} List of parsed albums.
 */
export function parseAlbums(results) {
    const albums = [];
    if (!results || !Array.isArray(results)) return albums;

    for (const result of results) {
        const data = result[MTRIR];
        if (!data) continue;

        const album = {};
        album.browseId = nav(data, [...TITLE, ...NAVIGATION_BROWSE_ID], true);
        album.playlistId = nav(data, MENU_PLAYLIST_ID, true);
        album.title = nav(data, TITLE_TEXT, true);
        album.thumbnails = nav(data, THUMBNAIL_RENDERER, true);

        if (data.subtitle && "runs" in data.subtitle) {
            album.type = nav(data, SUBTITLE, true);
            Object.assign(album, parseSongRuns(data.subtitle.runs.slice(2)));
        }

        albums.push(album);
    }

    return albums;
}

/**
 * Parses library podcasts with potential continuations.
 * @param {Object} response - Raw JSON response.
 * @param {Function} requestFunc - Async function to request continuations.
 * @param {number|null} limit - Maximum number of items to retrieve.
 * @returns {Promise<Array>} List of parsed podcasts.
 */
export async function parseLibraryPodcasts(response, requestFunc, limit = null) {
    const results = getLibraryContents(response, GRID);
    if (!results) return [];

    const parseFunc = (contents) => parseContentList(contents, parsePodcast);
    const podcasts = parseFunc(results.items.slice(1)); // skip first entry "Add podcast"

    if ("continuations" in results) {
        const remainingLimit = limit === null ? null : (limit - podcasts.length);

        const continuations = await getContinuations(results, "gridContinuation", remainingLimit, requestFunc, parseFunc);
        podcasts.push(...continuations);
    }

    return podcasts;
}

/**
 * Parses library artists with potential continuations.
 * @param {Object} response - Raw JSON response.
 * @param {Function} requestFunc - Async function to request continuations.
 * @param {number|null} limit - Maximum number of items to retrieve.
 * @returns {Promise<Array>} List of parsed artists.
 */
export async function parseLibraryArtists(response, requestFunc, limit = null) {
    const results = getLibraryContents(response, MUSIC_SHELF);
    if (!results) return [];

    const artists = parseArtists(results.contents || []);

    if ("continuations" in results) {
        const parseFunc = (contents) => parseArtists(contents);
        const remainingLimit = limit === null ? null : (limit - artists.length);

        const continuations = await getContinuations(results, "musicShelfContinuation", remainingLimit, requestFunc, parseFunc);
        artists.push(...continuations);
    }

    return artists;
}

/**
 * Removes the random mix that conditionally appears at the start of library songs.
 * @param {Object|null} results - The results dictionary.
 */
export function popSongsRandomMix(results) {
    if (results && results.contents && results.contents.length >= 2) {
        results.contents.shift();
    }
}

/**
 * Parses the library songs shelf.
 * @param {Object} response - Raw JSON response.
 * @returns {Object} Dictionary with results and parsed playlist items.
 */
export function parseLibrarySongs(response) {
    const results = getLibraryContents(response, MUSIC_SHELF);
    popSongsRandomMix(results);

    return {
        results: results,
        parsed: results ? parsePlaylistItems(results.contents) : results
    };
}

/**
 * Finds library contents across different response structures.
 * @param {Object} response - Raw JSON response.
 * @param {Array} renderer - The renderer path array (e.g., GRID or MUSIC_SHELF).
 * @returns {Object|null} Library contents or null.
 */
export function getLibraryContents(response, renderer) {
    const section = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST], true);
    let contents;

    if (section === null) {
        // Empty library or uploads (covers non-premium subscribers without downloads tab)
        const tabs = nav(response, [...SINGLE_COLUMN, "tabs"], true) || [];
        const libraryTab = tabs.length < 3 ? TAB_1_CONTENT : TAB_2_CONTENT;
        contents = nav(response, [...SINGLE_COLUMN, ...libraryTab, ...SECTION_LIST_ITEM, ...renderer], true);
    } else {
        const results = findObjectByKey(section, "itemSectionRenderer");
        if (results === null) {
            contents = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST_ITEM, ...renderer], true);
        } else {
            contents = nav(results, [...ITEM_SECTION, ...renderer], true);
        }
    }

    return contents;
}