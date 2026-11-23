/**
 * @fileoverview Parsers for playlists and playlist items.
 */

import {
    nav,
    HEADER,
    EDITABLE_PLAYLIST_DETAIL_HEADER,
    HEADER_DETAIL,
    TWO_COLUMN_RENDERER,
    TAB_CONTENT,
    SECTION_LIST_ITEM,
    RESPONSIVE_HEADER,
    THUMBNAIL_CROPPED,
    DESCRIPTION_SHELF,
    DESCRIPTION,
    SUBTITLE2,
    THUMBNAILS,
    SECTION,
    CONTENT,
    MRLIR,
    MENU_ITEMS,
    MENU_SERVICE,
    MNIR,
    NAVIGATION_BROWSE_ID,
    PLAY_BUTTON,
    MENU_LIKE_STATUS,
    TEXT_RUN,
    TEXT_RUN_TEXT,
    NAVIGATION_VIDEO_TYPE,
    ENGAGEMENT_BAR,
    BADGE_LABEL,
    WATCH_PLAYLIST_ID
} from '../core/navigation.js';

import { getContinuations2025 } from '../core/continuations.js';
import { VoteStatus } from '../core/enums.js';
import { sumTotalDuration, toInt } from '../core/helpers.js';

import { getFlexColumnItem, getFixedColumnItem, getItemText, parseDuration } from './utils.js';
import { parseSongMenuData, parseSongRun, parseSongArtists, parseSongAlbum } from './songs.js';

/**
 * Parses the header of a playlist.
 * @param {Object} response - Raw JSON response.
 * @returns {Object} Parsed playlist header.
 */
export function parsePlaylistHeader(response) {
    const playlist = {};
    const editableHeader = nav(response, [...HEADER, ...EDITABLE_PLAYLIST_DETAIL_HEADER], true);

    playlist.owned = editableHeader !== null;
    playlist.privacy = "PUBLIC";

    let header;
    if (editableHeader !== null) { // owned playlist
        header = nav(editableHeader, HEADER_DETAIL);
        playlist.privacy = editableHeader.editHeader?.musicPlaylistEditHeaderRenderer?.privacy || "PUBLIC";
    } else {
        header = nav(response, HEADER_DETAIL, true);
        if (header === null) {
            header = nav(response, [...TWO_COLUMN_RENDERER, ...TAB_CONTENT, ...SECTION_LIST_ITEM, ...RESPONSIVE_HEADER]);
        }
    }

    Object.assign(playlist, parsePlaylistHeaderMeta(header));

    if (!playlist.thumbnails) {
        playlist.thumbnails = nav(header, THUMBNAIL_CROPPED, true);
    }

    playlist.description = nav(header, ["description", ...DESCRIPTION_SHELF, ...DESCRIPTION], true);
    playlist.year = nav(header, SUBTITLE2, true);

    return playlist;
}

/**
 * Parses the metadata of a playlist header.
 * @param {Object} header - Raw JSON header.
 * @returns {Object} Parsed metadata.
 */
export function parsePlaylistHeaderMeta(header) {
    const playlistMeta = {
        views: null,
        duration: null,
        trackCount: null,
        title: header.title?.runs ? header.title.runs.map(run => run.text).join("") : "",
        thumbnails: nav(header, THUMBNAILS, true),
    };

    if ("facepile" in header) {
        const avatarRenderer = nav(header, ["facepile", "avatarStackViewModel", "rendererContext"]);
        const avatarCommand = nav(
            avatarRenderer,
            ["commandContext", "onTap", "innertubeCommand"],
            true
        );

        if (nav(avatarCommand, ["showEngagementPanelEndpoint", "identifier", "tag"], true) === "PAplaylist_collaborate") {
            const avatars = nav(header, ["facepile", "avatarStackViewModel", "avatars"]);
            playlistMeta.collaborators = {
                text: nav(avatarRenderer, ["accessibilityContext", "label"], true),
                avatars: avatars.map(avatar => avatar.avatarViewModel?.image?.sources?.[0]),
            };
        } else {
            playlistMeta.author = {
                name: nav(header, ["facepile", "avatarStackViewModel", "text", "content"], true),
                id: nav(avatarCommand, ["browseEndpoint", "browseId"], true),
            };
        }
    }

    if (header.secondSubtitle && "runs" in header.secondSubtitle) {
        const secondSubtitleRuns = header.secondSubtitle.runs;
        // Lógica de Python adaptada a JS: bool * 2
        const hasViews = secondSubtitleRuns.length > 3 ? 2 : 0;

        playlistMeta.views = hasViews === 0 ? null : toInt(secondSubtitleRuns[0].text);

        const hasDuration = secondSubtitleRuns.length > 1 ? 2 : 0;
        playlistMeta.duration = hasDuration === 0 ? null : secondSubtitleRuns[hasViews + hasDuration]?.text;

        const songCountText = secondSubtitleRuns[hasViews]?.text || "";
        const songCountSearch = songCountText.match(/\d+/g);
        playlistMeta.trackCount = songCountSearch ? toInt(songCountSearch.join("")) : null;
    }

    return playlistMeta;
}

