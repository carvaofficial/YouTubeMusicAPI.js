/**
 * @fileoverview Parser for album headers.
 */

import {
    nav,
    findObjectByKey,
    HEADER_DETAIL,
    TITLE_TEXT,
    SUBTITLE,
    THUMBNAIL_CROPPED,
    SUBTITLE_BADGE_LABEL,
    MENU,
    NAVIGATION_WATCH_PLAYLIST_ID,
    NAVIGATION_PLAYLIST_ID,
    TWO_COLUMN_RENDERER,
    TAB_CONTENT,
    SECTION_LIST_ITEM,
    RESPONSIVE_HEADER,
    THUMBNAILS,
    DESCRIPTION_SHELF,
    DESCRIPTION_RUN_LIST,
    WATCH_PID,
    WATCH_PLAYLIST_ID
} from '../core/navigation.js';

import { parseDescriptionRuns, toInt } from '../core/helpers.js';
import { parseArtistsRuns } from './artists.js';
import { parseLikeStatus, parseSongRuns } from './songs.js';

/**
 * Parses the older album header format.
 * @param {Object} response - The raw JSON response.
 * @returns {Object} Parsed album data.
 */
export function parseAlbumHeader(response) {
    const header = nav(response, HEADER_DETAIL);
    const album = {
        title: nav(header, TITLE_TEXT),
        type: nav(header, SUBTITLE),
        thumbnails: nav(header, THUMBNAIL_CROPPED),
        isExplicit: nav(header, SUBTITLE_BADGE_LABEL, true) !== null,
    };

    if (header.description) {
        album.description = header.description.runs[0].text;
    }

    // parseSongRuns extrae el año, etc.
    const albumInfo = parseSongRuns(header.subtitle.runs.slice(2));
    Object.assign(album, albumInfo);

    if (header.secondSubtitle.runs.length > 1) {
        album.trackCount = toInt(header.secondSubtitle.runs[0].text);
        album.duration = header.secondSubtitle.runs[2].text;
    } else {
        album.duration = header.secondSubtitle.runs[0].text;
    }

    // Extraer el botón de reproducir y añadir a la biblioteca (para sacar los IDs)
    const menu = nav(header, MENU);
    const toplevel = menu.topLevelButtons;

    album.audioPlaylistId = nav(toplevel, [0, "buttonRenderer", ...NAVIGATION_WATCH_PLAYLIST_ID], true);
    if (!album.audioPlaylistId) {
        album.audioPlaylistId = nav(toplevel, [0, "buttonRenderer", ...NAVIGATION_PLAYLIST_ID], true);
    }

    const service = nav(toplevel, [1, "buttonRenderer", "defaultServiceEndpoint"], true);
    if (service) {
        album.likeStatus = parseLikeStatus(service);
    }

    return album;
}

/**
 * Parses the modern (2024+) album header format used in the web app.
 * @param {Object} response - The raw JSON response.
 * @returns {Object} Parsed album data.
 */
export function parseAlbumHeader2024(response) {
    const header = nav(response, [
        ...TWO_COLUMN_RENDERER,
        ...TAB_CONTENT,
        ...SECTION_LIST_ITEM,
        ...RESPONSIVE_HEADER
    ]);

    const album = {
        title: nav(header, TITLE_TEXT),
        type: nav(header, SUBTITLE),
        thumbnails: nav(header, THUMBNAILS),
        isExplicit: nav(header, SUBTITLE_BADGE_LABEL, true) !== null,
    };

    const rawDescriptionRuns = nav(header, ["description", ...DESCRIPTION_SHELF, ...DESCRIPTION_RUN_LIST], true);
    // Asumimos que parseDescriptionRuns devuelve un array [textoPlano, arrayDeRuns]
    const [description, descriptionRuns] = rawDescriptionRuns ? parseDescriptionRuns(rawDescriptionRuns) : [null, []];
    album.description = description;
    album.descriptionRuns = descriptionRuns;

    const albumInfo = parseSongRuns(header.subtitle.runs.slice(2));
    const straplineRuns = nav(header, ["straplineTextOne", "runs"], true);
    albumInfo.artists = straplineRuns ? parseArtistsRuns(straplineRuns) : null;

    Object.assign(album, albumInfo);

    if (header.secondSubtitle.runs.length > 1) {
        album.trackCount = toInt(header.secondSubtitle.runs[0].text);
        album.duration = header.secondSubtitle.runs[2].text;
    } else {
        album.duration = header.secondSubtitle.runs[0].text;
    }

    const buttons = header.buttons;
    const playBtn = findObjectByKey(buttons, "musicPlayButtonRenderer");

    album.audioPlaylistId = nav(
        playBtn,
        ["musicPlayButtonRenderer", "playNavigationEndpoint", ...WATCH_PID],
        true
    );

    // Fallback temporal como en Python
    if (!album.audioPlaylistId) {
        album.audioPlaylistId = nav(
            playBtn,
            ["musicPlayButtonRenderer", "playNavigationEndpoint", ...WATCH_PLAYLIST_ID],
            true
        );
    }

    const toggleBtn = findObjectByKey(buttons, "toggleButtonRenderer");
    const service = nav(
        toggleBtn,
        ["toggleButtonRenderer", "defaultServiceEndpoint"],
        true
    );

    album.likeStatus = "INDIFFERENT";
    if (service) {
        album.likeStatus = parseLikeStatus(service);
    }

    return album;
}

/**
 * Extracts playlist ID if the user is authenticated (the JSON structure changes).
 * @param {Object|null} data - Menu data or similar JSON dict.
 * @returns {string|null} The Playlist ID or null.
 */
export function parseAlbumPlaylistIdIfExists(data) {
    if (!data) return null;
    return nav(data, WATCH_PID, true) || nav(data, WATCH_PLAYLIST_ID, true) || null;
}