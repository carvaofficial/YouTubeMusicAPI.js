/**
 * @fileoverview Parsers for search results, suggestions, and parameter generation.
 */

import {
    nav,
    SUBTITLE,
    CARD_SHELF_TITLE,
    SUBTITLE2,
    WATCH_VIDEO_ID,
    NAVIGATION_VIDEO_TYPE,
    TITLE_TEXT,
    TITLE,
    NAVIGATION_BROWSE_ID,
    MENU_PLAYLIST_ID,
    THUMBNAIL_OVERLAY_NAVIGATION,
    SUBTITLE_RUNS,
    THUMBNAILS,
    PLAY_BUTTON,
    TEXT_RUNS,
    NAVIGATION_VIDEO_ID,
    NAVIGATION_PLAYLIST_ID,
    MRLIR,
    BADGE_LABEL
} from '../core/navigation.js';

import { toInt } from '../core/helpers.js';
import { getFlexColumnItem, getItemText, parseMenuPlaylists, parseIdName } from './utils.js';
import { parseAlbumPlaylistIdIfExists } from './albums.js';
import { parseArtistsRuns } from './artists.js';
import { parseSongRuns, parseSongMenuData } from './songs.js';

export const ALL_RESULT_TYPES = [
    "album",
    "artist",
    "playlist",
    "song",
    "video",
    "station",
    "profile",
    "podcast",
    "episode"
];

export const API_RESULT_TYPES = ["single", "ep", ...ALL_RESULT_TYPES];

/**
 * Maps the localized result type to the standard English result type.
 * @param {string|null} resultTypeLocal - The localized subtitle text.
 * @param {Array<string>} resultTypesLocal - The list of localized result types.
 * @returns {string|null} The standard result type (e.g., "album").
 */
export function getSearchResultType(resultTypeLocal, resultTypesLocal) {
    if (!resultTypeLocal) return null;

    const lowerLocal = resultTypeLocal.toLowerCase();

    // Default to album since it's labeled with multiple values ('Single', 'EP', etc.)
    if (!resultTypesLocal.includes(lowerLocal)) {
        return "album";
    }

    const index = resultTypesLocal.indexOf(lowerLocal);
    return ALL_RESULT_TYPES[index];
}

/**
 * Parses the "Top Result" card in search.
 * @param {Object} data - Raw JSON data.
 * @param {Array<string>} searchResultTypes - Localized search result types.
 * @returns {Object} Parsed top result.
 */
export function parseTopResult(data, searchResultTypes) {
    const resultType = getSearchResultType(nav(data, SUBTITLE, true), searchResultTypes);
    const category = nav(data, CARD_SHELF_TITLE, true) || "Top result";

    const searchResult = { category, resultType };

    if (resultType === "artist") {
        const subscribers = nav(data, SUBTITLE2, true);
        if (subscribers) {
            searchResult.subscribers = subscribers.split(" ")[0];
        }
        const artistInfo = parseSongRuns(nav(data, ["title", "runs"], true) || []);
        Object.assign(searchResult, artistInfo);
    }

    if (resultType === "song" || resultType === "video") {
        const onTap = data.onTap;
        if (onTap) {
            searchResult.videoId = nav(onTap, WATCH_VIDEO_ID, true);
            searchResult.videoType = nav(onTap, NAVIGATION_VIDEO_TYPE, true);
        }
    }

    if (["song", "video", "album"].includes(resultType)) {
        searchResult.videoId = nav(data, ["onTap", ...WATCH_VIDEO_ID], true) || searchResult.videoId;
        searchResult.videoType = nav(data, ["onTap", ...NAVIGATION_VIDEO_TYPE], true) || searchResult.videoType;

        searchResult.title = nav(data, TITLE_TEXT, true);
        const runs = nav(data, ["subtitle", "runs"], true) || [];
        const songInfo = parseSongRuns(runs.slice(2));
        Object.assign(searchResult, songInfo);
    }

    if (resultType === "album") {
        searchResult.browseId = nav(data, [...TITLE, ...NAVIGATION_BROWSE_ID], true);
        const buttonCommand = nav(data, ["buttons", 0, "buttonRenderer", "command"], true);
        searchResult.playlistId = parseAlbumPlaylistIdIfExists(buttonCommand);
    }

    if (resultType === "playlist") {
        searchResult.playlistId = nav(data, MENU_PLAYLIST_ID, true);
        searchResult.title = nav(data, TITLE_TEXT, true);
        const runs = nav(data, ["subtitle", "runs"], true) || [];
        searchResult.author = parseArtistsRuns(runs.slice(2));
    }

    if (resultType === "episode") {
        searchResult.title = nav(data, TITLE_TEXT, true);
        searchResult.videoId = nav(data, [...THUMBNAIL_OVERLAY_NAVIGATION, ...WATCH_VIDEO_ID], true);
        searchResult.videoType = nav(data, [...THUMBNAIL_OVERLAY_NAVIGATION, ...NAVIGATION_VIDEO_TYPE], true);

        const runs = nav(data, SUBTITLE_RUNS, true) || [];
        if (runs.length > 2) {
            searchResult.date = runs[0].text;
            searchResult.podcast = parseIdName(runs[2]);
        }
    }

    searchResult.thumbnails = nav(data, THUMBNAILS, true);
    return searchResult;
}

