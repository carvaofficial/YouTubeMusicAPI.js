/**
 * @fileoverview Podcasts mixin for YTMusic client (channels, episodes, podcasts, and feeds).
 */

import {
    nav,
    HEADER_MUSIC_VISUAL,
    TITLE_TEXT,
    THUMBNAILS,
    SINGLE_COLUMN_TAB,
    SECTION_LIST,
    SINGLE_COLUMN_TAB_SECTION_LIST_ITEM_GRID_ITEMS, // O usar paths directos con GRID_ITEMS
    GRID_ITEMS,
    TWO_COLUMN_RENDERER,
    TAB_CONTENT,
    SECTION_LIST_ITEM,
    RESPONSIVE_HEADER,
    MUSIC_SHELF,
    MMRIR,
    DESCRIPTION_SHELF
} from '../core/navigation.js';

import { parseContentList } from '../parsers/browsing.js';
import { parsePlaylistHeader } from '../parsers/playlists.js';
import { parsePodcastHeader, parseEpisodeHeader, parseEpisode } from '../parsers/podcasts.js';
import { getContinuations } from '../core/continuations.js';

/**
 * Mixin containing podcast-related methods for YouTube Music.
 */
export const PodcastsMixin = {
    /**
     * Get information about a podcast channel (episodes, podcasts).
     * @param {string} channelId - Channel ID.
     * @returns {Promise<Object>} Dict containing channel info.
     */
    async getChannel(channelId) {
        const body = { browseId: channelId };
        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);

        const channel = {
            title: nav(response, [...HEADER_MUSIC_VISUAL, ...TITLE_TEXT], true),
            thumbnails: nav(response, [...HEADER_MUSIC_VISUAL, ...THUMBNAILS], true),
        };

        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST]);
        const channelContents = this.parser.parseChannelContents(results, (text) => this._(text));
        Object.assign(channel, channelContents);

        return channel;
    },

    /**
     * Get all channel episodes. This endpoint is currently unlimited.
     * @param {string} channelId - Channel ID.
     * @param {string} params - Params obtained by getChannel.
     * @returns {Promise<Array>} List of channel episodes.
     */
    async getChannelEpisodes(channelId, params) {
        const body = { browseId: channelId, params };
        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);

        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST_ITEM, ...GRID_ITEMS], true) || [];
        return parseContentList(results, parseEpisode, MMRIR);
    },

    /**
     * Returns podcast metadata and episodes.
     * @param {string} playlistId - Playlist ID.
     * @param {number|null} [limit=100] - How many episodes to return. `null` retrieves them all.
     * @returns {Promise<Object>} Dict with podcast information.
     */
    async getPodcast(playlistId, limit = 100) {
        const browseId = !playlistId.startsWith("MPSP") ? "MPSP" + playlistId : playlistId;
        const body = { browseId };
        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);

        const twoColumns = nav(response, TWO_COLUMN_RENDERER);
        const header = nav(twoColumns, [...TAB_CONTENT, ...SECTION_LIST_ITEM, ...RESPONSIVE_HEADER]);
        const podcast = parsePodcastHeader(header);

        const results = nav(twoColumns, ["secondaryContents", ...SECTION_LIST_ITEM, ...MUSIC_SHELF], true);
        const parseFunc = (contents) => parseContentList(contents, parseEpisode, MMRIR);

        let episodes = results && results.contents ? parseFunc(results.contents) : [];

        if (results && "continuations" in results) {
            const requestFunc = (additionalParams) => this._sendRequest(endpoint, body, additionalParams);
            const remainingLimit = limit === null ? null : (limit - episodes.length);

            const continuations = await getContinuations(
                results,
                "musicShelfContinuation",
                remainingLimit,
                requestFunc,
                parseFunc
            );
            episodes.push(...continuations);
        }

        podcast.episodes = episodes;
        return podcast;
    },

    /**
     * Retrieve episode data for a single episode.
     * @param {string} videoId - BrowseId (MPED..) or videoId for a single episode.
     * @returns {Promise<Object>} Dict containing information about the episode.
     */
    async getEpisode(videoId) {
        const browseId = !videoId.startsWith("MPED") ? "MPED" + videoId : videoId;
        const body = { browseId };
        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);

        const twoColumns = nav(response, TWO_COLUMN_RENDERER);
        const header = nav(twoColumns, [...TAB_CONTENT, ...SECTION_LIST_ITEM, ...RESPONSIVE_HEADER]);
        const episode = parseEpisodeHeader(header);

        episode.description = null;
        const descriptionRuns = nav(
            twoColumns,
            ["secondaryContents", ...SECTION_LIST_ITEM, ...DESCRIPTION_SHELF, "description", "runs"],
            true
        );

        if (descriptionRuns && typeof Description !== 'undefined' && Description.fromRuns) {
            episode.description = Description.fromRuns(descriptionRuns);
        } else if (descriptionRuns) {
            episode.description = descriptionRuns.map(run => run.text).join("");
        }

        return episode;
    },

    /**
     * Get all episodes in an episodes playlist ("New Episodes" auto-generated playlist).
     * @param {string} [playlistId="RDPN"] - Playlist ID.
     * @returns {Promise<Object>} Dictionary in the format of getPodcast.
     */
    async getEpisodesPlaylist(playlistId = "RDPN") {
        const browseId = !playlistId.startsWith("VL") ? "VL" + playlistId : playlistId;
        const body = { browseId };
        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);

        const playlist = parsePlaylistHeader(response);

        const results = nav(response, [...TWO_COLUMN_RENDERER, "secondaryContents", ...SECTION_LIST_ITEM, ...MUSIC_SHELF], true);
        const parseFunc = (contents) => parseContentList(contents, parseEpisode, MMRIR);

        playlist.episodes = results && results.contents ? parseFunc(results.contents) : [];

        return playlist;
    }
};