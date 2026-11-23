/**
 * @fileoverview Public entry point for the YouTube Music API library.
 */

import { YTMusicBase } from './core/base.js';
import { OAuthCredentials } from './auth/oauth/credentials.js';
import { ResponseStatus } from './core/enums.js';
import { YTMusicUserError, YTMusicServerError } from './core/exceptions.js';

import { BrowsingMixin } from './modules/browsing.js';
import { ChartsMixin } from './modules/charts.js';
import { ExploreMixin } from './modules/explore.js';
import { LibraryMixin } from './modules/library.js';
import { PlaylistsMixin } from './modules/playlists.js';
import { PodcastsMixin } from './modules/podcasts.js';
import { SearchMixin } from './modules/search.js';
import { UploadsMixin } from './modules/uploads.js';
import { WatchMixin } from './modules/watch.js';

/**
 * Allows automated interactions with YouTube Music by emulating the YouTube web client's requests.
 * Permits both authenticated and non-authenticated requests.
 */
class YTMusicAPI extends YTMusicBase {
    /**
     * Initializes the client.
     * @param {Object} options 
     * @param {string} [options.language="en"] - Language for the results.
     * @param {string} [options.location=""] - Location (e.g., "ES").
     */
    constructor(options = {}) {
        // Inicializa el motor base
        super(options);
    }
}

// Inyectamos todos los mixins en el prototipo de la clase (equivalente a la herencia múltiple de Python)
Object.assign(
    YTMusicAPI.prototype,
    BrowsingMixin,
    ChartsMixin,
    ExploreMixin,
    LibraryMixin,
    PlaylistsMixin,
    PodcastsMixin,
    SearchMixin,
    UploadsMixin,
    WatchMixin,
);

// Exportamos todo lo que el usuario final pueda necesitar instanciar o comprobar por su cuenta
export {
    YTMusicAPI,
    YTMusicAPI as YTMusic,
    YTMusicAPI as YTMusicClient,
    OAuthCredentials,
    ResponseStatus,
    YTMusicUserError,
    YTMusicServerError,
};