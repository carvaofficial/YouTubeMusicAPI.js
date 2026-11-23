/**
 * @fileoverview Browsing mixin for YTMusic client (Home, Artists, Albums, Lyrics, Taste Profile, etc.)
 */

import {
    nav,
    SINGLE_COLUMN_TAB,
    SECTION_LIST,
    TWO_COLUMN_RENDERER,
    TAB_CONTENT,
    DESCRIPTION_SHELF,
    DESCRIPTION_RUN_LIST,
    TITLE_TEXT,
    NAVIGATION_PLAYLIST_ID,
    THUMBNAILS,
    MUSIC_SHELF,
    TITLE,
    NAVIGATION_BROWSE_ID,
    SECTION,
    HEADER_SIDE,
    MULTI_SELECT,
    SECTION_LIST_CONTINUATION,
    CONTENT,
    GRID_ITEMS,
    CAROUSEL_CONTENTS,
    GRID,
    HEADER_MUSIC_VISUAL,
    CAROUSEL,
    CREDITS_SECTIONS,
    SUBTITLE_RUNS,
    TIMESTAMPED_LYRICS,
    DESCRIPTION,
    RUN_TEXT,
    TASTE_PROFILE_ITEMS,
    TASTE_PROFILE_ARTIST
} from '../core/navigation.js';

import { parseDescriptionRuns, sumTotalDuration } from '../core/helpers.js';
import { parseAlbumHeader2024 } from '../parsers/albums.js';
import { parseAlbum, parseContentList, parseMixedContent, parsePlaylist, parseVideo } from '../parsers/browsing.js';
import { parseAlbums } from '../parsers/library.js';
import { parsePlaylistItems } from '../parsers/playlists.js';
import { getContinuations, getReloadableContinuationParams } from '../core/continuations.js';
import { YTMusicUserError, YTMusicError } from '../core/exceptions.js';
import { getDatestamp } from './utils.js';

const YTM_DOMAIN = "https://music.youtube.com";

/**
 * Mixin containing browsing-related methods for YouTube Music.
 */
