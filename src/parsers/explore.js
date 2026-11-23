/**
 * @fileoverview Parsers for explore and charts data.
 */

import {
    nav,
    PLAY_BUTTON,
    NAVIGATION_VIDEO_TYPE,
    TITLE_TEXT,
    TITLE,
    NAVIGATION_BROWSE_ID,
    THUMBNAIL_RENDERER,
    PROGRESS_RENDERER,
    DURATION_TEXT,
    TEXT_RUN_TEXT,
    THUMBNAILS,
    ICON_TYPE
} from '../core/navigation.js';

import { parseSongFlat } from './browsing.js';
import { parseEpisode, parseEpisodeFlat } from './podcasts.js';
import { getFlexColumnItem, parseIdName } from './utils.js';

const TRENDS = {
    "ARROW_DROP_UP": "up",
    "ARROW_DROP_DOWN": "down",
    "ARROW_CHART_NEUTRAL": "neutral"
};

/**
 * Parses a song item from a chart.
 * @param {Object} data - Raw JSON data.
 * @returns {Object} Parsed chart song.
 */
export function parseChartSong(data) {
    const parsed = parseSongFlat(data, true); // withPlaylistId = true
    Object.assign(parsed, parseRanking(data, false));
    return parsed;
}

/**
 * Parses a trending item (can be a song or a podcast episode).
 * @param {Object} data - Raw JSON data.
 * @returns {Object} Parsed trending item.
 */
export function parseTrendingItem(data) {
    const videoType = nav(data, [...PLAY_BUTTON, "playNavigationEndpoint", ...NAVIGATION_VIDEO_TYPE], true);

    if (videoType === "MUSIC_VIDEO_TYPE_PODCAST_EPISODE") {
        return parseEpisodeFlat(data);
    }

    return parseSongFlat(data, true);
}

/**
 * Parses a playlist item from a chart.
 * @param {Object} data - Raw JSON data.
 * @returns {Object} Parsed chart playlist.
 */
export function parseChartPlaylist(data) {
    return {
        title: nav(data, TITLE_TEXT),
        playlistId: nav(data, [...TITLE, ...NAVIGATION_BROWSE_ID]).substring(2),
        thumbnails: nav(data, THUMBNAIL_RENDERER)
    };
}

/**
 * Parses an episode item from a chart.
 * @param {Object} data - Raw JSON data.
 * @returns {Object} Parsed chart episode.
 */
export function parseChartEpisode(data) {
    const episode = parseEpisode(data);

    delete episode.index;

    const secondTitleRuns = nav(data, ["secondTitle", "runs", 0], true);
    if (secondTitleRuns) {
        episode.podcast = parseIdName(secondTitleRuns);
    }

    episode.duration = nav(data, ["playbackProgress", ...PROGRESS_RENDERER, ...DURATION_TEXT], true);
    return episode;
}

/**
 * Parses an artist item from a chart.
 * @param {Object} data - Raw JSON data.
 * @returns {Object} Parsed chart artist.
 */
export function parseChartArtist(data) {
    let subscribers = getFlexColumnItem(data, 1);
    if (subscribers) {
        subscribers = nav(subscribers, TEXT_RUN_TEXT).split(" ")[0];
    }

    const parsed = {
        title: nav(getFlexColumnItem(data, 0), TEXT_RUN_TEXT),
        browseId: nav(data, NAVIGATION_BROWSE_ID),
        subscribers: subscribers || null,
        thumbnails: nav(data, THUMBNAILS)
    };

    Object.assign(parsed, parseRanking(data, true));
    return parsed;
}

/**
 * Parses the ranking (rank and trend) of a chart item.
 * @param {Object} data - Raw JSON data.
 * @param {boolean} noneIfAbsent - Whether to return null silently if missing.
 * @returns {Object} Object with rank and trend.
 */
export function parseRanking(data, noneIfAbsent) {
    const trendIconType = nav(
        data,
        ["customIndexColumn", "musicCustomIndexColumnRenderer", ...ICON_TYPE],
        noneIfAbsent
    );

    return {
        rank: nav(
            data,
            ["customIndexColumn", "musicCustomIndexColumnRenderer", ...TEXT_RUN_TEXT],
            noneIfAbsent
        ),
        trend: trendIconType ? TRENDS[trendIconType] : null
    };
}