/**
 * @fileoverview Core network utilities, scrapers, and helper utilities for data parsing and formatting.
 */

import { YTM_DOMAIN } from '../core/constants.js';
import { nav } from './navigation.js';

/**
 * Fetches the X-Goog-Visitor-Id by scraping the initial configuration object 
 * from the YouTube Music homepage.
 * @param {Function} fetcher - A function that executes a GET request and returns text.
 * @returns {Promise<string>} The Visitor ID string.
 */
export async function getVisitorId(fetcher) {
    try {
        const html = await fetcher(YTM_DOMAIN);

        // Scrape the ytcfg object from the HTML source
        const regex = /ytcfg\.set\s*\(\s*({.+?})\s*\)\s*;/;
        const match = html.match(regex);

        if (match && match[1]) {
            const ytcfg = JSON.parse(match[1]);
            return ytcfg.VISITOR_DATA || "";
        }

        return "";
    } catch (error) {
        // FIXME: Añadir logging silencioso si falla el scraper
        return "";
    }
}/**
 * Attempts to cast a string to an integer by stripping non-numeric characters.
 * @param {string|number} string - String that can be cast to an integer.
 * @returns {number} Integer value.
 */
export function toInt(string) {
    if (string === null || string === undefined) return 0;

    // Normalize string (removes accents/diacritics if any) and strip all non-digits
    const normalizedString = string.toString().normalize("NFKD");
    const numberString = normalizedString.replace(/[^\d]/g, '');

    return parseInt(numberString, 10) || 0;
}

/**
 * Calculates the total duration of an item based on its tracks.
 * @param {Object} item - Dictionary containing a 'tracks' array.
 * @returns {number} Total duration in seconds.
 */
export function sumTotalDuration(item) {
    if (!item || !Array.isArray(item.tracks)) {
        return 0;
    }

    return item.tracks.reduce((acc, track) => {
        const duration = track.duration_seconds;
        return acc + (typeof duration === 'number' ? duration : 0);
    }, 0);
}

/**
 * Parses the description runs into a unified string and an array of text/link objects.
 * @param {Array<Object>|null} descriptionRunsList - The raw runs array from YouTube.
 * @returns {{description: string, descriptionRuns: Array<{text: string, url?: string}>}}
 */
export function parseDescriptionRuns(descriptionRunsList) {
    if (!Array.isArray(descriptionRunsList)) {
        return { description: "", descriptionRuns: [] };
    }

    let description = "";
    const descriptionRuns = [];

    for (const run of descriptionRunsList) {
        description += run.text || "";

        if (run.navigationEndpoint) {
            // Utilizamos el nav() que acabamos de crear con noneIfAbsent = true
            const link = nav(run, ["navigationEndpoint", "urlEndpoint", "url"], true);
            descriptionRuns.push({ text: run.text, url: link });
        } else {
            descriptionRuns.push({ text: run.text });
        }
    }

    return { description, descriptionRuns };
}