/**
 * Parses an audio playlist (with potential continuations).
 * @param {Object} response - Raw JSON response.
 * @param {number|null} limit - Maximum number of tracks.
 * @param {Function} requestFunc - Async function to request continuations.
 * @returns {Promise<Object>} Parsed playlist dictionary.
 */
export async function parseAudioPlaylist(response, limit, requestFunc) {
    const playlist = {
        owned: false,
        privacy: "PUBLIC",
        description: null,
        views: null,
        duration: null,
        tracks: [],
        thumbnails: [],
        related: [],
    };

    const sectionList = nav(response, [...TWO_COLUMN_RENDERER, "secondaryContents", ...SECTION], true);
    if (!sectionList) return playlist;

    const contentData = nav(sectionList, [...CONTENT, "musicPlaylistShelfRenderer"], true);
    if (!contentData) return playlist;

    playlist.id = nav(contentData, ["targetId"], true);

    if ("contents" in contentData) {
        playlist.tracks = parsePlaylistItems(contentData.contents);

        const parseFunc = (contents) => parsePlaylistItems(contents);
        const continuations = await getContinuations2025(contentData, limit, requestFunc, parseFunc);
        playlist.tracks.push(...continuations);
    }

    playlist.trackCount = playlist.tracks.length;

    if (playlist.tracks.length > 0 && playlist.tracks[0].album) {
        playlist.title = playlist.tracks[0].album.name;
    }

    playlist.duration_seconds = sumTotalDuration(playlist);

    return playlist;
}

/**
 * Parses a list of playlist items.
 * @param {Array} results - Raw JSON list of results.
 * @param {boolean} [isAlbum=false] - Whether these items belong to an album.
 * @param {boolean} [isCollaborative=false] - Whether this is a collaborative playlist.
 * @returns {Array} List of parsed songs.
 */
export function parsePlaylistItems(results, isAlbum = false, isCollaborative = false) {
    const songs = [];
    if (!results || !Array.isArray(results)) return songs;

    for (const result of results) {
        if (!(MRLIR in result)) continue;

        const data = result[MRLIR];
        const song = parsePlaylistItem(data, isAlbum, isCollaborative);
        if (song) {
            songs.push(song);
        }
    }

    return songs;
}

/**
 * Parses an individual item within a playlist.
 * @param {Object} data - Raw JSON data for the item.
 * @param {boolean} [isAlbum=false]
 * @param {boolean} [isCollaborative=false]
 * @returns {Object|null} Parsed song dictionary or null if invalid.
 */
