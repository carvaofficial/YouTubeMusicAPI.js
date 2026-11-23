/**
 * @fileoverview Parsers for mixed content (home, explore) and generic items.
 */

import {
    nav,
    DESCRIPTION_SHELF,
    RUN_TEXT,
    DESCRIPTION,
    CAROUSEL_TITLE,
    MTRIR,
    TITLE,
    NAVIGATION_BROWSE,
    PAGE_TYPE,
    NAVIGATION_WATCH_PLAYLIST_ID,
    MRLIR,
    MMRIR,
    SUBTITLE,
    SUBTITLE2,
    TITLE_TEXT,
    NAVIGATION_BROWSE_ID,
    THUMBNAIL_OVERLAY_NAVIGATION,
    THUMBNAIL_RENDERER,
    SUBTITLE_BADGE_LABEL,
    NAVIGATION_VIDEO_ID,
    NAVIGATION_PLAYLIST_ID,
    SUBTITLE_RUNS,
    TEXT_RUN_TEXT,
    TEXT_RUN,
    PLAY_BUTTON,
    NAVIGATION_VIDEO_TYPE,
    THUMBNAILS,
    BADGE_LABEL,
    WATCH_PLAYLIST_ID,
    TEXT_RUNS,
    MENU_ITEMS,
    MENU_SERVICE,
    QUEUE_VIDEO_ID
} from '../core/navigation.js';

import { parseArtistsRuns } from './artists.js';
import { parseAlbumPlaylistIdIfExists } from './albums.js';
import { parseSongRuns, parseSongRun } from './songs.js';
import { getFlexColumnItem, getDotSeparatorIndex, parseIdName } from './utils.js';
import { parseEpisode, parsePodcast } from './podcasts.js';

/**
 * Parses mixed content rows (e.g., from the Home page).
 * @param {Array} rows - List of row objects.
 * @returns {Array} List of dictionaries keyed with 'title' text and 'contents' list.
 */
export function parseMixedContent(rows) {
    const items = [];

    for (const row of rows) {
        let title, contentsRaw;

        if (DESCRIPTION_SHELF[0] in row) {
            const results = nav(row, DESCRIPTION_SHELF);
            title = nav(results, ["header", ...RUN_TEXT]);
            contentsRaw = nav(results, DESCRIPTION);
            // Si es un description shelf, contents es texto plano, no una lista de resultados
            items.push({ title, contents: contentsRaw });
            continue;
        } else {
            const results = Object.values(row)[0];
            if (!results.contents) continue;

            title = nav(results, [...CAROUSEL_TITLE, "text"]);
            const contents = [];

            for (const result of results.contents) {
                const dataMtrir = nav(result, [MTRIR], true);
                let content = null;

                if (dataMtrir) {
                    const pageType = nav(dataMtrir, [...TITLE, ...NAVIGATION_BROWSE, ...PAGE_TYPE], true);

                    if (pageType === null) { // song or watch_playlist
                        if (nav(dataMtrir, NAVIGATION_WATCH_PLAYLIST_ID, true) !== null) {
                            content = parseWatchPlaylist(dataMtrir);
                        } else {
                            content = parseSong(dataMtrir);
                        }
                    } else if (pageType === "MUSIC_PAGE_TYPE_ALBUM" || pageType === "MUSIC_PAGE_TYPE_AUDIOBOOK") {
                        content = parseAlbum(dataMtrir);
                    } else if (pageType === "MUSIC_PAGE_TYPE_ARTIST" || pageType === "MUSIC_PAGE_TYPE_USER_CHANNEL") {
                        content = parseRelatedArtist(dataMtrir);
                    } else if (pageType === "MUSIC_PAGE_TYPE_PLAYLIST") {
                        content = parsePlaylist(dataMtrir);
                    } else if (pageType === "MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE") {
                        content = parsePodcast(dataMtrir);
                    }
                } else {
                    const dataMrlir = nav(result, [MRLIR], true);
                    if (dataMrlir) {
                        content = parseSongFlat(dataMrlir);
                    } else {
                        const dataMmrir = nav(result, [MMRIR], true);
                        if (dataMmrir) {
                            content = parseEpisode(dataMmrir);
                        } else {
                            continue;
                        }
                    }
                }

                if (content) contents.push(content);
            }
            items.push({ title, contents });
        }
    }
    return items;
}

