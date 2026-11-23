/**
 * @fileoverview Uploads mixin for YTMusic client (manage uploaded songs, albums, artists, and file uploads).
 */

import fs from 'fs';
import path from 'path';
import {
    nav,
    MUSIC_SHELF,
    SINGLE_COLUMN_TAB,
    SECTION_LIST_ITEM
} from '../core/navigation.js';

import { sumTotalDuration } from '../core/helpers.js';
import { ResponseStatus } from '../core/enums.js';
import { getContinuations } from '../core/continuations.js';
import { getLibraryContents, parseLibraryAlbums, parseLibraryArtists, popSongsRandomMix } from '../parsers/library.js';
import { parseAlbumHeader } from '../parsers/albums.js';
import { parseUploadedItems } from '../parsers/uploads.js';
import { YTMusicUserError } from '../core/exceptions.js';
import { validateOrderParameter, prepareOrderParams } from './utils.js';

const SUPPORTED_FILETYPES = ["mp3", "m4a", "wma", "flac", "ogg"];
const MAX_FILE_SIZE = 314572800; // 300MB in bytes

/**
 * Mixin containing upload-related methods for YouTube Music.
 */
export const UploadsMixin = {
    /**
     * Returns a list of uploaded songs.
     * @param {number|null} [limit=25] - How many songs to return. `null` retrieves them all.
     * @param {string|null} [order=null] - Order of songs ("a_to_z", "z_to_a", "recently_added").
     * @returns {Promise<Array>} List of uploaded songs.
     */
    async getLibraryUploadSongs(limit = 25, order = null) {
        if (typeof this._checkAuth === 'function') this._checkAuth();

        const endpoint = "browse";
        const body = { browseId: "FEmusic_library_privately_owned_tracks" };

        validateOrderParameter(order);
        if (order !== null) {
            body.params = prepareOrderParams(order);
        }

        const response = await this._sendRequest(endpoint, body);
        const results = getLibraryContents(response, MUSIC_SHELF);
        if (!results) return [];

        popSongsRandomMix(results);
        const songs = parseUploadedItems(results.contents || []);

        if ("continuations" in results) {
            const requestFunc = (additionalParams) => this._sendRequest(endpoint, body, additionalParams);
            const remainingLimit = limit === null ? null : (limit - songs.length);

            const continuations = await getContinuations(
                results,
                "musicShelfContinuation",
                remainingLimit,
                requestFunc,
                parseUploadedItems
            );
            songs.push(...continuations);
        }

        return songs;
    },

    /**
     * Gets the albums of uploaded songs in the user's library.
     */
    async getLibraryUploadAlbums(limit = 25, order = null) {
        if (typeof this._checkAuth === 'function') this._checkAuth();
        const body = { browseId: "FEmusic_library_privately_owned_releases" };

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
     * Gets the artists of uploaded songs in the user's library.
     */
    async getLibraryUploadArtists(limit = 25, order = null) {
        if (typeof this._checkAuth === 'function') this._checkAuth();
        const body = { browseId: "FEmusic_library_privately_owned_artists" };

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
     * Returns a list of uploaded tracks for the artist.
     */
    async getLibraryUploadArtist(browseId, limit = 25) {
        if (typeof this._checkAuth === 'function') this._checkAuth();
        const body = { browseId };
        const endpoint = "browse";

        const response = await this._sendRequest(endpoint, body);
        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST_ITEM, ...MUSIC_SHELF], true);

        if (!results) return [];

        if (results.contents && results.contents.length > 1) {
            results.contents.shift();
        }

        const items = parseUploadedItems(results.contents || []);

        if ("continuations" in results) {
            const requestFunc = (additionalParams) => this._sendRequest(endpoint, body, additionalParams);
            const remainingLimit = limit === null ? null : (limit - items.length);

            const continuations = await getContinuations(
                results,
                "musicShelfContinuation",
                remainingLimit,
                requestFunc,
                parseUploadedItems
            );
            items.push(...continuations);
        }

        return items;
    },

    /**
     * Get information and tracks of an album associated with uploaded tracks.
     */
    async getLibraryUploadAlbum(browseId) {
        if (typeof this._checkAuth === 'function') this._checkAuth();
        const body = { browseId };
        const endpoint = "browse";

        const response = await this._sendRequest(endpoint, body);
        const album = parseAlbumHeader(response);

        const results = nav(response, [...SINGLE_COLUMN_TAB, ...SECTION_LIST_ITEM, ...MUSIC_SHELF], true);
        album.tracks = results && results.contents ? parseUploadedItems(results.contents) : [];
        album.duration_seconds = sumTotalDuration(album);

        return album;
    },

    /**
     * Uploads a song to YouTube Music (Requires Node.js environment and browser auth).
     * @param {string} filepath - Path to the music file (mp3, m4a, wma, flac, ogg).
     * @returns {Promise<string|Object>} Status string or response object.
     */
    async uploadSong(filepath) {
        if (typeof this._checkAuth === 'function') this._checkAuth();

        if (this.authType && this.authType !== 'BROWSER') {
            throw new YTMusicUserError("Please provide browser authentication before using this function.");
        }

        const fp = path.resolve(filepath);
        if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
            throw new YTMusicUserError("The provided file does not exist.");
        }

        const ext = path.extname(fp).slice(1).toLowerCase();
        if (!SUPPORTED_FILETYPES.includes(ext)) {
            throw new YTMusicUserError(
                "The provided file type is not supported by YouTube Music. Supported file types are: " +
                SUPPORTED_FILETYPES.join(", ")
            );
        }

        const stats = fs.statSync(fp);
        const filesize = stats.size;
        if (filesize >= MAX_FILE_SIZE) {
            throw new YTMusicUserError(`File has size ${filesize} bytes, which is larger than the limit of 300MB.`);
        }

        const headers = { ...this.headers };
        const authUser = headers['x-goog-authuser'] || '0';
        const uploadUrl = `https://upload.youtube.com/upload/usermusic/http?authuser=${authUser}`;

        const filename = path.basename(fp);
        delete headers['content-encoding'];
        headers['content-type'] = 'application/x-www-form-urlencoded;charset=utf-8';
        headers['X-Goog-Upload-Command'] = 'start';
        headers['X-Goog-Upload-Header-Content-Length'] = filesize.toString();
        headers['X-Goog-Upload-Protocol'] = 'resumable';

        // 1. Iniciar la sesión de subida resumible
        const initResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: headers,
            body: `filename=${encodeURIComponent(filename)}`
        });

        if (!initResponse.ok) {
            return initResponse;
        }

        const actualUploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
        if (!actualUploadUrl) {
            throw new Error("Failed to retrieve resumable upload URL from Google servers.");
        }

        // 2. Subir el contenido binario del fichero
        headers['X-Goog-Upload-Command'] = 'upload, finalize';
        headers['X-Goog-Upload-Offset'] = '0';
        delete headers['content-type']; // El navegador/fetch lo gestiona con el stream o buffer

        const fileBuffer = fs.readFileSync(fp);
        const uploadResponse = await fetch(actualUploadUrl, {
            method: 'POST',
            headers: headers,
            body: fileBuffer
        });

        if (uploadResponse.status === 200) {
            return ResponseStatus.SUCCEEDED;
        }

        return uploadResponse;
    },

    /**
     * Deletes a previously uploaded song or album.
     * @param {string} entityId - Entity ID of the uploaded song or album.
     * @returns {Promise<string|Object>} Status string or error.
     */
    async deleteUploadEntity(entityId) {
        if (typeof this._checkAuth === 'function') this._checkAuth();

        const endpoint = "music/delete_privately_owned_entity";
        if (entityId.includes("FEmusic_library_privately_owned_release_detail")) {
            entityId = entityId.replace("FEmusic_library_privately_owned_release_detail", "");
        }

        const body = { entityId };
        const response = await this._sendRequest(endpoint, body);

        if (!response.error) {
            return ResponseStatus.SUCCEEDED;
        }

        return response.error;
    }
};