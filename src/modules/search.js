/**
 * @fileoverview Search mixin for YTMusic client (search, suggestions, and history management).
 */

import {
    nav,
    SECTION_LIST,
    MRLIR,
    TEXT_RUN_TEXT,
    TITLE_TEXT,
    MUSIC_SHELF
} from '../core/navigation.js';

import { getContinuations } from '../core/continuations.js';
import { YTMusicUserError } from '../core/exceptions.js';
import {
    getSearchParams,
    parseTopResult,
    parseSearchResults,
    parseSearchSuggestions
} from '../parsers/search.js';

const VALID_FILTERS = [
    "albums",
    "artists",
    "playlists",
    "community_playlists",
    "featured_playlists",
    "songs",
    "videos",
    "profiles",
    "podcasts",
    "episodes"
];

const VALID_SCOPES = ["library", "uploads"];

/**
 * Mixin containing search-related methods for YouTube Music.
 */
export const SearchMixin = {
    /**
     * Search YouTube Music. Returns results within the provided category.
     * @param {string} query - Query string, e.g. 'Oasis Wonderwall'.
     * @param {string|null} [filter=null] - Filter for item types.
     * @param {string|null} [scope=null] - Search scope ('library', 'uploads').
     * @param {number} [limit=20] - Number of search results to return.
     * @param {boolean} [ignoreSpelling=false] - Whether to ignore YTM spelling suggestions.
     * @returns {Promise<Array>} List of results.
     */
    async search(query, filter = null, scope = null, limit = 20, ignoreSpelling = false) {
        const body = { query };
        const endpoint = "search";
        const searchResults = [];

        if (filter && !VALID_FILTERS.includes(filter)) {
            throw new YTMusicUserError(
                "Invalid filter provided. Please use one of the following filters or leave out the parameter: " +
                VALID_FILTERS.join(", ")
            );
        }

        if (scope && !VALID_SCOPES.includes(scope)) {
            throw new YTMusicUserError(
                "Invalid scope provided. Please use one of the following scopes or leave out the parameter: " +
                VALID_SCOPES.join(", ")
            );
        }

        if (scope === "uploads" && filter) {
            throw new YTMusicUserError(
                "No filter can be set when searching uploads. Please unset the filter parameter when scope is set to uploads."
            );
        }

        if (scope === "library" && (filter === "community_playlists" || filter === "featured_playlists")) {
            throw new YTMusicUserError(
                `${filter} cannot be set when searching library. Please use one of the valid filters or leave out the parameter.`
            );
        }

        const params = getSearchParams(filter, scope, ignoreSpelling);
        if (params) {
            body.params = params;
        }

        const response = await this._sendRequest(endpoint, body);

        if (!response.contents) {
            return searchResults;
        }

        let results;
        if (response.contents.tabbedSearchResultsRenderer) {
            const tabIndex = (!scope || filter) ? 0 : VALID_SCOPES.indexOf(scope) + 1;
            results = response.contents.tabbedSearchResultsRenderer.tabs[tabIndex].tabRenderer.content;
        } else {
            results = response.contents;
        }

        const sectionList = nav(results, SECTION_LIST, true) || [];
        if (sectionList.length === 1 && "itemSectionRenderer" in sectionList[0]) {
            return searchResults;
        }

        let internalFilter = filter;
        let resultType = null;
        if (internalFilter && internalFilter.includes("playlists")) {
            internalFilter = "playlists";
        } else if (scope === "uploads") {
            internalFilter = "uploads";
            resultType = "upload";
        }

        for (const res of sectionList) {
            let category = null;
            let shelfContents = null;

            if (res.musicCardShelfRenderer) {
                const topResult = parseTopResult(
                    res.musicCardShelfRenderer,
                    this.parser.getSearchResultTypes((text) => this._(text))
                );
                searchResults.push(topResult);

                shelfContents = nav(res, ["musicCardShelfRenderer", "contents"], true);
                if (!shelfContents) continue;

                if (shelfContents[0].messageRenderer) {
                    const msgItem = shelfContents.shift();
                    category = nav(msgItem, ["messageRenderer", ...TEXT_RUN_TEXT], true);
                }
            } else if (res.musicShelfRenderer) {
                shelfContents = res.musicShelfRenderer.contents;
                if (!shelfContents || shelfContents.length === 0 || !(MRLIR in shelfContents[0])) {
                    continue;
                }
                category = nav(res, [...MUSIC_SHELF, ...TITLE_TEXT], true);
            } else if (res.itemSectionRenderer) {
                shelfContents = res.itemSectionRenderer.contents;
                if (!shelfContents || shelfContents.length === 0 || !(MRLIR in shelfContents[0])) {
                    continue;
                }
            } else {
                continue;
            }

            if (
                (res.musicShelfRenderer || res.itemSectionRenderer) &&
                internalFilter &&
                scope !== "uploads"
            ) {
                const expectedCategory = this._(internalFilter.slice(0, -1));
                if (category && !category.toLowerCase().includes(expectedCategory.toLowerCase())) {
                    continue;
                }
                resultType = internalFilter.slice(0, -1).toLowerCase();
            }

            searchResults.push(...parseSearchResults(shelfContents, resultType, category));

            if (internalFilter && res.musicShelfRenderer) {
                const requestFunc = (additionalParams) => this._sendRequest(endpoint, body, additionalParams);
                const parseFunc = (contents) => parseSearchResults(contents, resultType, category);

                const continuations = await getContinuations(
                    res.musicShelfRenderer,
                    "musicShelfContinuation",
                    limit - searchResults.length,
                    requestFunc,
                    parseFunc
                );
                searchResults.push(...continuations);
            }
        }

        return searchResults;
    },

    /**
     * Get search suggestions.
     * @param {string} query - Query string, i.e. 'faded'.
     * @param {boolean} [detailedRuns=false] - Whether to return detailed runs of each suggestion.
     * @returns {Promise<Array>} A list of search suggestions.
     */
    async getSearchSuggestions(query, detailedRuns = false) {
        const body = { input: query };
        const endpoint = "music/get_search_suggestions";
        const response = await this._sendRequest(endpoint, body);
        return parseSearchSuggestions(response, detailedRuns);
    },

    /**
     * Remove search suggestions from the user search history.
     * @param {Array} suggestions - Suggestions obtained from getSearchSuggestions(detailed_runs=true).
     * @param {Array<number>} [indices=null] - Optional indices of suggestions to remove.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async removeSearchSuggestions(suggestions, indices = null) {
        if (!suggestions.some(run => run.fromHistory)) {
            throw new YTMusicUserError(
                "No search result from history provided. Please run getSearchSuggestions first."
            );
        }

        if (!indices) {
            indices = Array.from({ length: suggestions.length }, (_, i) => i);
        }

        if (indices.some(index => index >= suggestions.length)) {
            throw new YTMusicUserError("Index out of range. Index must be smaller than the length of suggestions.");
        }

        const feedbackTokens = indices.map(index => suggestions[index].feedbackToken).filter(Boolean);
        if (feedbackTokens.length === 0) {
            return false;
        }

        const body = { feedbackTokens };
        const endpoint = "feedback";
        const response = await this._sendRequest(endpoint, body);

        return Boolean(nav(response, ["feedbackResponses", 0, "isProcessed"], true));
    }
};