/**
 * Parses a generic list of contents using a specific parsing function.
 * @param {Array} results - The results list.
 * @param {Function} parseFunc - The parser function to apply.
 * @param {string} [key=MTRIR] - The key to extract from each result before parsing.
 * @returns {Array} List of parsed items.
 */
export function parseContentList(results, parseFunc, key = MTRIR) {
    if (!results || !Array.isArray(results)) return [];
    return results.map(result => parseFunc(result[key]));
}

/**
 * Helper to extract year or type from album/single subtitles.
 * @param {Object} result - Raw JSON.
 * @param {Object} albumOrSingle - Parsed object to update.
 * @returns {Object} Updated object.
 * @private
 */
function _parseAlbumSingleSubtitle(result, albumOrSingle) {
    const typeOrYear = nav(result, SUBTITLE, true);
    if (typeOrYear) {
        if (/^\d+$/.test(typeOrYear)) {
            albumOrSingle.year = typeOrYear;
        } else {
            albumOrSingle.type = typeOrYear;
            const year = nav(result, SUBTITLE2, true);
            if (year && /^\d+$/.test(year)) {
                albumOrSingle.year = year;
            }
        }
    }
    return albumOrSingle;
}

/**
 * Parses an album carousel item.
 * @param {Object} result - Raw JSON.
 * @returns {Object} Parsed album.
 */
export function parseAlbum(result) {
    const subtitleRuns = nav(result, ["subtitle", "runs"], true) || [];

    const album = {
        title: nav(result, TITLE_TEXT),
        artists: subtitleRuns
            .filter(x => "navigationEndpoint" in x)
            .map(x => parseIdName(x)),
        browseId: nav(result, [...TITLE, ...NAVIGATION_BROWSE_ID]),
        audioPlaylistId: parseAlbumPlaylistIdIfExists(nav(result, THUMBNAIL_OVERLAY_NAVIGATION, true)),
        thumbnails: nav(result, THUMBNAIL_RENDERER),
        isExplicit: nav(result, SUBTITLE_BADGE_LABEL, true) !== null,
    };

    return _parseAlbumSingleSubtitle(result, album);
}

/**
 * Parses a single carousel item.
 * @param {Object} result - Raw JSON.
 * @returns {Object} Parsed single.
 */
export function parseSingle(result) {
    const single = {
        title: nav(result, TITLE_TEXT),
        browseId: nav(result, [...TITLE, ...NAVIGATION_BROWSE_ID]),
        thumbnails: nav(result, THUMBNAIL_RENDERER),
    };

    return _parseAlbumSingleSubtitle(result, single);
}

/**
 * Parses a regular song carousel item.
 * @param {Object} result - Raw JSON.
 * @returns {Object} Parsed song.
 */
export function parseSong(result) {
    const song = {
        title: nav(result, TITLE_TEXT),
        videoId: nav(result, NAVIGATION_VIDEO_ID),
        playlistId: nav(result, NAVIGATION_PLAYLIST_ID, true),
        thumbnails: nav(result, THUMBNAIL_RENDERER),
    };
    Object.assign(song, parseSongRuns(nav(result, SUBTITLE_RUNS), true));
    return song;
}

/**
 * Parses a flat song item (usually from a list, not a carousel).
 * @param {Object} data - Raw JSON.
 * @param {boolean} [withPlaylistId=false] - Whether to extract playlist ID.
 * @returns {Object} Parsed song.
 */