export const BrowsingMixin = {
    /**
     * Get the home page.
     * @param {number} [limit=3] - Number of rows on the home page to return.
     * @returns {Promise<Array>} List of dictionaries keyed with 'title' text and 'contents' list.
     */
    async getHome(limit = 3) {
        const endpoint = "browse";
        const body = { browseId: "FEmusic_home" };
        const response = await this._sendRequest(endpoint, body);

        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST]);
        const home = parseMixedContent(results);

        const sectionList = nav(response, [...SINGLE_COLUMN_TAB, "sectionListRenderer"], true);
        if (sectionList && "continuations" in sectionList) {
            const requestFunc = (additionalParams) => this._sendRequest(endpoint, body, additionalParams);

            const continuations = await getContinuations(
                sectionList,
                "sectionListContinuation",
                limit - home.length,
                requestFunc,
                parseMixedContent
            );
            home.push(...continuations);
        }

        return home;
    },

    /**
     * Get information about an artist and their top releases.
     * @param {string} channelId - Channel ID of the artist.
     * @returns {Promise<Object>} Dictionary with requested information.
     */
    async getArtist(channelId) {
        if (!channelId) throw new YTMusicUserError("Invalid channelId provided.");

        channelId = channelId.replace(/^MPLA/, "");
        const body = { browseId: channelId };
        const endpoint = "browse";

        const response = await this._sendRequest(endpoint, body);

        let results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST], true);
        if (!results) {
            results = nav(response, [...TWO_COLUMN_RENDERER, ...TAB_CONTENT, ...SECTION_LIST]);
        }

        const artist = { description: null, descriptionRuns: [], views: null };

        const header = response.header?.musicImmersiveHeaderRenderer;
        if (!header) {
            throw new YTMusicError("Could not parse artist header renderer.");
        }

        artist.name = nav(header, TITLE_TEXT);

        const descriptionShelf = findObjectByKey ? findObjectByKey(results, DESCRIPTION_SHELF[0], true) : null;
        // Fallback manual si findObjectByKey no está en scope global del mixin
        let shelf = descriptionShelf;
        if (!shelf && Array.isArray(results)) {
            shelf = results.find(r => DESCRIPTION_SHELF[0] in r);
        }

        if (shelf) {
            const shelfData = shelf[DESCRIPTION_SHELF[0]] || shelf;
            const [description, descriptionRuns] = parseDescriptionRuns(
                nav(shelfData, DESCRIPTION_RUN_LIST) || []
            );
            artist.description = description;
            artist.descriptionRuns = descriptionRuns;
            artist.views = shelfData.subheader?.runs?.[0]?.text || null;
        }

        const subscriptionButton = header.subscriptionButton?.subscribeButtonRenderer;
        if (subscriptionButton) {
            artist.channelId = subscriptionButton.channelId;
            artist.subscribed = subscriptionButton.subscribed;
            artist.subscribers = nav(subscriptionButton, ["subscriberCountText", "runs", 0, "text"], true);
        }

        artist.shuffleId = nav(header, ["playButton", "buttonRenderer", ...NAVIGATION_PLAYLIST_ID], true);
        artist.radioId = nav(header, ["startRadioButton", "buttonRenderer", ...NAVIGATION_PLAYLIST_ID], true);

        const monthlyListenersText = nav(header, ["monthlyListenerCount", "runs", 0, "text"], true);
        artist.monthlyListeners = monthlyListenersText ? monthlyListenersText.replace(" monthly audience", "") : null;

        artist.thumbnails = nav(header, THUMBNAILS, true);
        artist.songs = { browseId: null };

        if (results[0] && "musicShelfRenderer" in results[0]) {
            const musicShelf = nav(results[0], MUSIC_SHELF);
            if ("navigationEndpoint" in nav(musicShelf, TITLE)) {
                artist.songs.browseId = nav(musicShelf, [...TITLE, ...NAVIGATION_BROWSE_ID]);
            }
            artist.songs.results = parsePlaylistItems(musicShelf.contents || []);
        }

        const channelContents = this.parser.parseChannelContents(results, (text) => this._(text));
        Object.assign(artist, channelContents);

        return artist;
    },

    /**
     * Get the full list of an artist's albums, singles or shows.
     * @param {string} channelId - BrowseId of the artist.
     * @param {string} params - Params obtained by get_artist.
     * @param {number|null} [limit=100] - Number of albums to return.
     * @param {string} [order] - Order: "Recency", "Popularity", "Alphabetical order".
     * @returns {Promise<Array>} List of albums.
     */
    async getArtistAlbums(channelId, params, limit = 100, order = null) {
        const body = { browseId: channelId, params };
        const endpoint = "browse";
        let response = await this._sendRequest(endpoint, body);

        const requestFunc = (additionalParams) => this._sendRequest(endpoint, body, additionalParams);
        const parseFunc = (contents) => parseAlbums(contents);

        let results;
        if (order) {
            const sortOptions = nav(
                response,
                [
                    ...SINGLE_COLUMN_TAB,
                    ...SECTION,
                    ...HEADER_SIDE,
                    "endItems",
                    0,
                    "musicSortFilterButtonRenderer",
                    "menu",
                    "musicMultiSelectMenuRenderer",
                    "options"
                ],
                true
            );

            const continuationObj = sortOptions?.find(option => {
                const titleText = nav(option, [...MULTI_SELECT, TITLE_TEXT], true);
                return titleText && titleText.toLowerCase() === order.toLowerCase();
            });

            const continuation = nav(
                continuationObj,
                [
                    ...MULTI_SELECT,
                    "selectedCommand",
                    "commandExecutorCommand",
                    "commands",
                    -1,
                    "browseSectionListReloadEndpoint"
                ],
                true
            );

            if (continuation) {
                const additionalParams = getReloadableContinuationParams({ continuations: [continuation.continuation] });
                response = await requestFunc(additionalParams);
                results = nav(response, [...SECTION_LIST_CONTINUATION, CONTENT]);
            } else {
                throw new Error(`Invalid order parameter ${order}`);
            }
        } else {
            results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST_ITEM]);
        }

        const contents = nav(results, GRID_ITEMS, true) || nav(results, CAROUSEL_CONTENTS, true) || [];
        const albums = parseAlbums(contents);

        const gridResults = nav(results, GRID, true);
        if (gridResults && "continuations" in gridResults) {
            const remainingLimit = limit === null ? null : (limit - albums.length);
            const continuations = await getContinuations(gridResults, "gridContinuation", remainingLimit, requestFunc, parseFunc);
            albums.push(...continuations);
        }

        return albums;
    },

    /**
     * Retrieve a user's page.
     * @param {string} channelId - ChannelId of the user.
     * @returns {Promise<Object>} Dictionary with information about a user.
     */
    async getUser(channelId) {
        const endpoint = "browse";
        const body = { browseId: channelId };
        const response = await this._sendRequest(endpoint, body);

        const user = { name: nav(response, [...HEADER_MUSIC_VISUAL, ...TITLE_TEXT], true) };
        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST]);

        const channelContents = this.parser.parseChannelContents(results, (text) => this._(text));
        Object.assign(user, channelContents);

        return user;
    },

    /**
     * Retrieve a list of playlists for a given user.
     */
    async getUserPlaylists(channelId, params) {
        const endpoint = "browse";
        const body = { browseId: channelId, params };
        const response = await this._sendRequest(endpoint, body);

        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST_ITEM, ...GRID_ITEMS], true);
        if (!results) return [];

        return parseContentList(results, parsePlaylist);
    },

    /**
     * Retrieve a list of videos for a given user.
     */
    async getUserVideos(channelId, params) {
        const endpoint = "browse";
        const body = { browseId: channelId, params };
        const response = await this._sendRequest(endpoint, body);

        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST_ITEM, ...GRID_ITEMS], true);
        if (!results) return [];

        return parseContentList(results, parseVideo);
    },

    /**
     * Get an album's browseId based on its audioPlaylistId.
     */
    async getAlbumBrowseId(audioPlaylistId) {
        const params = { list: audioPlaylistId };
        const response = await this._sendGetRequest(`${YTM_DOMAIN}/playlist`, params);

        const decoded = decodeURIComponent(response.text);
        const matches = decoded.match(/"MPRE.+?"/);

        return matches ? matches[0].replace(/"/g, "") : null;
    },

    /**
     * Get information and tracks of an album.
     * @param {string} browseId - BrowseId of the album (must start with MPRE).
     * @returns {Promise<Object>} Dictionary with album and track metadata.
     */
    async getAlbum(browseId) {
        if (!browseId || !browseId.startsWith("MPRE")) {
            throw new YTMusicUserError("Invalid album browseId provided, must start with MPRE.");
        }

        const body = { browseId };
        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);

        const album = parseAlbumHeader2024(response);

        const results = nav(response, [...TWO_COLUMN_RENDERER, "secondaryContents", ...SECTION_LIST_ITEM, ...MUSIC_SHELF], true);
        album.tracks = results && results.contents ? parsePlaylistItems(results.contents, true) : [];

        const secondaryCarousels = nav(response, [...TWO_COLUMN_RENDERER, "secondaryContents", ...SECTION_LIST], true) || [];
        for (const section of secondaryCarousels.slice(1)) {
            const carousel = nav(section, CAROUSEL, true);
            if (!carousel) continue;

            const mapStyle = {
                "COLLECTION_STYLE_ITEM_SIZE_SMALL": "related_recommendations",
                "COLLECTION_STYLE_ITEM_SIZE_MEDIUM": "other_versions"
            };
            const key = mapStyle[carousel.itemSize];
            if (key) {
                album[key] = parseContentList(carousel.contents || [], parseAlbum);
            }
        }

        album.duration_seconds = sumTotalDuration(album);
        for (let i = 0; i < album.tracks.length; i++) {
            album.tracks[i].album = album.title;
            album.tracks[i].artists = album.tracks[i].artists || album.artists;
        }

        return album;
    },

    /**
     * Get credits for a song.
     */
    async getSongCredits(browseId) {
        if (!browseId || !browseId.startsWith("MPTC")) {
            throw new YTMusicUserError("Invalid song credits browseId provided, must start with MPTC.");
        }

        const body = { browseId };
        const endpoint = "browse";
        const response = await this._sendRequest(endpoint, body);

        const credits = { other_sections: [] };
        const sections = nav(response, CREDITS_SECTIONS, true) || [];
        const localizedSectionMap = this.parser.getSongCreditSectionMap((text) => this._(text));

        for (const section of sections) {
            const sectionContent = section.dismissableDialogContentSectionRenderer;
            if (!sectionContent) continue;

            const sectionLocalName = nav(sectionContent, TITLE_TEXT, true);
            const sectionSnakeCaseName = localizedSectionMap[sectionLocalName];

            const sectionData = {
                localized_title: sectionLocalName,
                data: (nav(sectionContent, SUBTITLE_RUNS, true) || []).filter((_, i) => i % 2 === 0).map(item => item.text)
            };

            if (sectionSnakeCaseName) {
                credits[sectionSnakeCaseName] = sectionData;
            } else {
                credits.other_sections.push(sectionData);
            }
        }

        return credits;
    },

    /**
     * Returns metadata and streaming information about a song or video.
     */
    async getSong(videoId, signatureTimestamp = null) {
        const endpoint = "player";
        if (!signatureTimestamp) {
            signatureTimestamp = getDatestamp() - 1;
        }

        const params = {
            playbackContext: { contentPlaybackContext: { signatureTimestamp } },
            video_id: videoId,
        };

        const response = await this._sendRequest(endpoint, params);
        const keys = ["videoDetails", "playabilityStatus", "streamingData", "microformat", "playbackTracking"];

        for (const k of Object.keys(response)) {
            if (!keys.includes(k)) {
                delete response[k];
            }
        }

        return response;
    },

    /**
     * Gets related content for a song.
     */
    async getSongRelated(browseId) {
        if (!browseId) throw new YTMusicUserError("Invalid browseId provided.");

        const response = await this._sendRequest("browse", { browseId });
        const sections = nav(response, ["contents", ...SECTION_LIST]);
        return parseMixedContent(sections);
    },

    /**
     * Returns lyrics of a song or video.
     */
    async getLyrics(browseId, timestamps = false) {
        if (!browseId) {
            throw new YTMusicUserError("Invalid browseId provided. This song might not have lyrics.");
        }

        let response;
        if (timestamps && typeof this.asMobile === 'function') {
            response = await this.asMobile(async () => {
                return await this._sendRequest("browse", { browseId });
            });
        } else {
            response = await this._sendRequest("browse", { browseId });
        }

        if (timestamps) {
            const data = nav(response, TIMESTAMPED_LYRICS, true);
            if (!data || !data.timedLyricsData) return null;

            const rawLyrics = data.timedLyricsData;
            // Evaluamos si contiene rangos de tiempo
            const hasCues = rawLyrics.every(lyric => "cueRange" in lyric);

            if (hasCues) {
                return {
                    lyrics: rawLyrics.map((lyric, index) => ({
                        text: lyric.lyricLine,
                        start_time: parseInt(lyric.cueRange.startTimeMs, 10),
                        end_time: parseInt(lyric.cueRange.endTimeMs, 10),
                        id: index + 1
                    })),
                    source: data.sourceMessage || null,
                    hasTimestamps: true
                };
            } else {
                return {
                    lyrics: rawLyrics.map(lyric => lyric.lyricLine).join("\n"),
                    source: data.sourceMessage || null,
                    hasTimestamps: false
                };
            }
        } else {
            const lyricsStr = nav(response, ["contents", ...SECTION_LIST_ITEM, ...DESCRIPTION_SHELF, ...DESCRIPTION], true);
            if (!lyricsStr) return null;

            return {
                lyrics: lyricsStr,
                source: nav(response, ["contents", ...SECTION_LIST_ITEM, ...DESCRIPTION_SHELF, ...RUN_TEXT], true),
                hasTimestamps: false
            };
        }
    },

    /**
     * Extract the URL for the base.js script.
     */
    async getBasejsUrl() {
        const response = await this._sendGetRequest(YTM_DOMAIN);
        const match = response.text.match(/jsUrl"\s*:\s*"([^"]+)"/);
        if (!match) {
            throw new YTMusicError("Could not identify the URL for base.js player.");
        }
        return YTM_DOMAIN + match[1];
    },

    /**
     * Fetch base.js and parse out the signatureTimestamp.
     */
    async getSignatureTimestamp(url = null) {
        if (!url) {
            url = await this.getBasejsUrl();
        }
        const response = await this._sendGetRequest(url);
        const match = response.text.match(/signatureTimestamp[:=](\d+)/);
        if (!match) {
            throw new YTMusicError("Unable to identify the signatureTimestamp.");
        }
        return parseInt(match[1], 10);
    },

    /**
     * Fetches suggested artists from taste profile.
     */
    async getTasteprofile() {
        if (typeof this._checkAuth === 'function') {
            this._checkAuth();
        }
        const response = await this._sendRequest("browse", { browseId: "FEmusic_tastebuilder" });
        const profiles = nav(response, TASTE_PROFILE_ITEMS, true) || [];

        const tasteProfiles = {};
        for (const itemList of profiles) {
            const items = itemList.tastebuilderItemListRenderer?.contents || [];
            for (const item of items) {
                const artist = nav(item, ["tastebuilderItemRenderer", ...TASTE_PROFILE_ARTIST, 0, "text"], true);
                if (artist) {
                    tasteProfiles[artist] = {
                        selectionValue: item.tastebuilderItemRenderer.selectionFormValue,
                        impressionValue: item.tastebuilderItemRenderer.impressionFormValue,
                    };
                }
            }
        }
        return tasteProfiles;
    },

    /**
     * Favorites artists to see more recommendations.
     */
    async setTasteprofile(artists, tasteProfile = null) {
        if (!tasteProfile) {
            tasteProfile = await this.getTasteprofile();
        }

        const formData = {
            impressionValues: Object.values(tasteProfile).map(p => p.impressionValue),
            selectedValues: [],
        };

        for (const artist of artists) {
            if (!(artist in tasteProfile)) {
                throw new YTMusicUserError(`The artist ${artist} was not present in taste!`);
            }
            formData.selectedValues.push(tasteProfile[artist].selectionValue);
        }

        const body = { browseId: "FEmusic_home", formData };
        await this._sendRequest("browse", body);
    }
};