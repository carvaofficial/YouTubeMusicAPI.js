/**
 * @fileoverview Charts mixin for YTMusic client.
 */

import {
    nav,
    SINGLE_COLUMN_TAB,
    SECTION_LIST,
    MUSIC_SHELF,
    TITLE,
    FRAMEWORK_MUTATIONS,
    CAROUSEL_CONTENTS,
    MTRIR,
    NAVIGATION_BROWSE_ID,
    MRLIR
} from '../core/navigation.js';

import { parseChartPlaylist, parseChartArtist } from '../parsers/explore.js';
import { parseContentList } from '../parsers/browsing.js';

// extra playlist carousel some countries return between the video charts and the artists
const COUNTRY_EXTRA_CATEGORY = {
    "US": "genres",
    "IN": "languages"
};

/**
 * Checks if a carousel contains playlists.
 * Chart playlists are the only carousel items linking to a "VL" playlist.
 * @param {Array} contents - The carousel contents.
 * @returns {boolean}
 * @private
 */
function _isPlaylistCarousel(contents) {
    if (!contents || contents.length === 0) return false;
    const browseId = nav(contents[0], [MTRIR, ...TITLE, ...NAVIGATION_BROWSE_ID], true);
    return browseId && browseId.startsWith("VL");
}

/**
 * Checks if a carousel contains artists.
 * @param {Array} contents - The carousel contents.
 * @returns {boolean}
 * @private
 */
function _isArtistCarousel(contents) {
    if (!contents || contents.length === 0) return false;
    return MRLIR in contents[0];
}

/**
 * Mixin containing methods to retrieve charts from YouTube Music.
 */
export const ChartsMixin = {
    /**
     * Get latest charts data from YouTube Music: Artists and playlists of top videos.
     * Unauthenticated requests return unranked Artists with "rank" and "trend" set to null.
     * US charts have an extra Genres section, IN charts an extra Languages section.
     *
     * @param {string} [country="ZZ"] - ISO 3166-1 Alpha-2 country code. Default: "ZZ" = Global.
     * @returns {Promise<Object>} Dictionary containing chart data.
     */
    async getCharts(country = "ZZ") {
        const body = { browseId: "FEmusic_charts" };
        if (country) {
            body.formData = { selectedValues: [country] };
        }

        const response = await this._sendRequest("browse", body);
        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST]);

        const charts = { countries: {} };

        const menu = nav(
            results[0],
            [
                ...MUSIC_SHELF,
                "subheaders",
                0,
                "musicSideAlignedItemRenderer",
                "startItems",
                0,
                "musicSortFilterButtonRenderer",
            ],
            true // none_if_absent equivalent
        );

        if (menu) {
            charts.countries.selected = nav(menu, TITLE, true);
        }

        // Extraer opciones de países (filtrando nulos)
        const frameworkMutations = nav(response, FRAMEWORK_MUTATIONS, true) || [];
        charts.countries.options = frameworkMutations
            .map(m => nav(m, ["payload", "musicFormBooleanChoice", "opaqueToken"], true))
            .filter(Boolean);

        // Los carruseles no tienen identidad legible por máquina, así que los reconocemos por su contenido.
        const carousels = [];
        for (const section of results.slice(1)) {
            const c = nav(section, CAROUSEL_CONTENTS, true);
            if (c) carousels.push(c);
        }

        const playlistCarousels = carousels.filter(_isPlaylistCarousel);
        const artistCarousels = carousels.filter(_isArtistCarousel);

        let playlistNames = ["videos"];
        if (COUNTRY_EXTRA_CATEGORY[country]) {
            playlistNames.push(COUNTRY_EXTRA_CATEGORY[country]);
        }

        // Las sesiones premium obtienen carruseles diarios y semanales en lugar del de "videos"
        if (playlistCarousels.length > playlistNames.length) {
            playlistNames = ["daily", "weekly", ...playlistNames.slice(1)];
        }

        // Emparejamos los nombres con los carruseles (YTM a veces omite categorías de forma impredecible)
        for (let i = 0; i < Math.min(playlistNames.length, playlistCarousels.length); i++) {
            const name = playlistNames[i];
            const contents = playlistCarousels[i];
            charts[name] = parseContentList(contents, parseChartPlaylist, MTRIR);
        }

        if (artistCarousels.length > 0) {
            charts.artists = parseContentList(artistCarousels[0], parseChartArtist, MRLIR);
        }

        return charts;
    }
};