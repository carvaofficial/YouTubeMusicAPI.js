/**
 * @fileoverview Utilities for parsing and determining the type of credentials.
 */
import fs from 'fs';
import path from 'path';
import { AuthType } from './types.js';

/**
 * Parses the authentication string or object and returns normalized headers.
 * @param {string|Object} auth - JSON string, JSON file path, or plain object.
 * @returns {Promise<{headers: Object, authPath: string|null}>}
 */
export async function parseAuth(auth) {
    let inputJson;
    let authPath = null;

    if (typeof auth === 'string') {
        if (auth.trim().startsWith('{')) {
            inputJson = JSON.parse(auth);
        } else {
            /**
             * If it's not a JSON, we assume it's a file path.
             * We use dynamic import to avoid breaking agnostic compatibility in environments without 'fs'
             */
            try {
                const fs = await import('node:fs/promises');
                const fileContent = await fs.readFile(auth, 'utf-8');
                inputJson = JSON.parse(fileContent);
                authPath = auth;
            } catch (err) {
                throw new Error("[YTM-JS] Invalid auth JSON string or file path provided, or environment lacks file system access.");
            }
        }
    } else if (typeof auth === 'object' && auth !== null) {
        inputJson = auth;
    } else {
        throw new Error("[YTM-JS] Invalid auth type provided.");
    }

    // Emulate Python's CaseInsensitiveDict by lowercasing keys and URL-encoding string values.
    const headers = {};
    for (const [key, value] of Object.entries(inputJson)) {
        const lowerKey = key.toLowerCase();
        headers[lowerKey] = (typeof value === 'string') ? encodeURI(value) : value;
    }

    return { headers, authPath };
}

/**
 * Parses authentication input synchronously (file path, JSON string, or object).
 * @param {string|Object} authParam 
 * @returns {{ headers: Object, authPath: string|null }}
 */
export function parseAuthSync(authParam) {
    let headers = {};
    let authPath = null;

    if (!authParam) {
        return { headers, authPath };
    }

    if (typeof authParam === 'string') {
        // Resolvemos la ruta de forma absoluta basada en la raíz desde donde ejecutaste Node
        const absolutePath = path.resolve(process.cwd(), authParam);

        try {
            if (fs.existsSync(absolutePath)) {
                authPath = absolutePath;
                const rawData = fs.readFileSync(absolutePath, 'utf8');
                headers = JSON.parse(rawData);
            } else {
                // Si no es un archivo, intentamos parsearlo como un string JSON directo
                headers = JSON.parse(authParam);
            }
        } catch (e) {
            // Si tampoco es JSON, se procesa como string de cookies plano
            headers = { cookie: authParam };
        }
    } else if (typeof authParam === 'object') {
        headers = authParam;
    }

    return { headers, authPath };
}

function parseAuthStrSyncLocal(authStr) {
    const headers = {};
    // Lógica para parsear cookies si fuera necesario
    headers['cookie'] = authStr;
    return headers;
}

/**
 * Determines authentication type based on headers.
 * @param {Object} authHeaders - Already normalized (lowercased) authentication headers.
 * @returns {string} Authentication type (from AuthType).
 */
export function determineAuthType(authHeaders) {
    /**
     * Assume OAuth by default if fields like client_id/refresh_token exist (to be implemented later)
     * For now, use it as the base type
     */
    let authType = AuthType.OAUTH_CUSTOM_CLIENT;

    const authorization = authHeaders['authorization'];

    if (authorization) {
        if (authorization.includes('SAPISIDHASH')) {
            authType = AuthType.BROWSER;
        } else if (authorization.startsWith('Bearer')) {
            authType = AuthType.OAUTH_CUSTOM_FULL;
        }
    }

    return authType;
}