/**
 * Parses a generic search result item.
 * @param {Object} data - Raw JSON data.
 * @param {string|null} resultType - The predefined result type, if any.
 * @param {string|null} category - The category title.
 * @returns {Object} Parsed search result.
 */
export function parseSearchResult(data, resultType, category) {
    const defaultOffset = (!resultType || resultType === "album") ? 2 : 0;
    const searchResult = { category };
    const videoType = nav(data, [...PLAY_BUTTON, "playNavigationEndpoint", ...NAVIGATION_VIDEO_TYPE], true);

    // Determine result type based on browseId
    if (!resultType) {
        const browseId = nav(data, NAVIGATION_BROWSE_ID, true);
        if (browseId) {
            const mapping = {
                "VM": "playlist", "RD": "playlist", "VL": "playlist",
                "MPLA": "artist", "MPRE": "album", "MPSP": "podcast",
                "MPED": "episode", "UC": "artist"
            };
            resultType = Object.keys(mapping).find(prefix => browseId.startsWith(prefix));
            if (resultType) resultType = mapping[resultType];
        } else {
            resultType = {
                "MUSIC_VIDEO_TYPE_ATV": "song",
                "MUSIC_VIDEO_TYPE_PODCAST_EPISODE": "episode"
            }[videoType || ""] || "video";
        }
    }

    searchResult.resultType = resultType;

    if (resultType !== "artist") {
        searchResult.title = getItemText(data, 0);
    }

    if (resultType === "artist") {
        searchResult.artist = getItemText(data, 0);
        parseMenuPlaylists(data, searchResult);
    } else if (resultType === "album") {
        searchResult.type = getItemText(data, 1);
        const playNavigation = nav(data, [...PLAY_BUTTON, "playNavigationEndpoint"], true);
        searchResult.playlistId = parseAlbumPlaylistIdIfExists(playNavigation);
    } else if (resultType === "playlist") {
        const flexItem = nav(getFlexColumnItem(data, 1), TEXT_RUNS, true) || [];
        const hasAuthor = flexItem.length === defaultOffset + 3;

        const itemInfoText = (getItemText(data, 1, hasAuthor ? 2 : 0) || "").split(" ");
        searchResult.itemCount = (itemInfoText.length >= 2 && itemInfoText[1] === "songs") ? itemInfoText[0] : null;

        if (searchResult.itemCount && /^\d+$/.test(searchResult.itemCount)) {
            searchResult.itemCount = toInt(searchResult.itemCount);
        }
        searchResult.author = !hasAuthor ? null : getItemText(data, 1, defaultOffset);
    } else if (resultType === "station") {
        searchResult.videoId = nav(data, NAVIGATION_VIDEO_ID, true);
        searchResult.playlistId = nav(data, NAVIGATION_PLAYLIST_ID, true);
    } else if (resultType === "profile") {
        searchResult.name = getItemText(data, 1, 2, true);
    } else if (resultType === "song") {
        searchResult.album = null;
        Object.assign(searchResult, parseSongMenuData(data));
    } else if (resultType === "upload") {
        const browseId = nav(data, NAVIGATION_BROWSE_ID, true);
        if (!browseId) { // song result
            const flexItems = [
                nav(getFlexColumnItem(data, 0), ["text", "runs"], true),
                nav(getFlexColumnItem(data, 1), ["text", "runs"], true)
            ];

            if (flexItems[0] && flexItems[0][0]) {
                searchResult.videoId = nav(flexItems[0][0], NAVIGATION_VIDEO_ID, true);
                searchResult.playlistId = nav(flexItems[0][0], NAVIGATION_PLAYLIST_ID, true);
            }
            if (flexItems[1]) {
                Object.assign(searchResult, parseSongRuns(flexItems[1]));
            }
            searchResult.resultType = "song";
        } else { // artist or album result
            searchResult.browseId = browseId;
            if (searchResult.browseId.includes("artist")) {
                searchResult.resultType = "artist";
            } else {
                const flexItem2 = getFlexColumnItem(data, 1);
                const runs = flexItem2 ? flexItem2.text.runs.filter((_, i) => i % 2 === 0).map(run => run.text) : [];

                if (runs.length > 1) {
                    searchResult.artist = runs[1];
                }
                if (runs.length > 2) {
                    searchResult.releaseDate = runs[2];
                }
                searchResult.resultType = "album";
            }
        }
    }

    if (["song", "video", "episode"].includes(resultType)) {
        searchResult.videoId = nav(data, [...PLAY_BUTTON, "playNavigationEndpoint", "watchEndpoint", "videoId"], true);
        searchResult.videoType = videoType;
    }

    if (["song", "video", "album"].includes(resultType)) {
        searchResult.duration = null;
        searchResult.year = null;

        const flexItem = getFlexColumnItem(data, 1);
        if (!flexItem) throw new Error("Expected flex column item at index 1");

        const runs = [...flexItem.text.runs];
        const flexItem2 = getFlexColumnItem(data, 2);
        if (flexItem2) {
            runs.push({ text: "" }, ...flexItem2.text.runs);
        }

        Object.assign(searchResult, parseSongRuns(runs, true));
    }

    if (["artist", "album", "playlist", "profile", "podcast"].includes(resultType)) {
        searchResult.browseId = nav(data, NAVIGATION_BROWSE_ID, true);
    }

    if (["song", "album"].includes(resultType)) {
        searchResult.isExplicit = nav(data, BADGE_LABEL, true) !== null;
    }

    if (resultType === "episode") {
        const flexItem = getFlexColumnItem(data, 1);
        const runs = nav(flexItem, TEXT_RUNS, true) || [];
        const slicedRuns = runs.slice(defaultOffset);
        const hasDate = slicedRuns.length > 1 ? 1 : 0;

        searchResult.live = nav(data, ["badges", 0, "liveBadgeRenderer"], true) !== null;
        if (hasDate) {
            searchResult.date = slicedRuns[0].text;
        }

        if (slicedRuns[hasDate * 2]) {
            searchResult.podcast = parseIdName(slicedRuns[hasDate * 2]);
        }
    }

    searchResult.thumbnails = nav(data, THUMBNAILS, true);

    return searchResult;
}

