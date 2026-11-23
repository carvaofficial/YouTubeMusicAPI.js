/**
 * @fileoverview Translation-aware parsers for channel contents and credits.
 */

import {
    nav,
    CAROUSEL,
    CAROUSEL_TITLE,
    MMRIR,
    MTRIR,
    NAVIGATION_BROWSE,
    NAVIGATION_BROWSE_ID
} from '../core/navigation.js';

import {
    parseAlbum,
    parseSingle,
    parseVideo,
    parsePlaylist,
    parseRelatedArtist,
    parseContentList
} from './browsing.js';

import { parseEpisode, parsePodcast } from './podcasts.js';

/**
 * Gets localized search result types.
 * @param {Function} _ - Translation function.
 * @returns {string[]}
 */
export function getSearchResultTypes(_) {
    return [
        _("album"),
        _("artist"),
        _("playlist"),
        _("song"),
        _("video"),
        _("station"),
        _("profile"),
        _("podcast"),
        _("episode"),
    ];
}

/**
 * Gets localized API result types.
 * @param {Function} _ - Translation function.
 * @returns {string[]}
 */
export function getApiResultTypes(_) {
    return [
        _("single"),
        _("ep"),
        ...getSearchResultTypes(_)
    ];
}

/**
 * Maps localized credit section titles to standard snake_case keys.
 * @param {Function} _ - Translation function.
 * @returns {Object}
 */
export function getSongCreditSectionMap(_) {
    return {
        [_("performed_by")]: "performed_by",
        [_("written_by")]: "written_by",
        [_("produced_by")]: "produced_by",
        [_("music_metadata_provided_by")]: "music_metadata_provided_by",
    };
}

/**
 * Parses channel contents (artist pages, user pages) using localized category names.
 * @param {Array} results - The JSON results.
 * @param {Function} _ - Translation function.
 * @returns {Object} Parsed channel contents.
 */
export function parseChannelContents(results, _) {
    const categories = [
        { key: "albums", local: _("albums"), parser: parseAlbum, itemKey: MTRIR },
        { key: "singles", local: _("singles & eps"), parser: parseSingle, itemKey: MTRIR },
        { key: "shows", local: _("shows"), parser: parseAlbum, itemKey: MTRIR },
        { key: "videos", local: _("videos"), parser: parseVideo, itemKey: MTRIR },
        { key: "playlists", local: _("playlists"), parser: parsePlaylist, itemKey: MTRIR },
        { key: "related", local: _("related"), parser: parseRelatedArtist, itemKey: MTRIR },
        { key: "episodes", local: _("episodes"), parser: parseEpisode, itemKey: MMRIR },
        { key: "podcasts", local: _("podcasts"), parser: parsePodcast, itemKey: MTRIR },
    ];

    const artist = {};

    for (const { key, local, parser, itemKey } of categories) {
        // Buscamos el carrusel que coincida con la palabra traducida exacta
        const data = results
            .filter(r => "musicCarouselShelfRenderer" in r)
            .map(r => r.musicCarouselShelfRenderer)
            .filter(carousel => {
                const titleText = nav(carousel, [...CAROUSEL, ...CAROUSEL_TITLE], true)?.text;
                return titleText && titleText.toLowerCase() === local.toLowerCase();
            });

        if (data.length > 0) {
            artist[key] = { browseId: null, results: [] };

            const firstData = data[0];
            if ("navigationEndpoint" in nav(firstData, CAROUSEL_TITLE)) {
                artist[key].browseId = nav(firstData, [...CAROUSEL_TITLE, ...NAVIGATION_BROWSE_ID]);
                artist[key].params = nav(firstData, [...CAROUSEL_TITLE, ...NAVIGATION_BROWSE, "params"], true);
            }

            artist[key].results = parseContentList(firstData.contents, parser, itemKey);
        }
    }

    return artist;
}