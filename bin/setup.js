#!/usr/bin/env node

/**
 * @fileoverview CLI setup utilities for generating authentication files.
 */
import { setupBrowser } from '../src/auth/browser.js';
import { OAuthCredentials } from '../src/auth/oauth/credentials.js';
import { RefreshingToken } from '../src/auth/oauth/token.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve } from 'node:path';

/**
 * Starts the OAuth flow from the terminal.
 * @param {string} clientId - The Google API client ID.
 * @param {string} clientSecret - The Google API client secret.
 * @param {string|null} [filepath=null] - Optional filepath to store headers to.
 * @returns {Promise<RefreshingToken>} The generated token object.
 */
export async function setupOauth(clientId, clientSecret, filepath = null) {
    const credentials = new OAuthCredentials(clientId, clientSecret);

    // 1. Get the device code
    const code = await credentials.getCode();
    const url = `${code.verification_url}?user_code=${code.user_code}`;

    console.log(`\n[YTM-JS] Action Required!`);
    console.log(`Go to the following URL in your browser, finish the login flow, and authorize the app:`);
    console.log(`👉 ${url}\n`);

    // 2. Wait for user confirmation in the terminal
    const rl = readline.createInterface({ input, output });
    await rl.question(`[YTM-JS] Press [Enter] ONLY when you have finished the login flow...`);
    rl.close();

    // 3. Fetch the full token using the device code
    console.log(`[YTM-JS] Fetching tokens...`);
    const rawToken = await credentials.tokenFromCode(code.device_code);

    // Defensive parsing for the 2026 bug we fixed earlier
    const refreshExpiresIn = rawToken.refresh_token_expires_in || rawToken.expires_in;

    const token = new RefreshingToken({
        access_token: rawToken.access_token,
        refresh_token: rawToken.refresh_token,
        scope: rawToken.scope,
        token_type: rawToken.token_type,
        expires_in: refreshExpiresIn,
        credentials: credentials,
        localCache: filepath
    });

    token.update(rawToken);

    if (filepath) {
        await token.storeToken();
        console.log(`[YTM-JS] ✅ OAuth credentials successfully saved to: ${resolve(filepath)}`);
    }

    return token;
}

/**
 * Minimal CLI parser equivalent to Python's argparse and main().
 * Can be executed directly via `node src/setup.js <type>`
 */
async function main() {
    // Basic argument parsing (Node.js slices the first two paths: node executable and script path)
    const args = process.argv.slice(2);
    const setupType = args[0];

    if (!setupType || !['oauth', 'browser'].includes(setupType)) {
        console.error("Usage: node setup.js [oauth|browser] [--file path.json] [--client-id ID] [--client-secret SECRET]");
        process.exit(1);
    }

    // Naive flag parser
    const getFlag = (flag) => {
        const index = args.indexOf(flag);
        return index !== -1 ? args[index + 1] : null;
    };

    const filepath = getFlag('--file') || `${setupType}.json`;
    console.log(`Creating ${resolve(filepath)} with your authentication credentials...\n`);

    if (setupType === 'oauth') {
        const rl = readline.createInterface({ input, output });

        let clientId = getFlag('--client-id');
        if (!clientId) {
            clientId = await rl.question("Enter your Google YouTube Data API client ID: ");
        }

        let clientSecret = getFlag('--client-secret');
        if (!clientSecret) {
            clientSecret = await rl.question("Enter your Google YouTube Data API client secret: ");
        }

        rl.close();

        try {
            await setupOauth(clientId, clientSecret, filepath);
        } catch (err) {
            console.error(`\n[Error] Setup failed: ${err.message}`);
        }

    } else if (setupType === 'browser') {
        const rl = readline.createInterface({ input, output });
        console.log("Please paste the request headers from Firefox or Chrome/Edge.");
        console.log("Press [Enter] on an empty line to finish and save.");

        let headersRaw = "";
        for await (const line of rl) {
            if (line.trim() === "") break;
            headersRaw += line + "\n";
        }
        rl.close();

        try {
            await setupBrowser(headersRaw, filepath);
            console.log(`[YTM-JS] ✅ Browser credentials successfully saved to: ${resolve(filepath)}`);
        } catch (err) {
            console.error(`\n[Error] Setup failed: ${err.message}`);
        }
    }
}

main().catch(err => {
    console.error("\n[YTM-JS Fatal Error]", err);
    process.exit(1);
});