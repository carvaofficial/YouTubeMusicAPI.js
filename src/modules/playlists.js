/**
 * @fileoverview Playlists mixin for YTMusic client (get, create, edit, delete, add/remove items).
 */

import {
    nav,
    TWO_COLUMN_RENDERER,
    TAB_CONTENT,
    SECTION_LIST_ITEM,
    SECTION,
    EDITABLE_PLAYLIST_DETAIL_HEADER,
    RESPONSIVE_HEADER,
    WATCH_PLAYLIST_ID,
    PLAYLIST_ID,
    HEADER,
    DESCRIPTION_SHELF,
    SUBTITLE_RUNS,
    SECTION_LIST_CONTINUATION,
    CONTENT,
    MUSIC_SHELF,
    CAROUSEL
} from '../core/navigation.js';

import { sumTotalDuration } from '../core/helpers.js';
import { ResponseStatus } from '../core/enums.js';
import { findObjectByKey } from '../core/navigation.js';
import { parsePlaylistHeaderMeta, parseAudioPlaylist, parsePlaylistItems, validatePlaylistId } from '../parsers/playlists.js';
import { parseContentList, parsePlaylist } from '../parsers/browsing.js';
import { parseSongRuns } from '../parsers/songs.js';
import { getContinuationParams, getContinuationContents, getReloadableContinuations, getContinuations2025 } from '../core/continuations.js';
import { YTMusicUserError } from '../core/exceptions.js';
import { validateWriteResponse } from './utils.js';

/**
 * Helper to unescape basic HTML entities since YT doesn't allow HTML in playlist descriptions.
 * @param {string} html 
 * @returns {string}
 * @private
 */
function htmlToTxt(html) {
    if (!html) return "";
    return html
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/<[^>]+>/g, "");
}

/**
 * Mixin containing playlist-related methods for YouTube Music.
 */