/**
 * Parses an array of search results.
 * @param {Array} results - Raw JSON list of results.
 * @param {string|null} [resultType=null] - Predefined result type.
 * @param {string|null} [category=null] - Predefined category.
 * @returns {Array} List of parsed results.
 */
export function parseSearchResults(results, resultType = null, category = null) {
    if (!results || !Array.isArray(results)) return [];
    return results.map(result => parseSearchResult(result[MRLIR], resultType, category));
}

/**
 * Helper to get the base64 param code for a specific filter.
 * @param {string} filter 
 * @returns {string} Base64 part.
 * @private
 */
function _getParam2(filter) {
    const filterParams = {
        "songs": "II", "videos": "IQ", "albums": "IY", "artists": "Ig",
        "playlists": "Io", "profiles": "JY", "podcasts": "JQ", "episodes": "JI"
    };
    return filterParams[filter];
}

/**
 * Get search params for search query string based on user input.
 * @param {string|null} filter - The search filter (e.g., "songs", "albums").
 * @param {string|null} scope - The search scope (e.g., "uploads", "library").
 * @param {boolean} ignoreSpelling - If spelling shall be ignored.
 * @returns {string|null} Search param string.
 */
export function getSearchParams(filter, scope, ignoreSpelling) {
    const filteredParam1 = "EgWKAQ";
    let params = null;
    let param1, param2, param3;

    if (!filter && !scope && !ignoreSpelling) {
        return params;
    }

    if (scope === "uploads") params = "agIYAw%3D%3D";

    if (scope === "library") {
        if (filter) {
            param1 = filteredParam1;
            param2 = _getParam2(filter);
            param3 = "AWoKEAUQCRADEAoYBA%3D%3D";
        } else {
            params = "agIYBA%3D%3D";
        }
    }

    if (!scope && filter) {
        if (filter === "playlists") {
            params = "Eg-KAQwIABAAGAAgACgB";
            params += !ignoreSpelling ? "MABqChAEEAMQCRAFEAo%3D" : "MABCAggBagoQBBADEAkQBRAK";
        } else if (filter.includes("playlists")) {
            param1 = "EgeKAQQoA";
            param2 = filter === "featured_playlists" ? "Dg" : "EA";
            param3 = !ignoreSpelling ? "BagwQDhAKEAMQBBAJEAU%3D" : "BQgIIAWoMEA4QChADEAQQCRAF";
        } else {
            param1 = filteredParam1;
            param2 = _getParam2(filter);
            param3 = !ignoreSpelling ? "AWoMEA4QChADEAQQCRAF" : "AUICCAFqDBAOEAoQAxAEEAkQBQ%3D%3D";
        }
    }

    if (!scope && !filter && ignoreSpelling) {
        params = "EhGKAQ4IARABGAEgASgAOAFAAUICCAE%3D";
    }

    return params ? params : param1 + param2 + param3;
}

