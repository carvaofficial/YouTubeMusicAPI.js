/**
 * @fileoverview Parser for user uploaded items.
 */

import {
    nav,
    MRLIR,
    MENU_ITEMS,
    MNIR,
    MENU_SERVICE,
    THUMBNAILS,
    TEXT_RUN_TEXT,
    MENU_LIKE_STATUS
} from '../core/navigation.js';

import { getItemText, getFixedColumnItem, parseDuration } from './utils.js';
import { parseSongArtists, parseSongAlbum } from './songs.js';

/**
 * Parses a list of uploaded items (songs).
 * @param {Array} results - Raw JSON list of results.
 * @returns {Array} List of parsed uploaded songs.
 */
export function parseUploadedItems(results) {
    const songs = [];
    if (!results || !Array.isArray(results)) return songs;

    for (const result of results) {
        const data = result[MRLIR];
        if (!data || !("menu" in data)) continue;

        // Extraemos el entityId, necesario para poder borrar la canción subida.
        // Nota: Asumimos que tu función nav() maneja el índice -1 (o puedes usar un .slice(-1) en el array)
        const entityId = nav(
            data,
            [
                ...MENU_ITEMS,
                -1,
                MNIR,
                "navigationEndpoint",
                "confirmDialogEndpoint",
                "content",
                "confirmDialogRenderer",
                "confirmButton",
                "buttonRenderer",
                "command",
                "musicDeletePrivatelyOwnedEntityCommand",
                "entityId",
            ],
            true
        );

        const queueTarget = nav(data, [...MENU_ITEMS, 0, ...MENU_SERVICE], true);
        const videoId = queueTarget?.queueAddEndpoint?.queueTarget?.videoId || null;

        const title = getItemText(data, 0);
        const like = nav(data, MENU_LIKE_STATUS, true);
        const thumbnails = "thumbnail" in data ? nav(data, THUMBNAILS, true) : null;

        let duration = null;
        if ("fixedColumns" in data) {
            duration = nav(getFixedColumnItem(data, 0), TEXT_RUN_TEXT, true);
        }

        const song = {
            entityId,
            videoId,
            title,
            duration,
            duration_seconds: parseDuration(duration),
            artists: parseSongArtists(data, 1),
            album: parseSongAlbum(data, 2),
            likeStatus: like,
            thumbnails,
        };

        songs.push(song);
    }

    return songs;
}