export const PlaylistsMixin = {
    /**
     * Returns a list of playlist items.
     * @param {string} playlistId - Playlist id.
     * @param {number|null} [limit=100] - How many songs to return. `null` retrieves them all.
     * @param {boolean} [related=false] - Whether to fetch 10 related playlists or not.
     * @param {number} [suggestionsLimit=0] - How many suggestions to return.
     * @returns {Promise<Object>} Dictionary with information about the playlist.
     */
    async getPlaylist(playlistId, limit = 100, related = false, suggestionsLimit = 0) {
        const browseId = !playlistId.startsWith("VL") ? "VL" + playlistId : playlistId;
        const body = { browseId };
        const endpoint = "browse";

        const requestFunc = (additionalParams = "") => this._sendRequest(endpoint, body, additionalParams);
        const response = await requestFunc("");

        const requestFuncContinuations = (reqBody) => this._sendRequest(endpoint, reqBody);

        const isOla = playlistId.startsWith("OLA") || playlistId.startsWith("VLOLA");
        const hasPlaylistHeader = nav(response, [...TWO_COLUMN_RENDERER, ...TAB_CONTENT, ...SECTION_LIST_ITEM], true);

        if (isOla && !hasPlaylistHeader) {
            return await parseAudioPlaylist(response, limit, requestFuncContinuations);
        }

        const headerData = nav(response, [...TWO_COLUMN_RENDERER, ...TAB_CONTENT, ...SECTION_LIST_ITEM]);
        const sectionList = nav(response, [...TWO_COLUMN_RENDERER, "secondaryContents", ...SECTION]);

        const playlist = {};
        playlist.owned = EDITABLE_PLAYLIST_DETAIL_HEADER[0] in headerData;

        let header;
        if (!playlist.owned) {
            header = nav(headerData, RESPONSIVE_HEADER);
            const playButton = findObjectByKey(nav(header, ["buttons"], true) || [], "musicPlayButtonRenderer");
            playlist.id = nav(playButton, ["musicPlayButtonRenderer", "playNavigationEndpoint", ...WATCH_PLAYLIST_ID], true);
            playlist.privacy = "PUBLIC";
        } else {
            playlist.id = nav(headerData, [...EDITABLE_PLAYLIST_DETAIL_HEADER, ...PLAYLIST_ID]);
            header = nav(headerData, [...EDITABLE_PLAYLIST_DETAIL_HEADER, ...HEADER, ...RESPONSIVE_HEADER]);
            playlist.privacy = headerData[EDITABLE_PLAYLIST_DETAIL_HEADER[0]].editHeader.musicPlaylistEditHeaderRenderer.privacy;
        }

        const descriptionShelf = nav(header, ["description", ...DESCRIPTION_SHELF], true);
        playlist.description = descriptionShelf && descriptionShelf.description && descriptionShelf.description.runs
            ? descriptionShelf.description.runs.map(run => run.text).join("")
            : null;

        Object.assign(playlist, parsePlaylistHeaderMeta(header));
        const isCollaborative = "collaborators" in playlist;

        const subtitleRuns = nav(header, SUBTITLE_RUNS) || [];
        const startIndex = 2 + (playlist.owned ? 2 : 0);
        Object.assign(playlist, parseSongRuns(subtitleRuns.slice(startIndex)));

        playlist.related = [];

        if ("continuations" in sectionList) {
            let additionalParams = getContinuationParams(sectionList);

            if (playlist.owned && (suggestionsLimit > 0 || related)) {
                let suggested = await requestFunc(additionalParams);
                let continuation = nav(suggested, SECTION_LIST_CONTINUATION);
                additionalParams = getContinuationParams(continuation);

                const suggestionsShelf = nav(continuation, [...CONTENT, ...MUSIC_SHELF]);
                playlist.suggestions = getContinuationContents(suggestionsShelf, parsePlaylistItems);

                const reloadableContinuations = await getReloadableContinuations(
                    suggestionsShelf,
                    "musicShelfContinuation",
                    suggestionsLimit - playlist.suggestions.length,
                    requestFunc,
                    parsePlaylistItems
                );
                playlist.suggestions.push(...reloadableContinuations);
            }

            if (related) {
                const relResponse = await requestFunc(additionalParams);
                const continuation = nav(relResponse, SECTION_LIST_CONTINUATION, true);
                if (continuation) {
                    const carouselContent = nav(continuation, [...CONTENT, ...CAROUSEL], true);
                    if (carouselContent) {
                        playlist.related = getContinuationContents(carouselContent, (res) => parseContentList(res, parsePlaylist));
                    }
                }
            }
        }

        playlist.tracks = [];
        const contentData = nav(sectionList, [...CONTENT, "musicPlaylistShelfRenderer"], true);
        if (contentData && "contents" in contentData) {
            playlist.tracks = parsePlaylistItems(contentData.contents, false, isCollaborative);

            const continuations = await getContinuations2025(
                contentData,
                limit,
                requestFuncContinuations,
                (contents) => parsePlaylistItems(contents, false, isCollaborative)
            );
            playlist.tracks.push(...continuations);
        }

        playlist.duration_seconds = sumTotalDuration(playlist);
        return playlist;
    },

    /**
     * Gets playlist items for the 'Liked Songs' playlist.
     */
    async getLikedSongs(limit = 100) {
        if (typeof this._checkAuth === 'function') this._checkAuth();
        return await this.getPlaylist("LM", limit);
    },

    /**
     * Gets playlist items for the 'Saved Episodes' playlist.
     */
    async getSavedEpisodes(limit = 100) {
        if (typeof this._checkAuth === 'function') this._checkAuth();
        return await this.getPlaylist("SE", limit);
    },

    /**
     * Creates a new empty playlist and returns its id.
     */
    async createPlaylist(title, description, privacyStatus = "PRIVATE", videoIds = null, sourcePlaylist = null) {
        if (typeof this._checkAuth === 'function') this._checkAuth();

        const invalidCharacters = ["<", ">"];
        const invalidFound = invalidCharacters.filter(char => title.includes(char));
        if (invalidFound.length > 0) {
            throw new YTMusicUserError(`${title} contains invalid characters: ${invalidFound.join(", ")}`);
        }

        const body = {
            title: title,
            description: htmlToTxt(description),
            privacyStatus: privacyStatus
        };

        if (videoIds) body.videoIds = videoIds;
        if (sourcePlaylist) body.sourcePlaylistId = sourcePlaylist;

        const response = await this._sendRequest("playlist/create", body);
        if ("playlistId" in response) {
            return response.playlistId;
        }

        validateWriteResponse(response);
        return response;
    },

    /**
     * Given an invite token, join a collaborative playlist and add it to your library.
     */
    async joinCollaborativePlaylist(playlistId, joinCollaborationToken) {
        if (typeof this._checkAuth === 'function') this._checkAuth();
        const body = {
            playlistId: validatePlaylistId(playlistId),
            actions: [{ action: "ACTION_JOIN_COLLABORATION", joinCollaborationToken }]
        };
        const response = await this._sendRequest("browse/edit_playlist", body);
        return response.status || response;
    },

    /**
     * Edit title, description or privacyStatus of a playlist.
     */
    async editPlaylist(playlistId, { title, description, privacyStatus, collaboration, moveItem, addPlaylistId, sortOrder, addToTop, voteOption } = {}) {
        if (typeof this._checkAuth === 'function') this._checkAuth();

        const body = { playlistId: validatePlaylistId(playlistId), actions: [] };
        const actions = [];

        if (title) actions.push({ action: "ACTION_SET_PLAYLIST_NAME", playlistName: title });
        if (description) actions.push({ action: "ACTION_SET_PLAYLIST_DESCRIPTION", playlistDescription: description });
        if (privacyStatus) actions.push({ action: "ACTION_SET_PLAYLIST_PRIVACY", playlistPrivacy: privacyStatus });

        if (collaboration === true) {
            actions.push({ action: "ACTION_CREATE_COLLABORATION_INVITE_LINK" });
        } else if (collaboration === false) {
            actions.push({ action: "ACTION_SET_CLOSED_TO_CONTRIBUTIONS", closedToContributions: true });
        }

        if (moveItem) {
            const action = {
                action: "ACTION_MOVE_VIDEO_BEFORE",
                setVideoId: Array.isArray(moveItem) ? moveItem[0] : moveItem
            };
            if (Array.isArray(moveItem) && moveItem.length > 1) {
                action.movedSetVideoIdSuccessor = moveItem[1];
            }
            actions.push(action);
        }

        if (addPlaylistId) actions.push({ action: "ACTION_ADD_PLAYLIST", addedFullListId: addPlaylistId });
        if (sortOrder !== undefined && sortOrder !== null) actions.push({ action: "ACTION_SET_PLAYLIST_VIDEO_ORDER", playlistVideoOrder: sortOrder });
        if (addToTop !== undefined && addToTop !== null) actions.push({ action: "ACTION_SET_ADD_TO_TOP", addToTop: String(addToTop).toLowerCase() });

        if (voteOption !== undefined && voteOption !== null) {
            actions.push({
                action: "ACTION_SET_ALLOW_ITEM_VOTE",
                itemVotePermission: voteOption,
            });
        }

        body.actions = actions;
        const response = await this._sendRequest("browse/edit_playlist", body);

        if (collaboration && response.status === ResponseStatus.SUCCEEDED) {
            const inviteLink = nav(response, ["collaborationInviteLink"], true);
            if (inviteLink) {
                const url = new URL(inviteLink);
                const jct = url.searchParams.get("jct");
                return {
                    status: response.status,
                    joinCollaborationToken: jct
                };
            }
        }

        return response.status || response;
    },

    /**
     * Delete a playlist.
     */
    async deletePlaylist(playlistId) {
        if (typeof this._checkAuth === 'function') this._checkAuth();
        const body = { playlistId: validatePlaylistId(playlistId) };
        const response = await this._sendRequest("playlist/delete", body);
        return response.status || response;
    },

    /**
     * Add songs to an existing playlist.
     */
    async addPlaylistItems(playlistId, videoIds = null, sourcePlaylist = null, duplicates = false) {
        if (typeof this._checkAuth === 'function') this._checkAuth();

        if (!videoIds && !sourcePlaylist) {
            throw new YTMusicUserError("You must provide either videoIds or a sourcePlaylist to add to the playlist");
        }

        const body = { playlistId: validatePlaylistId(playlistId), actions: [] };

        if (videoIds) {
            for (const videoId of videoIds) {
                const action = { action: "ACTION_ADD_VIDEO", addedVideoId: videoId };
                if (duplicates) action.dedupeOption = "DEDUPE_OPTION_SKIP";
                body.actions.push(action);
            }
        }

        if (sourcePlaylist) {
            body.actions.push({ action: "ACTION_ADD_PLAYLIST", addedFullListId: sourcePlaylist });
            if (!videoIds) {
                body.actions.push({ action: "ACTION_ADD_VIDEO", addedVideoId: null });
            }
        }

        const response = await this._sendRequest("browse/edit_playlist", body);

        if (response.status && response.status.includes("SUCCEEDED")) {
            const resultDict = (response.playlistEditResults || []).map(r => r.playlistEditVideoAddedResultData);
            return { status: response.status, playlistEditResults: resultDict };
        }

        return response;
    },

    /**
     * Remove songs from an existing playlist.
     */
    async removePlaylistItems(playlistId, videos) {
        if (typeof this._checkAuth === 'function') this._checkAuth();

        const validVideos = videos.filter(x => "videoId" in x && "setVideoId" in x);
        if (validVideos.length === 0) {
            throw new YTMusicUserError("Cannot remove songs, because setVideoId is missing. Do you own this playlist?");
        }

        const body = { playlistId: validatePlaylistId(playlistId), actions: [] };

        for (const video of validVideos) {
            body.actions.push({
                setVideoId: video.setVideoId,
                removedVideoId: video.videoId,
                action: "ACTION_REMOVE_VIDEO"
            });
        }

        const response = await this._sendRequest("browse/edit_playlist", body);
        return response.status || response;
    }
};