/**
 * Parses search suggestions.
 * @param {Object} results - Raw JSON data.
 * @param {boolean} detailedRuns - Whether to return full run data or just text.
 * @returns {Array<string|Object>} List of suggestions.
 */
export function parseSearchSuggestions(results, detailedRuns) {
    if (!results?.contents?.[0]?.searchSuggestionsSectionRenderer?.contents) {
        return [];
    }

    const rawSuggestions = results.contents[0].searchSuggestionsSectionRenderer.contents;
    const suggestions = [];

    for (const rawSuggestion of rawSuggestions) {
        let feedbackToken = null;
        let suggestionContent;

        if ("historySuggestionRenderer" in rawSuggestion) {
            suggestionContent = rawSuggestion.historySuggestionRenderer;
            feedbackToken = nav(suggestionContent, ["serviceEndpoint", "feedbackEndpoint", "feedbackToken"], true);
        } else {
            suggestionContent = rawSuggestion.searchSuggestionRenderer;
        }

        const text = suggestionContent.navigationEndpoint.searchEndpoint.query;
        const runs = suggestionContent.suggestion.runs;

        if (detailedRuns) {
            suggestions.push({
                text,
                runs,
                fromHistory: feedbackToken !== null,
                feedbackToken
            });
        } else {
            suggestions.push(text);
        }
    }

    return suggestions;
}