export function parsePlaylistItem(data, isAlbum = false, isCollaborative = false) {
    let videoId = null;
    let setVideoId = null;
    let creditsBrowseId = null;
    let like = null;

    if ("menu" in data) {
        const menuItems = nav(data, MENU_ITEMS, true) || [];
        for (const item of menuItems) {
            if ("menuServiceItemRenderer" in item) {
                const menuService = nav(item, MENU_SERVICE, true);
                if (menuService && "playlistEditEndpoint" in menuService) {
                    setVideoId = nav(menuService, ["playlistEditEndpoint", "actions", 0, "setVideoId"], true);
                    videoId = nav(menuService, ["playlistEditEndpoint", "actions", 0, "removedVideoId"], true);
                }
            } else if (MNIR in item) {
                const maybeCreditsBrowseId = nav(item, [MNIR, ...NAVIGATION_BROWSE_ID], true);
                if (maybeCreditsBrowseId && maybeCreditsBrowseId.startsWith("MPTC")) {
                    creditsBrowseId = maybeCreditsBrowseId;
                }
            }
        }
    }

    const songMenuData = {
        inLibrary: null,
        pinnedToListenAgain: null,
        ...parseSongMenuData(data)
    };

    if (nav(data, PLAY_BUTTON, true) !== null) {
        const playBtn = nav(data, PLAY_BUTTON, true);
        if (playBtn && "playNavigationEndpoint" in playBtn) {
            videoId = playBtn.playNavigationEndpoint?.watchEndpoint?.videoId || videoId;

            if ("menu" in data) {
                like = nav(data, MENU_LIKE_STATUS, true);
            }
        }
    }

    let isAvailable = true;
    if ("musicItemRendererDisplayPolicy" in data) {
        isAvailable = data.musicItemRendererDisplayPolicy !== "MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT";
    }

    const usePresetColumns = (!isAvailable || isAlbum) ? true : null;

    let titleIndex = usePresetColumns ? 0 : null;
    let artistIndex = usePresetColumns ? 1 : null;
    let durationIndex = null;
    let albumIndex = isCollaborative ? 3 : (usePresetColumns ? 2 : null);
    const userChannelIndexes = [];
    let unrecognizedIndex = null;

    const flexColumnsCount = data.flexColumns ? data.flexColumns.length : 0;

    for (let index = 0; index < flexColumnsCount; index++) {
        const flexColumnItem = getFlexColumnItem(data, index);
        const navigationEndpoint = nav(flexColumnItem, [...TEXT_RUN, "navigationEndpoint"], true);

        if (!navigationEndpoint) {
            const run = nav(flexColumnItem, TEXT_RUN, true);
            if (run && "text" in run) {
                const parsed = parseSongRun(run);
                if (parsed.type === "duration") {
                    durationIndex = index;
                } else {
                    unrecognizedIndex = unrecognizedIndex === null ? index : unrecognizedIndex;
                }
            }
            continue;
        }

        if ("watchEndpoint" in navigationEndpoint) {
            titleIndex = index;
        } else if ("browseEndpoint" in navigationEndpoint) {
            const pageType = nav(navigationEndpoint, [
                "browseEndpoint",
                "browseEndpointContextSupportedConfigs",
                "browseEndpointContextMusicConfig",
                "pageType"
            ], true);

            if (pageType === "MUSIC_PAGE_TYPE_ARTIST" || pageType === "MUSIC_PAGE_TYPE_UNKNOWN") {
                artistIndex = index;
            } else if (pageType === "MUSIC_PAGE_TYPE_ALBUM" || pageType === "MUSIC_PAGE_TYPE_AUDIOBOOK") {
                albumIndex = index;
            } else if (pageType === "MUSIC_PAGE_TYPE_USER_CHANNEL") {
                userChannelIndexes.push(index);
            } else if (pageType === "MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_TRACK_PAGE") {
                titleIndex = index;
            }
        }
    }

    if (artistIndex === null && unrecognizedIndex !== null) {
        artistIndex = unrecognizedIndex;
    }

    if (artistIndex === null && userChannelIndexes.length > 0) {
        artistIndex = userChannelIndexes[userChannelIndexes.length - 1];
    }

    const title = titleIndex !== null ? getItemText(data, titleIndex) : null;
    if (title === "Song deleted") {
        return null;
    }

    const artists = artistIndex !== null ? parseSongArtists(data, artistIndex) : null;
    const album = albumIndex !== null ? parseSongAlbum(data, albumIndex) : null;
    const views = isAlbum ? getItemText(data, 2) : null;

    let duration = durationIndex !== null ? getItemText(data, durationIndex) : null;

    if ("fixedColumns" in data) {
        const fixedCol0 = getFixedColumnItem(data, 0);
        if (nav(fixedCol0, ["text", "simpleText"], true)) {
            duration = nav(fixedCol0, ["text", "simpleText"], true);
        } else {
            duration = nav(fixedCol0, TEXT_RUN_TEXT, true) || duration;
        }
    }

    const thumbnails = nav(data, THUMBNAILS, true);
    const isExplicit = nav(data, BADGE_LABEL, true) !== null;

    const videoType = nav(
        data,
        [...MENU_ITEMS, 0, MNIR, "navigationEndpoint", ...NAVIGATION_VIDEO_TYPE],
        true
    );

    const votingStatus = nav(data, ENGAGEMENT_BAR, true);
    let communityVoteStatus = null;
    if (votingStatus) {
        communityVoteStatus = {
            netVoteValue: votingStatus.votes,
            status: VoteStatus[votingStatus.status] || votingStatus.status
        };
    }

    const song = {
        videoId,
        title,
        artists,
        album,
        likeStatus: like,
        ...songMenuData,
        thumbnails,
        isAvailable,
        isExplicit,
        videoType,
        views,
        communityVoteStatus
    };

    if (isAlbum) {
        song.trackNumber = isAvailable ? parseInt(nav(data, ["index", "runs", 0, "text"], true) || "0", 10) : null;
    }

    if (duration) {
        song.duration = duration;
        song.duration_seconds = parseDuration(duration);
    }
    if (setVideoId) {
        song.setVideoId = setVideoId;
    }
    if (creditsBrowseId) {
        song.creditsBrowseId = creditsBrowseId;
    }

    return song;
}

/**
 * Strips the 'VL' prefix from playlist IDs if present.
 * @param {string} playlistId - The playlist ID to validate.
 * @returns {string} Cleaned playlist ID.
 */
export function validatePlaylistId(playlistId) {
    if (!playlistId) return playlistId;
    return playlistId.startsWith("VL") ? playlistId.substring(2) : playlistId;
}