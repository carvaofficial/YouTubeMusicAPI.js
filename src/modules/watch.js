/**
 * @fileoverview Watch mixin for YTMusic client (queue, radio, and watch playlist management).
 */

import {
    nav,
    TAB_CONTENT,
    NAVIGATION_PLAYLIST_ID
} from '../core/navigation.js';

import { getContinuations } from '../core/continuations.js';
import { YTMusicUserError, YTMusicServerError } from '../core/exceptions.js';
import { validatePlaylistId } from '../parsers/playlists.js';
import { getTabBrowseIds, parseWatchPlaylist } from '../parsers/watch.js';

/**
 * Mixin containing watch-related methods for YouTube Music.
 */
export const WatchMixin = {
    /**
     * Get a watch list of tracks (Queue / Watch Playlist).
     * @param {string|null} [videoId=null] - Video ID of the played video.
     * @param {string|null} [playlistId=null] - Playlist ID of the played playlist or album.
     * @param {number} [limit=25] - Minimum number of watch playlist items to return.
     * @param {boolean} [radio=false] - Get a radio playlist.
     * @param {boolean} [shuffle=false] - Shuffle the input playlist.
     * @returns {Promise<Object>} Dictionary with tracks, playlistId, lyrics, and related IDs.
     */
    async getWatchPlaylist(videoId = null, playlistId = null, limit = 25, radio = false, shuffle = false) {
        const body = {
            enablePersistentPlaylistPanel: true,
            isAudioOnly: true,
            tunerSettingValue: "AUTOMIX_SETTING_NORMAL",
        };

        if (!videoId && !playlistId) {
            throw new YTMusicUserError("You must provide either a video id, a playlist id, or both.");
        }

        if (videoId) {
            body.videoId = videoId;
            if (!playlistId) {
                playlistId = "RDAMVM" + videoId;
            }
            if (!radio && !shuffle) {
                body.watchEndpointMusicSupportedConfigs = {
                    watchEndpointMusicConfig: {
                        hasPersistentPlaylistPanel: true,
                        musicVideoType: "MUSIC_VIDEO_TYPE_ATV",
                    }
                };
            }
        }

        let isPlaylist = false;
        if (playlistId) {
            const validatedPlaylistId = validatePlaylistId(playlistId);
            isPlaylist = validatedPlaylistId.startsWith("PL") || validatedPlaylistId.startsWith("OLA");
            body.playlistId = validatedPlaylistId;
        }

        if (shuffle && playlistId !== null) {
            body.params = "wAEB8gECKAE%3D";
        }
        if (radio) {
            body.params = "wAEB";
        }

        const endpoint = "next";
        const response = await this._sendRequest(endpoint, body);

        const watchNextRenderer = nav(
            response,
            [
                "contents",
                "singleColumnMusicWatchNextResultsRenderer",
                "tabbedRenderer",
                "watchNextTabbedResultsRenderer",
            ],
            true
        );

        const browseIds = getTabBrowseIds(watchNextRenderer);
        const lyricsBrowseId = browseIds.get("MUSIC_PAGE_TYPE_TRACK_LYRICS") || null;
        const relatedBrowseId = browseIds.get("MUSIC_PAGE_TYPE_TRACK_RELATED") || null;

        const results = nav(
            watchNextRenderer,
            [...TAB_CONTENT, "musicQueueRenderer", "content", "playlistPanelRenderer"],
            true
        );

        if (!results || !results.contents) {
            let msg = "No content returned by the server.";
            if (playlistId) {
                msg += `\nEnsure you have access to ${playlistId} - a private playlist may cause this.`;
            }
            throw new YTMusicServerError(msg);
        }

        // Encontrar el primer ID de playlist válido en los contenidos
        let playlist = null;
        for (const x of results.contents) {
            const pId = nav(x, ["playlistPanelVideoRenderer", ...NAVIGATION_PLAYLIST_ID], true);
            if (pId) {
                playlist = pId;
                break;
            }
        }

        let tracks = parseWatchPlaylist(results.contents);

        if ("continuations" in results) {
            const requestFunc = (additionalParams) => this._sendRequest(endpoint, body, additionalParams);
            const parseFunc = (contents) => parseWatchPlaylist(contents);
            const remainingLimit = limit - tracks.length;

            const continuations = await getContinuations(
                results,
                "playlistPanelContinuation",
                remainingLimit,
                requestFunc,
                parseFunc,
                isPlaylist ? "" : "Radio"
            );
            tracks.push(...continuations);
        }

        return {
            tracks: tracks,
            playlistId: playlist,
            lyrics: lyricsBrowseId,
            related: relatedBrowseId,
        };
    }
};