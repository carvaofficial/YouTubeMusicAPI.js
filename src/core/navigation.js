/**
 * @fileoverview Commonly used navigation paths and utilities for traversing YouTube JSONs.
 */

export const BADGE_LABEL = ["badges", 0, "musicInlineBadgeRenderer", "accessibilityData", "accessibilityData", "label"];
export const BADGE_PATH = [0, "musicInlineBadgeRenderer", "accessibilityData", "accessibilityData", "label"];
export const CARD_SHELF_TITLE = [["header"], "musicCardShelfHeaderBasicRenderer", "title", "runs", 0, "text"];
export const CAROUSEL = ["musicCarouselShelfRenderer"];
export const CAROUSEL_CONTENTS = ["musicCarouselShelfRenderer", "contents"];
export const CAROUSEL_STRAPLINE = ["header", "musicCarouselShelfBasicHeaderRenderer", "strapline", "runs", 0];
export const CAROUSEL_TITLE = ["header", "musicCarouselShelfBasicHeaderRenderer", "title", "runs", 0];
export const CATEGORY_PARAMS = ["musicNavigationButtonRenderer", "clickCommand", "browseEndpoint", "params"];
export const CATEGORY_TITLE = ["musicNavigationButtonRenderer", "buttonText", "runs", 0, "text"];
export const CONTENT = ["contents", 0];
export const CREDITS_SECTIONS = ["onResponseReceivedActions", 0, "openPopupAction", "popup", "dismissableDialogRenderer", "sections"];
export const DESCRIPTION = ["description", "runs", 0, "text"];
export const DESCRIPTION_RUN_LIST = ["description", "runs"];
export const DESCRIPTION_SHELF = ["musicDescriptionShelfRenderer"];
export const DURATION_TEXT = ["duration", "runs", 0, "text"];
export const EDITABLE_PLAYLIST_DETAIL_HEADER = ["musicEditablePlaylistDetailHeaderRenderer"];
export const ENGAGEMENT_BAR = ["engagementBar", "engagementBarViewModel", "actions", 0, "votingViewModel", "initialState"];
export const FEEDBACK_TOKEN = ["feedbackEndpoint", "feedbackToken"];
export const FRAMEWORK_MUTATIONS = ["frameworkUpdates", "entityBatchUpdate", "mutations"];
export const GRID = ["gridRenderer"];
export const GRID_ITEMS = ["gridRenderer", "items"];
export const HEADER = ["header"];
export const HEADER_DETAIL = ["header", "musicDetailHeaderRenderer"];
export const HEADER_EDITABLE_DETAIL = ["header", "musicEditablePlaylistDetailHeaderRenderer"];
export const HEADER_MUSIC_VISUAL = ["header", "musicVisualHeaderRenderer"];
export const HEADER_SIDE = ["header", "musicSideAlignedItemRenderer"];
export const ICON_TYPE = ["icon", "iconType"];
export const IMMERSIVE_CAROUSEL = ["musicImmersiveCarouselShelfRenderer"];
export const ITEM_SECTION = ["itemSectionRenderer", "contents", 0];
export const MENU = ["menu", "menuRenderer"];
export const MENU_ITEMS = ["menu", "menuRenderer", "items"];
export const MENU_LIKE_STATUS = ["menu", "menuRenderer", "topLevelButtons", 0, "likeButtonRenderer", "likeStatus"];
export const MENU_PLAYLIST_ID = ["menu", "menuRenderer", "items", 0, "menuNavigationItemRenderer", "navigationEndpoint", "watchPlaylistEndpoint", "playlistId"];
export const MENU_SERVICE = ["menuServiceItemRenderer", "serviceEndpoint"];
export const MMRIR = "musicMultiRowListItemRenderer";
export const MNIR = "menuNavigationItemRenderer";
export const MRLIR = "musicResponsiveListItemRenderer";
export const MTRIR = "musicTwoRowItemRenderer";
export const MULTI_SELECT = ["musicMultiSelectMenuItemRenderer"];
export const MUSIC_SHELF = ["musicShelfRenderer"];
export const NAVIGATION_BROWSE = ["navigationEndpoint", "browseEndpoint"];
export const NAVIGATION_BROWSE_ID = ["navigationEndpoint", "browseEndpoint", "browseId"];
export const NAVIGATION_PLAYLIST_ID = ["navigationEndpoint", "watchEndpoint", "playlistId"];
export const NAVIGATION_VIDEO_ID = ["navigationEndpoint", "watchEndpoint", "videoId"];
export const NAVIGATION_VIDEO_TYPE = ["watchEndpoint", "watchEndpointMusicSupportedConfigs", "watchEndpointMusicConfig", "musicVideoType"];
export const NAVIGATION_WATCH_PLAYLIST_ID = ["navigationEndpoint", "watchPlaylistEndpoint", "playlistId"];
export const OVERLAY_RENDERER = ["musicItemThumbnailOverlayRenderer", "content", "musicPlayButtonRenderer"];
export const PAGE_TYPE = ["browseEndpointContextSupportedConfigs", "browseEndpointContextMusicConfig", "pageType"];
export const PLAY_BUTTON = ["overlay", "musicItemThumbnailOverlayRenderer", "content", "musicPlayButtonRenderer"];
export const PLAYLIST_ID = ["playlistId"];
export const PROGRESS_RENDERER = ["musicPlaybackProgressRenderer"];
export const QUEUE_VIDEO_ID = ["queueAddEndpoint", "queueTarget", "videoId"];
export const RESPONSIVE_HEADER = ["musicResponsiveHeaderRenderer"];
export const RUN_TEXT = ["runs", 0, "text"];
export const SECTION = ["sectionListRenderer"];
export const SECTION_LIST = ["sectionListRenderer", "contents"];
export const SECTION_LIST_CONTINUATION = ["continuationContents", "sectionListContinuation"];
export const SECTION_LIST_ITEM = ["sectionListRenderer", "contents", 0];
export const SINGLE_COLUMN = ["contents", "singleColumnBrowseResultsRenderer"];
export const SINGLE_COLUMN_TAB = ["contents", "singleColumnBrowseResultsRenderer", "tabs", 0, "tabRenderer", "content"];
export const SINGLE_COLUMN_TAB_SECTION_LIST_ITEM_GRID_ITEMS = [
    ...SINGLE_COLUMN_TAB,
    "sectionListRenderer",
    "contents",
    0,
    "gridRenderer",
    "items"
];
export const SUBTITLE = ["subtitle", "runs", 0, "text"];
export const SUBTITLE2 = ["subtitle", "runs", 2, "text"];
export const SUBTITLE3 = ["subtitle", "runs", 4, "text"];
export const SUBTITLE_BADGE_LABEL = ["subtitleBadges", 0, "musicInlineBadgeRenderer", "accessibilityData", "accessibilityData", "label"];
export const SUBTITLE_RUN = ["subtitle", "runs", 0];
export const SUBTITLE_RUNS = ["subtitle", "runs"];
export const TAB_1_CONTENT = ["tabs", 1, "tabRenderer", "content"];
export const TAB_2_CONTENT = ["tabs", 2, "tabRenderer", "content"];
export const TAB_CONTENT = ["tabs", 0, "tabRenderer", "content"];
export const TASTE_PROFILE_ARTIST = ["title", "runs"];
export const TASTE_PROFILE_ITEMS = ["contents", "tastebuilderRenderer", "contents"];
export const TEXT_RUN = ["text", "runs", 0];
export const TEXT_RUN_TEXT = ["text", "runs", 0, "text"];
export const TEXT_RUNS = ["text", "runs"];
export const THUMBNAIL = ["thumbnail", "thumbnails"];
export const THUMBNAIL_CROPPED = ["thumbnail", "croppedSquareThumbnailRenderer", "thumbnail", "thumbnails"];
export const THUMBNAIL_OVERLAY = ["thumbnailOverlay", "musicItemThumbnailOverlayRenderer", "content", "musicPlayButtonRenderer", "playNavigationEndpoint", "watchPlaylistEndpoint", "playlistId"];
export const THUMBNAIL_OVERLAY_NAVIGATION = ["thumbnailOverlay", "musicItemThumbnailOverlayRenderer", "content", "musicPlayButtonRenderer", "playNavigationEndpoint"];
export const THUMBNAIL_RENDERER = ["thumbnailRenderer", "musicThumbnailRenderer", "thumbnail", "thumbnails"];
export const THUMBNAILS = ["thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails"];
export const TIMESTAMPED_LYRICS = [
    "contents",
    "elementRenderer",
    "newElement",
    "type",
    "componentType",
    "model",
    "timedLyricsModel",
    "lyricsData",
];
export const TITLE = ["title", "runs", 0];
export const TITLE_TEXT = ["title", "runs", 0, "text"];
export const TOGGLE_MENU = "toggleMenuServiceItemRenderer";
export const TOGGLED_BUTTON = ["toggleButtonRenderer", "isToggled"];
export const TWO_COLUMN_RENDERER = ["contents", "twoColumnBrowseResultsRenderer"];
export const WATCH_PID = ["watchPlaylistEndpoint", "playlistId"];
export const WATCH_PLAYLIST_ID = ["watchEndpoint", "playlistId"];
export const WATCH_VIDEO_ID = ["watchEndpoint", "videoId"];

