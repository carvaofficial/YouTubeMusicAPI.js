/**
 * @fileoverview Models for lyrics.
 */

/**
 * Represents a line of lyrics with timestamps (in milliseconds).
 */
export class LyricLine {
    /**
     * @param {string} text - The song text.
     * @param {number} startTime - Begin of the lyric in milliseconds.
     * @param {number} endTime - End of the lyric in milliseconds.
     * @param {number} id - A metadata ID that probably uniquely identifies each lyric line.
     */
    constructor(text, startTime, endTime, id) {
        this.text = text;
        this.startTime = startTime;
        this.endTime = endTime;
        this.id = id;
    }

    /**
     * Converts lyrics in the format from the API to a more reasonable format.
     * @param {Object} rawLyric - The raw lyric-data returned by the mobile API.
     * @returns {LyricLine} A LyricLine instance.
     */
    static fromRaw(rawLyric) {
        const text = rawLyric.lyricLine || "";
        const cueRange = rawLyric.cueRange || {};
        const startTime = parseInt(cueRange.startTimeMilliseconds || 0, 10);
        const endTime = parseInt(cueRange.endTimeMilliseconds || 0, 10);
        const id = parseInt(cueRange.metadata?.id || 0, 10);

        return new LyricLine(text, startTime, endTime, id);
    }
}

/**
 * @typedef {Object} Lyrics
 * @property {string} lyrics
 * @property {string|null} source
 * @property {false} hasTimestamps
 */

/**
 * @typedef {Object} TimedLyrics
 * @property {Array<LyricLine>} lyrics
 * @property {string|null} source
 * @property {true} hasTimestamps
 */