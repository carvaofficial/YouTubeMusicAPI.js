# YouTubeMusicAPI.js

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()
[![Runtimes](https://img.shields.io/badge/runtime-Node.js%20%7C%20Bun%20%7C%20Deno-black.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-Types%20Included-3178C6.svg)]()

A lightweight, zero-dependency JavaScript port of [ytmusicapi](https://github.com/sigma67/ytmusicapi). Runtime-agnostic for **Node.js**, **Bun**, and **Deno**.

> [!NOTE]
> **AI-Assisted Port & Project Status:** This project is a JavaScript port of the original Python library `ytmusicapi`, built with the assistance of AI. The repository is a work in progress and **will be updated gradually** as endpoints are tested, refined, and kept in sync with YouTube Music changes.

---

## Features

- **Zero Dependencies:** Built purely on modern Web Standards (`fetch`, `URLSearchParams`, and the Web Crypto API).
- **Runtime-Agnostic:** Works seamlessly on **Node.js** (v19+), **Bun**, and **Deno**.
- **TypeScript Ready:** Ships with auto-generated `.d.ts` type definitions for full IntelliSense and autocompletion.
- **Public & Private Access:** Supports unauthenticated requests (search, charts, albums, artists) as well as authenticated library management (playlists, history, likes, uploads).
- **Familiar API:** Mirrors the design and capabilities of the original `ytmusicapi`, adapted to idiomatic `async/await` JavaScript (`camelCase`).

---

## Installation

Using **npm**:

```bash
npm install youtubemusicapi.js
```

Using **Bun**:

```bash
bun add youtubemusicapi.js
```

Or install directly from GitHub while the package is in active development:

```bash
npm install github:YOUR_USERNAME/YouTubeMusicAPI.js
```

---

## Usage

### Unauthenticated Requests

For public data such as searching, browsing artists/albums, or fetching charts, no authentication is required:

```javascript
import { YTMusic } from 'youtubemusicapi.js';

const ytmusic = new YTMusic();

const results = await ytmusic.search('Oasis Wonderwall', 'songs');
console.log(results[0]);

const charts = await ytmusic.getCharts('ES');
console.log(charts.countries);
```

---

### Authenticated Requests

To access private data (such as your listening history, library playlists, liked songs, or playlist management), you need to generate an authentication JSON file using the built-in CLI (`ytmusicapi`).

#### Option 1: Browser Authentication (Recommended)

Browser authentication uses your active YouTube Music session headers and dynamically signs every request with `SAPISIDHASH` using the Web Crypto API. This is currently the most reliable method for private endpoints and **Brand Accounts**.

**1. Generate `browser.json` via CLI:**

```bash
# Using npx (Node.js)
npx ytmusicapi browser

# Using bunx (Bun)
bunx ytmusicapi browser
```

Follow the interactive prompt:
1. Open [YouTube Music](https://music.youtube.com) in your browser while signed in.
2. Open Developer Tools (`F12`) and go to the **Network** tab.
3. Filter by `/browse`, click on any authenticated `POST` request, and copy the **Request Headers**.
4. Paste the headers into the terminal and confirm to generate `browser.json`.

**2. Initialize the client:**

```javascript
import { YTMusic } from 'youtubemusicapi.js';

const ytmusic = new YTMusic({ auth: './browser.json' });

// Classic ytmusicapi example: create a playlist and add a song
const playlistId = await ytmusic.createPlaylist('test', 'test description');
const searchResults = await ytmusic.search('Oasis Wonderwall');
await ytmusic.addPlaylistItems(playlistId, [searchResults[0].videoId]);

// Fetch your listening history
const history = await ytmusic.getHistory();
console.log(`Latest track: ${history[0].title}`);
```

---

#### Option 2: OAuth Authentication

OAuth uses a Google Cloud TV/Limited Input Device client and automatically refreshes expired access tokens in the background.

**1. Generate `oauth.json` via CLI:**

```bash
# Using npx (Node.js)
npx ytmusicapi oauth

# Using bunx (Bun)
bunx ytmusicapi oauth
```

Follow the prompts to enter your Google Cloud `client_id` and `client_secret`, authorize your account via the verification URL, and save `oauth.json`.

**2. Initialize the client:**

```javascript
import { YTMusic, OAuthCredentials } from 'youtubemusicapi.js';

const ytmusic = new YTMusic({
  auth: './oauth.json',
  oauthCredentials: new OAuthCredentials(
    process.env.YTMUSIC_CLIENT_ID,
    process.env.YTMUSIC_CLIENT_SECRET
  ),
});

const playlists = await ytmusic.getLibraryPlaylists(10);
console.log(playlists);
```

> [!WARNING]
> Due to ongoing restrictions by Google on YouTube's internal API, OAuth tokens may return `HTTP 400: Request contains an invalid argument` on certain private endpoints (such as `getHistory`) or when using **Brand Accounts**. If you encounter this issue, use **Browser Authentication** instead.

---

### Configuration Options

```javascript
const ytmusic = new YTMusic({
  auth: './browser.json', // Path to JSON file, JSON string, or headers object
  oauthCredentials: null, // Instance of OAuthCredentials (only for OAuth)
  language: 'en',         // Response language (e.g. 'en', 'es', 'fr', 'ja')
  location: '',           // Country code for regional results (e.g. 'US', 'ES')
});
```
## Supported Modules

| Module | Key Methods |
| :--- | :--- |
| **Search** | `search`, `getSearchSuggestions`, `removeSearchSuggestions` |
| **Browsing** | `getHome`, `getArtist`, `getArtistAlbums`, `getAlbum`, `getSong`, `getSongRelated`, `getLyrics`, `getUser` |
| **Explore & Charts** | `getExplore`, `getCharts`, `getMoodCategories`, `getMoodPlaylists` |
| **Library** | `getLibraryPlaylists`, `getLibrarySongs`, `getLibraryAlbums`, `getLibraryArtists`, `getHistory`, `rateSong` |
| **Playlists** | `getPlaylist`, `createPlaylist`, `editPlaylist`, `deletePlaylist`, `addPlaylistItems`, `removePlaylistItems` |
| **Watch** | `getWatchPlaylist` |
| **Podcasts** | `getChannel`, `getPodcast`, `getEpisode`, `getSavedEpisodes` |
| **Uploads** | `getLibraryUploadSongs`, `getLibraryUploadAlbums`, `getLibraryUploadArtists`, `uploadSong`, `deleteUploadEntity` |

For detailed information on YouTube Music's data structures and behavior, refer to the [official ytmusicapi documentation](https://ytmusicapi.readthedocs.io/).

---

## Roadmap & Updates

This repository is maintained incrementally and will continue evolving over time:

- [x] Core InnerTube client with zero dependencies
- [x] Browser (`SAPISIDHASH`) and OAuth2 token auto-refresh authentication
- [x] Full port of core mixins, parsers, and continuations
- [x] Auto-generated TypeScript declarations (`.d.ts`)
- [ ] Expanded automated test suite across Node.js, Bun, and Deno
- [ ] Interactive CLI setup wizard (`ytmusicapi` bin)
- [ ] Ongoing fixes and parity updates with upstream `ytmusicapi`

Bug reports, feedback, and pull requests are welcome.

---

## Acknowledgements

A huge thank you to **[sigma67](https://github.com/sigma67)** and all the contributors of the original **[ytmusicapi](https://github.com/sigma67/ytmusicapi)** project. Their reverse-engineering work, parser design, and thorough documentation made this JavaScript port possible.

This port was developed with AI assistance to translate, adapt, and modernize the codebase for the JavaScript ecosystem.

---

## Disclaimer & License

This is an unofficial library and is not affiliated with, endorsed by, or connected to Google or YouTube in any way. Use it responsibly and at your own risk.

Released under the [MIT License](LICENSE).