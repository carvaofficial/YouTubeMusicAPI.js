/**
 * @fileoverview Parsers for podcasts and episodes.
 */

import {
    nav,
    RUN_TEXT,
    NAVIGATION_BROWSE_ID,
    TITLE_TEXT,
    THUMBNAILS,
    DESCRIPTION_SHELF,
    DESCRIPTION,
    TOGGLED_BUTTON,
    SUBTITLE,
    MNIR,
    ICON_TYPE,
    TITLE,
    WATCH_VIDEO_ID,
    NAVIGATION_VIDEO_TYPE,
    TEXT_RUN_TEXT,
    TEXT_RUN,
    PLAY_BUTTON,
    WATCH_PLAYLIST_ID,
    SUBTITLE_RUNS,
    THUMBNAIL_OVERLAY,
    THUMBNAIL_RENDERER
} from '../core/navigation.js';

import { getFlexColumnItem, parseIdName } from './utils.js';

const PROGRESS_RENDERER = ["musicPlaybackProgressRenderer"];
const DURATION_TEXT = ["durationText", "runs", 1, "text"];

/**
 * Represents a parsed description containing text, links, and timestamps.
 */
export class Description {
    constructor(elements) {
        this.elements = elements || [];
    }

    /**
     * Reconstructs the full text from the elements.
     * @returns {string}
     */
    get text() {
        return this.elements.map(e => e.text).join("");
    }

    /**
     * Parses the description runs into a usable format.
     * @param {Array} descriptionRuns - The original description runs.
     * @returns {Description} Object containing parsed elements.
     */
    static fromRuns(descriptionRuns) {
        if (!descriptionRuns || !Array.isArray(descriptionRuns)) {
            return new Description([]);
        }

        const elements = [];
        for (const run of descriptionRuns) {
            const navigationEndpoint = nav(run, ["navigationEndpoint"], true);

            if (navigationEndpoint) {
                if ("urlEndpoint" in navigationEndpoint) {
                    elements.push({
                        type: "link",
                        text: run.text,
                        url: navigationEndpoint.urlEndpoint.url
                    });
                } else if ("watchEndpoint" in navigationEndpoint) {
                    elements.push({
                        type: "timestamp",
                        text: run.text,
                        seconds: nav(navigationEndpoint, ["watchEndpoint", "startTimeSeconds"])
                    });
                }
            } else {
                elements.push({
                    type: "text",
                    text: nav(run, ["text"], true) || ""
                });
            }
        }

        return new Description(elements);
    }
}

/**
 * Parses common left hand side (header) items of an episode or podcast page.
 * @param {Object} header - Raw JSON header.
 * @returns {Object} Parsed base header.
 */
export function parseBaseHeader(header) {
    const strapline = nav(header, ["straplineTextOne"], true);

    const author = {
        name: nav(strapline, RUN_TEXT, true),
        id: nav(strapline, ["runs", 0, ...NAVIGATION_BROWSE_ID], true),
    };

    return {
        author: author.name ? author : null,
        title: nav(header, TITLE_TEXT),
        thumbnails: nav(header, THUMBNAILS),
    };
}

/**
 * Parses the header of a podcast page.
 * @param {Object} header - Raw JSON header.
 * @returns {Object} Parsed podcast header.
 */
export function parsePodcastHeader(header) {
    const metadata = parseBaseHeader(header);
    metadata.description = nav(header, ["description", ...DESCRIPTION_SHELF, ...DESCRIPTION], true);
    metadata.saved = nav(header, ["buttons", 1, ...TOGGLED_BUTTON], true);

    return metadata;
}

/**
 * Parses the header of an episode page.
 * @param {Object} header - Raw JSON header.
 * @returns {Object} Parsed episode header.
 */
export function parseEpisodeHeader(header) {
    const metadata = parseBaseHeader(header);
    metadata.date = nav(header, SUBTITLE, true);

    const progressRenderer = nav(header, ["progress", ...PROGRESS_RENDERER], true);
    metadata.duration = nav(progressRenderer, DURATION_TEXT, true);
    metadata.progressPercentage = nav(progressRenderer, ["playbackProgressPercentage"], true);
    metadata.saved = nav(header, ["buttons", 0, ...TOGGLED_BUTTON], true) || false;

    metadata.playlistId = null;
    const menuButtons = nav(header, ["buttons", -1, "menuRenderer", "items"], true) || [];

    for (const button of menuButtons) {
        if (nav(button, [MNIR, ...ICON_TYPE], true) === "BROADCAST") {
            metadata.playlistId = nav(button, [MNIR, ...NAVIGATION_BROWSE_ID], true);
            break;
        }
    }

    return metadata;
}

/**
 * Parses a single episode under "Episodes" on a channel page or on a podcast page.
 * @param {Object} data - Raw JSON data.
 * @returns {Object} Parsed episode.
 */
export function parseEpisode(data) {
    return {
        index: nav(data, ["onTap", "watchEndpoint", "index"], true),
        title: nav(data, TITLE_TEXT),
        description: nav(data, DESCRIPTION, true),
        duration: nav(data, ["playbackProgress", ...PROGRESS_RENDERER, ...DURATION_TEXT], true),
        videoId: nav(data, ["onTap", ...WATCH_VIDEO_ID], true),
        browseId: nav(data, [...TITLE, ...NAVIGATION_BROWSE_ID], true),
        videoType: nav(data, ["onTap", ...NAVIGATION_VIDEO_TYPE], true),
        date: nav(data, SUBTITLE, true),
        thumbnails: nav(data, THUMBNAILS),
    };
}

/**
 * Parses a flat episode (e.g., from trending or search results).
 * @param {Object} data - Raw JSON data.
 * @returns {Object} Parsed flat episode.
 */
export function parseEpisodeFlat(data) {
    return {
        title: nav(getFlexColumnItem(data, 0), TEXT_RUN_TEXT, true),
        podcast: parseIdName(nav(getFlexColumnItem(data, 1), TEXT_RUN, true)),
        videoId: nav(data, ["playlistItemData", "videoId"], true),
        browseId: nav(getFlexColumnItem(data, 0), [...TEXT_RUN, ...NAVIGATION_BROWSE_ID], true),
        playlistId: nav(data, [...PLAY_BUTTON, "playNavigationEndpoint", ...WATCH_PLAYLIST_ID], true),
        videoType: nav(data, [...PLAY_BUTTON, "playNavigationEndpoint", ...NAVIGATION_VIDEO_TYPE], true),
        date: nav(getFlexColumnItem(data, 2), TEXT_RUN_TEXT, true),
        thumbnails: nav(data, THUMBNAILS, true),
    };
}

/**
 * Parses a single podcast under "Podcasts" on a channel page.
 * @param {Object} data - Raw JSON data.
 * @returns {Object} Parsed podcast.
 */
export function parsePodcast(data) {
    return {
        title: nav(data, TITLE_TEXT),
        channel: parseIdName(nav(data, [...SUBTITLE_RUNS, 0], true)),
        browseId: nav(data, [...TITLE, ...NAVIGATION_BROWSE_ID], true),
        podcastId: nav(data, THUMBNAIL_OVERLAY, true),
        thumbnails: nav(data, THUMBNAIL_RENDERER, true),
    };
}