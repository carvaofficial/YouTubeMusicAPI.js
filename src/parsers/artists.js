/**
 * @fileoverview Parser for artist runs.
 */

import { nav, NAVIGATION_BROWSE_ID } from '../core/navigation.js';

/**
 * Returns artist names and IDs. Skips every other run to avoid separators (like commas).
 * @param {Array<Object>} runs - The text runs containing artist info.
 * @returns {Array<{name: string, id: string|null}>} List of artists.
 */
export function parseArtistsRuns(runs) {
    if (!Array.isArray(runs)) return [];

    const artists = [];

    // YouTube API separa múltiples artistas con un string de texto (normalmente una coma o " & ")
    // Saltamos esos separadores avanzando el índice de 2 en 2
    for (let i = 0; i < runs.length; i += 2) {
        artists.push({
            name: runs[i]?.text || "",
            id: nav(runs[i], NAVIGATION_BROWSE_ID, true)
        });
    }

    return artists;
}