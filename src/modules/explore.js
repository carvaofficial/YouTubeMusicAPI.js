/**
 * @fileoverview Explore mixin for YTMusic client.
 */

import {
    nav,
    SINGLE_COLUMN_TAB,
    SECTION_LIST,
    GRID,
    TITLE_TEXT,
    GRID_ITEMS,
    CATEGORY_TITLE,
    CATEGORY_PARAMS,
    CAROUSEL_CONTENTS,
    CAROUSEL,
    CAROUSEL_TITLE,
    NAVIGATION_BROWSE_ID,
    MMRIR,
    MTRIR,
    MRLIR
} from '../core/navigation.js';

import { parseContentList, parsePlaylist, parseAlbum, parseVideo } from '../parsers/browsing.js';
import { parseChartEpisode, parseChartSong, parseTrendingItem } from '../parsers/explore.js';

/**
 * Mixin containing methods to retrieve explore data from YouTube Music.
 */
export const ExploreMixin = {
    /**
     * Fetch "Moods & Genres" categories from YouTube Music.
     * @returns {Promise<Object>} Dictionary of sections and categories.
     */
    async getMoodCategories() {
        const sections = {};
        const response = await this._sendRequest("browse", { browseId: "FEmusic_moods_and_genres" });
        const sectionList = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST]);

        for (const section of sectionList) {
            const title = nav(section, [...GRID, "header", "gridHeaderRenderer", ...TITLE_TEXT]);
            sections[title] = [];

            const gridItems = nav(section, GRID_ITEMS, true) || [];
            for (const category of gridItems) {
                sections[title].push({
                    title: nav(category, CATEGORY_TITLE),
                    params: nav(category, CATEGORY_PARAMS)
                });
            }
        }

        return sections;
    },

    /**
     * Retrieve a list of playlists for a given "Moods & Genres" category.
     * @param {string} params - Params obtained by getMoodCategories.
     * @returns {Promise<Array>} List of playlists.
     */
    async getMoodPlaylists(params) {
        let playlists = [];
        const response = await this._sendRequest(
            "browse",
            { browseId: "FEmusic_moods_and_genres_category", params }
        );

        const sectionList = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST]);

        for (const section of sectionList) {
            let path = [];
            if ("gridRenderer" in section) {
                path = GRID_ITEMS;
            } else if ("musicCarouselShelfRenderer" in section) {
                path = CAROUSEL_CONTENTS;
            } else if ("musicImmersiveCarouselShelfRenderer" in section) {
                path = ["musicImmersiveCarouselShelfRenderer", "contents"];
            }

            if (path.length > 0) {
                const results = nav(section, path, true);
                if (results) {
                    playlists = playlists.concat(parseContentList(results, parsePlaylist));
                }
            }
        }

        return playlists;
    },

    /**
     * Get latest explore data from YouTube Music.
     * @returns {Promise<Object>} Dictionary containing explore data.
     */
    async getExplore() {
        const body = { browseId: "FEmusic_explore" };
        const response = await this._sendRequest("browse", body);
        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST]);

        const explore = {};

        for (const result of results) {
            const browseId = nav(result, [...CAROUSEL, ...CAROUSEL_TITLE, ...NAVIGATION_BROWSE_ID], true);
            if (!browseId) continue;

            const contents = nav(result, CAROUSEL_CONTENTS, true);
            if (!contents) continue;

            if (browseId === "FEmusic_new_releases_albums") {
                explore.new_releases = parseContentList(contents, parseAlbum);
            }
            else if (browseId === "FEmusic_moods_and_genres") {
                explore.moods_and_genres = contents.map(genre => ({
                    title: nav(genre, CATEGORY_TITLE),
                    params: nav(genre, CATEGORY_PARAMS)
                }));
            }
            else if (browseId === "FEmusic_top_non_music_audio_episodes") {
                explore.top_episodes = parseContentList(contents, parseChartEpisode, MMRIR);
            }
            else if (browseId === "FEmusic_new_releases_videos") {
                explore.new_videos = parseContentList(contents, parseVideo, MTRIR);
            }
            else if (browseId.startsWith("VLPL")) {
                explore.top_songs = {
                    playlist: browseId,
                    items: parseContentList(contents, parseChartSong, MRLIR)
                };
            }
            else if (browseId.startsWith("VLOLA")) {
                explore.trending = {
                    playlist: browseId,
                    items: parseContentList(contents, parseTrendingItem, MRLIR)
                };
            }
        }

        return explore;
    }
};