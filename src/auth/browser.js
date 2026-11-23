/**
 * @fileoverview Utility to parse raw headers copied from the browser.
 */

/**
 * Checks whether headers already have the minimum browser structure.
 * @param {Object} headers - Object with normalized headers.
 * @returns {boolean}
 */
export function isBrowser(headers) {
    const keys = Object.keys(headers);
    return keys.includes("authorization") && keys.includes("cookie");
}

/**
 * Parses a text block with headers copied from Chrome/Firefox/Edge.
 * Cleans unnecessary headers and returns a stringified JSON ready to use.
 * @param {string} headersRaw - Raw text copied from DevTools.
 * @param {string} [filepath=null] - Optional path to save the resulting JSON.
 * @returns {Promise<string>} Stringified JSON with cleaned headers.
 */
export async function setupBrowser(headersRaw, filepath = null) {
    if (!headersRaw || typeof headersRaw !== "string") {
        throw new Error("[YTM-JS] setupBrowser requires a raw headers string.");
    }

    const contents = headersRaw.split("\n").map(line => line.trim()).filter(Boolean);
    const userHeaders = {};
    let chromeRememberedKey = "";

    try {
        for (const content of contents) {
            // Ignore HTTP/2 pseudo-headers (e.g. :authority)
            if (content.startsWith(":")) continue;

            const headerParts = content.split(": ");

            // Logic to support Chrome's peculiar multiline copy format
            if (content.endsWith(":")) {
                chromeRememberedKey = content.replace(":", "");
            }

            if (headerParts.length === 1) {
                if (chromeRememberedKey) {
                    userHeaders[chromeRememberedKey.toLowerCase()] = headerParts[0];
                    if (!headerParts[0].endsWith(":") && (chromeRememberedKey !== "Decoded" || headerParts[0] === "}")) {
                        chromeRememberedKey = "";
                    }
                } else {
                    chromeRememberedKey = headerParts[0];
                }
                continue;
            }

            userHeaders[headerParts[0].toLowerCase()] = headerParts.slice(1).join(": ");
        }
    } catch (err) {
        throw new Error(`[YTM-JS Error] Error parsing your input: ${err.message}`);
    }

    // Validate required headers
    const missingHeaders = ["cookie", "x-goog-authuser"].filter(k => !userHeaders[k]);
    if (missingHeaders.length > 0) {
        throw new Error(
            `[YTM-JS Error] The following entries are missing in your headers: ${missingHeaders.join(", ")}. ` +
            `Please try a different request (such as /browse) and make sure you are logged in.`
        );
    }

    // Remove useless or conflicting headers
    const ignoreHeaders = new Set(["host", "content-length", "accept-encoding"]);
    for (const key of Object.keys(userHeaders)) {
        if (key.startsWith("sec") || ignoreHeaders.has(key)) {
            delete userHeaders[key];
        }
    }

    // Optional file save (agnostic: silently fails if File System is unavailable)
    if (filepath) {
        try {
            const fs = await import("node:fs/promises");
            await fs.writeFile(filepath, JSON.stringify(userHeaders, null, 4), "utf-8");
        } catch (e) {
            console.warn(`[YTM-JS] Could not write to ${filepath}. Environment might not support fs.`);
        }
    }

    return JSON.stringify(userHeaders);
}