/**
 * @fileoverview Generic helper functions for formatting and data extraction.
 */

/**
 * Extracts digits from a string and converts it to an integer.
 * Handles strings like "1,234", "1.234", "1,234 songs", etc.
 * @param {string|number} string - The string to parse.
 * @returns {number|null} The parsed integer, or null if no digits are found.
 */
export function toInt(string) {
    if (typeof string === 'number') return string;
    if (!string) return null;

    // Eliminamos todo lo que no sea un número (comas, puntos, letras)
    const digits = string.toString().replace(/[^0-9]/g, "");
    return digits.length > 0 ? parseInt(digits, 10) : null;
}

/**
 * Parses description runs into a plain text string and returns the original runs.
 * @param {Array<Object>} runs - The description runs from YouTube API.
 * @returns {[string, Array<Object>]} Tuple of [plainTextDescription, originalRuns].
 */
export function parseDescriptionRuns(runs) {
    if (!runs || !Array.isArray(runs)) {
        return ["", []];
    }

    // Concatenamos el texto de cada 'run' para crear una descripción legible
    const description = runs.map(run => run.text || "").join("");
    return [description, runs];
}

/**
 * Calculates the total duration in seconds from an item's tracks.
 * @param {Object} item - An object containing a 'tracks' array (like an Album or Playlist).
 * @returns {number} Total duration in seconds.
 */
export function sumTotalDuration(item) {
    if (!item || !Array.isArray(item.tracks)) {
        return 0;
    }

    return item.tracks.reduce((total, track) => {
        const seconds = track.duration_seconds;
        // Solo sumamos si es un número válido
        return total + (typeof seconds === 'number' && !isNaN(seconds) ? seconds : 0);
    }, 0);
}