/**
 * Access a nested object in root by an array of keys/indices.
 * @param {Object|Array} root - The root JSON object.
 * @param {Array<string|number>} items - The path sequence.
 * @param {boolean} [noneIfAbsent=false] - Return null instead of throwing an error if path is missing.
 * @returns {any} The nested value or null.
 */
export function nav(root, items, noneIfAbsent = false) {
    if (root === null || root === undefined) return null;

    let current = root;
    for (const k of items) {
        if (current != null && current[k] !== undefined) {
            current = current[k];
        } else {
            if (noneIfAbsent) return null;
            throw new Error(`[YTM-JS Error] Unable to find '${k}' using path ${JSON.stringify(items)}`);
        }
    }
    return current;
}

/**
 * Finds an object containing a specific key inside a list of objects.
 * @param {Array<Object>} objectList - The list of objects.
 * @param {string} key - The key to search for.
 * @param {string|null} [nested=null] - Optional property to drill down into before checking.
 * @param {boolean} [isKey=false] - If true, returns the value of the key instead of the whole object.
 * @returns {Object|any|null}
 */
export function findObjectByKey(objectList, key, nested = null, isKey = false) {
    if (!Array.isArray(objectList)) return null;

    for (let item of objectList) {
        if (nested && item != null) {
            item = item[nested];
        }
        if (item != null && typeof item === 'object' && key in item) {
            return isKey ? item[key] : item;
        }
    }
    return null;
}

/**
 * Finds all objects containing a specific key inside a list of objects.
 * @param {Array<Object>} objectList - The list of objects.
 * @param {string} key - The key to search for.
 * @param {string|null} [nested=null] - Optional property to drill down into before checking.
 * @returns {Array<Object>}
 */
export function findObjectsByKey(objectList, key, nested = null) {
    const objects = [];
    if (!Array.isArray(objectList)) return objects;

    for (let item of objectList) {
        if (nested && item != null) {
            item = item[nested];
        }
        if (item != null && typeof item === 'object' && key in item) {
            objects.push(item);
        }
    }
    return objects;
}