export function parseSongFlat(data, withPlaylistId = false) {
    const columns = data.flexColumns ? data.flexColumns.map((_, i) => getFlexColumnItem(data, i)) : [];

    const song = {
        title: nav(columns[0], TEXT_RUN_TEXT),
        videoId: nav(columns[0], [...TEXT_RUN, ...NAVIGATION_VIDEO_ID], true),
        videoType: nav(data, [...PLAY_BUTTON, "playNavigationEndpoint", ...NAVIGATION_VIDEO_TYPE], true),
        thumbnails: nav(data, THUMBNAILS),
        isExplicit: nav(data, BADGE_LABEL, true) !== null,
    };

    if (withPlaylistId) {
        song.playlistId = nav(data, [...PLAY_BUTTON, "playNavigationEndpoint", ...WATCH_PLAYLIST_ID]);
    }

    const runs = nav(columns[1], TEXT_RUNS);
    Object.assign(song, parseSongRuns(runs, true));

    if (columns.length > 2 && columns[2] !== null && "navigationEndpoint" in nav(columns[2], TEXT_RUN, true)) {
        song.album = {
            name: nav(columns[2], TEXT_RUN_TEXT),
            id: nav(columns[2], [...TEXT_RUN, ...NAVIGATION_BROWSE_ID]),
        };
    }

    return song;
}

/**
 * Parses a video item.
 * @param {Object} result - Raw JSON.
 * @returns {Object} Parsed video.
 */
export function parseVideo(result) {
    const runs = nav(result, SUBTITLE_RUNS);
    const artistsLen = getDotSeparatorIndex(runs);

    let videoId = nav(result, NAVIGATION_VIDEO_ID, true);
    if (!videoId) {
        const menuItems = nav(result, MENU_ITEMS) || [];
        for (const entry of menuItems) {
            const vId = nav(entry, [...MENU_SERVICE, ...QUEUE_VIDEO_ID], true);
            if (vId) {
                videoId = vId;
                break;
            }
        }
    }

    let views = null;
    if (runs && runs.length > 0) {
        const lastRunText = runs[runs.length - 1].text;
        views = lastRunText ? lastRunText.split(" ")[0] : null;
    }

    return {
        title: nav(result, TITLE_TEXT),
        videoId: videoId,
        artists: parseArtistsRuns(runs ? runs.slice(0, artistsLen) : []),
        playlistId: nav(result, NAVIGATION_PLAYLIST_ID, true),
        thumbnails: nav(result, THUMBNAIL_RENDERER, true),
        views: views,
    };
}

/**
 * Parses a playlist item.
 * @param {Object} data - Raw JSON.
 * @returns {Object} Parsed playlist.
 */
export function parsePlaylist(data) {
    const playlist = {
        title: nav(data, TITLE_TEXT, true), // none_if_absent=True
        playlistId: nav(data, [...TITLE, ...NAVIGATION_BROWSE_ID]).substring(2),
        thumbnails: nav(data, THUMBNAIL_RENDERER),
    };

    const subtitle = data.subtitle;
    if (subtitle && subtitle.runs) {
        playlist.description = subtitle.runs.map(run => run.text).join("");

        const subtitle2Text = nav(data, SUBTITLE2, true);
        if (subtitle.runs.length === 3 && subtitle2Text && /\d+ /.test(subtitle2Text)) {
            playlist.count = subtitle2Text.split(" ")[0];
            playlist.author = parseArtistsRuns(subtitle.runs.slice(0, 1));
        }
    }

    return playlist;
}

/**
 * Parses a related artist item.
 * @param {Object} data - Raw JSON.
 * @returns {Object} Parsed artist.
 */
export function parseRelatedArtist(data) {
    let subscribers = nav(data, SUBTITLE, true);
    if (subscribers) {
        subscribers = subscribers.split(" ")[0];
    }
    return {
        title: nav(data, TITLE_TEXT),
        browseId: nav(data, [...TITLE, ...NAVIGATION_BROWSE_ID]),
        subscribers: subscribers,
        thumbnails: nav(data, THUMBNAIL_RENDERER),
    };
}

/**
 * Parses a watch playlist item.
 * @param {Object} data - Raw JSON.
 * @returns {Object} Parsed watch playlist.
 */
export function parseWatchPlaylist(data) {
    return {
        title: nav(data, TITLE_TEXT),
        playlistId: nav(data, NAVIGATION_WATCH_PLAYLIST_ID),
        thumbnails: nav(data, THUMBNAIL_RENDERER),
    };
}