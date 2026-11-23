/**
 * @fileoverview Cryptographic utilities for YouTube Music authentication.
 */

import { YTM_DOMAIN } from '../core/constants.js';

/**
 * Extracts the __Secure-3PAPISID token from a raw cookie string.
 * @param {string} rawCookie - The raw cookie string.
 * @returns {string|null} The SAPISID token, or null if not found.
 */
export function getSapisidFromCookie(rawCookie) {
    // TODO: Revisar si necesitamos decodificar URI aquí en caso de que vengan cookies raras
    const match = rawCookie.match(/(?:__Secure-3PAPISID|SAPISID)=([^;]+)/);
    return match ? match[1].replace(/"/g, '') : null;
}

/**
 * Generates the SAPISIDHASH value required by Google's internal APIs.
 * Reverse engineered from YouTube's client scripts.
 * @param {string} sapisid - The extracted SAPISID token.
 * @param {string} origin - The origin URL (usually YTM_DOMAIN).
 * @returns {Promise<string>} The formatted SAPISIDHASH header value.
 */
export async function generateAuthorization(sapisid, origin = YTM_DOMAIN) {
    const unixTimestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${unixTimestamp} ${sapisid} ${origin}`;

    // Web Crypto API is standard across Node >= 19, Bun, Deno, and Browsers
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    // TODO: Asegurarse de que el entorno donde se ejecute tenga globalThis.crypto accesible
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);

    // Convert buffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `SAPISIDHASH ${unixTimestamp}_${hashHex}`;
}