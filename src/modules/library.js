/**
 * @fileoverview Library mixin for YTMusic client (Playlists, Songs, Albums, Artists, History, etc.)
 */

import {
    nav,
    GRID,
    SINGLE_COLUMN_TAB,
    SECTION_LIST,
    MUSIC_SHELF,
    TITLE,
    TITLE_TEXT,
    GRID_ITEMS
} from '../core/navigation.js';

import { getContinuations, getValidatedContinuations, resendRequestUntilParsedResponseIsValid, validateResponse } from '../core/continuations.js';
import { LikeStatus } from '../core/enums.js';
import { parseContentList, parsePlaylist } from '../parsers/browsing.js';
import {
    getLibraryContents,
    parseLibrarySongs,
    parseLibraryAlbums,
    parseLibraryArtists,
    parseLibraryPodcasts
} from '../parsers/library.js';
import { parsePlaylistItems } from '../parsers/playlists.js';
import { YTMusicUserError, YTMusicServerError } from '../core/exceptions.js';

// Asumimos que estas utilidades internas se portarán en _utils.js o similar
import {
    validateOrderParameter,
    prepareOrderParams,
    prepareLikeEndpoint
} from './utils.js';

/**
 * Mixin containing library-related methods for YouTube Music.
 */
export const LibraryMixin = {
    /**
     * Retrieves the playlists in the user's library.
     * @param {number|null} [limit=25] - Number of playlists to retrieve. `null` retrieves them all.
     * @returns {Promise<Array>} List of playlists in the user's library.
     */
    async getLibraryPlaylists(limit = 25) {
        this._checkAuth();
        const body = { browseId: "FEmusic_liked_playlists" };
        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);

        const results = getLibraryContents(response, GRID);
        if (!results) return [];

        // Saltamos el primer elemento (suele ser "Crear playlist")
        const playlists = parseContentList(results.items.slice(1), parsePlaylist);

        if ("continuations" in results) {
            const requestFunc = (additionalParams) => this._sendRequest(endpoint, body, additionalParams);
            const parseFunc = (contents) => parseContentList(contents, parsePlaylist);
            const remainingLimit = limit === null ? null : limit - playlists.length;

            const continuations = await getContinuations(results, "gridContinuation", remainingLimit, requestFunc, parseFunc);
            playlists.push(...continuations);
        }

        return playlists;
    },

    /**
     * Gets the songs in the user's library (liked videos are not included).
     * @param {number|null} [limit=25] - Number of songs to retrieve.
     * @param {boolean} [validateResponses=false] - Flag indicating if responses should be validated and retried.
     * @param {string|null} [order=null] - Order of songs ("a_to_z", "z_to_a", "recently_added").
     * @returns {Promise<Array>} List of songs.
     */
    async getLibrarySongs(limit = 25, validateResponses = false, order = null) {
        this._checkAuth();
        const body = { browseId: "FEmusic_liked_videos" };

        validateOrderParameter(order);
        if (order !== null) {
            body.params = prepareOrderParams(order);
        }

        const endpoint = "browse";
        const perPage = 25;

        const requestFunc = (additionalParams = "") => this._sendRequest(endpoint, body, additionalParams);
        const parseFunc = (rawResponse) => parseLibrarySongs(rawResponse);

        if (validateResponses && limit === null) {
            throw new YTMusicUserError("Validation is not supported without a limit parameter.");
        }

        let response;
        if (validateResponses) {
            const validateFunc = (parsed) => validateResponse(parsed, perPage, limit, 0);
            response = await resendRequestUntilParsedResponseIsValid(
                requestFunc, "", parseFunc, validateFunc, 3
            );
        } else {
            response = parseFunc(await requestFunc(""));
        }

        const results = response.results;
        const songs = response.parsed;
        if (!songs) return [];

        if (results && "continuations" in results) {
            const requestContinuationsFunc = (additionalParams) => this._sendRequest(endpoint, body, additionalParams);
            const parseContinuationsFunc = (contents) => parsePlaylistItems(contents);

            if (validateResponses) {
                const continuations = await getValidatedContinuations(
                    results, "musicShelfContinuation", limit - songs.length, perPage,
                    requestContinuationsFunc, parseContinuationsFunc
                );
                songs.push(...continuations);
            } else {
                const remainingLimit = limit === null ? null : limit - songs.length;
                const continuations = await getContinuations(
                    results, "musicShelfContinuation", remainingLimit,
                    requestContinuationsFunc, parseContinuationsFunc
                );
                songs.push(...continuations);
            }
        }

        return songs;
    },

    /**
     * Gets the albums in the user's library.
     */
    async getLibraryAlbums(limit = 25, order = null) {
        this._checkAuth();
        const body = { browseId: "FEmusic_liked_albums" };
        validateOrderParameter(order);
        if (order !== null) body.params = prepareOrderParams(order);

        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);
        return parseLibraryAlbums(
            response,
            (additionalParams) => this._sendRequest(endpoint, body, additionalParams),
            limit
        );
    },

    /**
     * Gets the artists of the songs in the user's library.
     */
    async getLibraryArtists(limit = 25, order = null) {
        this._checkAuth();
        const body = { browseId: "FEmusic_library_corpus_track_artists" };
        validateOrderParameter(order);
        if (order !== null) body.params = prepareOrderParams(order);

        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);
        return parseLibraryArtists(
            response,
            (additionalParams) => this._sendRequest(endpoint, body, additionalParams),
            limit
        );
    },

    /**
     * Gets the artists the user has subscribed to.
     */
    async getLibrarySubscriptions(limit = 25, order = null) {
        this._checkAuth();
        const body = { browseId: "FEmusic_library_corpus_artists" };
        validateOrderParameter(order);
        if (order !== null) body.params = prepareOrderParams(order);

        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);
        return parseLibraryArtists(
            response,
            (additionalParams) => this._sendRequest(endpoint, body, additionalParams),
            limit
        );
    },

    /**
     * Get podcasts the user has added to the library.
     */
    async getLibraryPodcasts(limit = 25, order = null) {
        this._checkAuth();
        const body = { browseId: "FEmusic_library_non_music_audio_list" };
        validateOrderParameter(order);
        if (order !== null) body.params = prepareOrderParams(order);

        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);
        return parseLibraryPodcasts(
            response,
            (additionalParams) => this._sendRequest(endpoint, body, additionalParams),
            limit
        );
    },

    /**
     * Get channels the user has added to the library.
     */
    async getLibraryChannels(limit = 25, order = null) {
        this._checkAuth();
        const body = { browseId: "FEmusic_library_non_music_audio_channels_list" };
        validateOrderParameter(order);
        if (order !== null) body.params = prepareOrderParams(order);

        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);
        return parseLibraryArtists(
            response,
            (additionalParams) => this._sendRequest(endpoint, body, additionalParams),
            limit
        );
    },

    /**
     * Gets your play history in reverse chronological order.
     */
    async getHistory() {
        this._checkAuth();
        const body = { browseId: "FEmusic_history" };
        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);

        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST], true) || [];
        const songs = [];

        for (const content of results) {
            const data = nav(content, [...MUSIC_SHELF, "contents"], true);
            if (!data) {
                const error = nav(content, ["musicNotifierShelfRenderer", ...TITLE], true);
                throw new YTMusicServerError(error || "Unknown server error retrieving history.");
            }

            const songlist = parsePlaylistItems(data);
            const playedTime = nav(content.musicShelfRenderer, TITLE_TEXT, true);

            for (const song of songlist) {
                song.played = playedTime;
            }
            songs.push(...songlist);
        }

        return songs;
    },

    /**
     * Add an item to the account's history using the playbackTracking URI.
     */
    async addHistoryItem(song) {
        this._checkAuth();
        const url = song.playbackTracking.videostatsPlaybackUrl.baseUrl;
        const CPNA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";

        let cpn = "";
        for (let i = 0; i < 16; i++) {
            cpn += CPNA[Math.floor(Math.random() * 256) & 63];
        }

        const params = { ver: 2, c: "WEB_REMIX", cpn };
        return await this._sendGetRequest(url, params);
    },

    /**
     * Remove an item from the account's history.
     */
    async removeHistoryItems(feedbackTokens) {
        this._checkAuth();
        const body = { feedbackTokens };
        return await this._sendRequest("feedback", body);
    },

    /**
     * Rates a song ("thumbs up"/"thumbs down" interactions).
     */
    async rateSong(videoId, rating = LikeStatus.INDIFFERENT) {
        this._checkAuth();
        const body = { target: { videoId } };
        const endpoint = prepareLikeEndpoint(rating);
        return await this._sendRequest(endpoint, body);
    },

    /**
     * Adds or removes songs from your library, or pins content.
     */
    async editSongLibraryStatus(feedbackTokens = null) {
        this._checkAuth();
        const body = { feedbackTokens };
        return await this._sendRequest("feedback", body);
    },

    /**
     * Rates a playlist/album ("Add to library"/"Remove from library").
     */
    async ratePlaylist(playlistId, rating = LikeStatus.INDIFFERENT) {
        this._checkAuth();
        const body = { target: { playlistId } };
        const endpoint = prepareLikeEndpoint(rating);
        return await this._sendRequest(endpoint, body);
    },

    /**
     * Subscribe to an artist. Adds the artist to your library.
     */
    async subscribeArtist(channelId) {
        this._checkAuth();
        const body = { channelIds: [channelId] };
        return await this._sendRequest("subscription/subscribe", body);
    },

    /**
     * Subscribe to artists. Adds the artists to your library.
     * @deprecated Use subscribeArtist instead.
     */
    async subscribeArtists(channelIds) {
        console.warn(
            "subscribeArtists is deprecated, use subscribeArtist instead. " +
            "YouTube Music only supports subscribing to one artist at a time."
        );
        if (channelIds.length > 1) {
            throw new YTMusicUserError(
                "YouTube Music only supports subscribing to one artist at a time. Use subscribeArtist instead."
            );
        }
        return await this.subscribeArtist(channelIds[0]);
    },

    /**
     * Unsubscribe from artists. Removes the artists from your library.
     */
    async unsubscribeArtists(channelIds) {
        this._checkAuth();
        const body = { channelIds };
        return await this._sendRequest("subscription/unsubscribe", body);
    },

    /**
     * Gets information about the currently authenticated user's account.
     */
    async getAccountInfo() {
        this._checkAuth();
        const endpoint = "account/account_menu";
        const response = await this._sendRequest(endpoint, {});

        const ACCOUNT_INFO = [
            "actions", 0, "openPopupAction", "popup", "multiPageMenuRenderer",
            "header", "activeAccountHeaderRenderer"
        ];
        const ACCOUNT_RUNS_TEXT = ["runs", 0, "text"];

        const ACCOUNT_NAME = [...ACCOUNT_INFO, "accountName", ...ACCOUNT_RUNS_TEXT];
        const ACCOUNT_CHANNEL_HANDLE = [...ACCOUNT_INFO, "channelHandle", ...ACCOUNT_RUNS_TEXT];
        const ACCOUNT_PHOTO_URL = [...ACCOUNT_INFO, "accountPhoto", "thumbnails", 0, "url"];

        return {
            accountName: nav(response, ACCOUNT_NAME, true),
            channelHandle: nav(response, ACCOUNT_CHANNEL_HANDLE, true),
            accountPhotoUrl: nav(response, ACCOUNT_PHOTO_URL, true)
        };
    }
};