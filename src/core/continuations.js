/**
 * @fileoverview Utilities for handling YouTube Music paginated continuations.
 */
import { nav } from './navigation.js';

const CONTINUATION_TOKEN = ["continuationItemRenderer", "continuationEndpoint", "continuationCommand", "token"];
const COMMAND_EXECUTOR_COMMANDS = [
    "continuationItemRenderer",
    "continuationEndpoint",
    "commandExecutorCommand",
    "commands",
];
const CONTINUATION_ITEMS = ["onResponseReceivedActions", 0, "appendContinuationItemsAction", "continuationItems"];

/**
 * Extracts the continuation token from the last result item.
 * @param {Array<Object>} results - The list of results.
 * @returns {string|null} The continuation token or null if not found.
 */
export function getContinuationToken(results) {
    if (!results || results.length === 0) return null;

    const lastResult = results[results.length - 1];
    const token = nav(lastResult, CONTINUATION_TOKEN, true);

    if (token) return token;

    // Continuation tokens may be nested in a commandExecutorCommand list
    const commands = nav(lastResult, COMMAND_EXECUTOR_COMMANDS, true) || [];
    for (const command of commands) {
        if (nav(command, ["continuationCommand", "request"], true) === "CONTINUATION_REQUEST_TYPE_BROWSE") {
            return nav(command, ["continuationCommand", "token"]);
        }
    }

    return null;
}

/**
 * Fetches continuous items (2025 structure) until the limit is reached or no more items exist.
 * @param {Object} results - Initial results dictionary.
 * @param {number|null} limit - Maximum number of items to retrieve.
 * @param {Function} requestFunc - Async function to perform the request.
 * @param {Function} parseFunc - Function to parse the returned items.
 * @returns {Promise<Array<Object>>} List of parsed items.
 */
export async function getContinuations2025(results, limit, requestFunc, parseFunc) {
    const items = [];
    let continuationToken = getContinuationToken(results["contents"] || []);

    while (continuationToken && (limit === null || items.length < limit)) {
        const response = await requestFunc({ continuation: continuationToken });
        const continuationItems = nav(response, CONTINUATION_ITEMS, true);

        if (!continuationItems) break;

        const contents = parseFunc(continuationItems);
        if (contents.length === 0) break;

        items.push(...contents);
        continuationToken = getContinuationToken(continuationItems);
    }

    return items;
}

/**
 * Reloadable continuations are a special case that only exists on the playlists page (suggestions).
 * @param {Object} results - Initial results dictionary.
 * @param {string} continuationType - Type of continuation to navigate.
 * @param {number|null} limit - Maximum number of items.
 * @param {Function} requestFunc - Async function to perform the request.
 * @param {Function} parseFunc - Function to parse the returned items.
 * @returns {Promise<Array<Object>>}
 */
export async function getReloadableContinuations(results, continuationType, limit, requestFunc, parseFunc) {
    const additionalParams = getReloadableContinuationParams(results);
    return getContinuations(results, continuationType, limit, requestFunc, parseFunc, "", additionalParams);
}

/**
 * Fetches standard continuations.
 * @param {Object} results - Initial results dictionary.
 * @param {string} continuationType - Type of continuation to navigate.
 * @param {number|null} limit - Maximum number of items.
 * @param {Function} requestFunc - Async function to perform the request.
 * @param {Function} parseFunc - Function to parse the returned items.
 * @param {string} [ctokenPath=""] - Specifier applied to retrieve the ctoken.
 * @param {string|null} [additionalParams=null] - Additional URL parameters.
 * @returns {Promise<Array<Object>>}
 */
export async function getContinuations(
    results,
    continuationType,
    limit,
    requestFunc,
    parseFunc,
    ctokenPath = "",
    additionalParams = null
) {
    const items = [];
    let currentResults = results;

    while ("continuations" in currentResults && (limit === null || items.length < limit)) {
        const params = additionalParams || getContinuationParams(currentResults, ctokenPath);
        const response = await requestFunc(params);

        if (response && response["continuationContents"]) {
            currentResults = response["continuationContents"][continuationType];
        } else {
            break;
        }

        const contents = getContinuationContents(currentResults, parseFunc);
        if (contents.length === 0) break;

        items.push(...contents);
    }

    return items;
}

/**
 * Fetches validated continuations, retrying if the response is incomplete.
 * @param {Object} results - Initial results.
 * @param {string} continuationType - Type of continuation.
 * @param {number} limit - Target item limit.
 * @param {number} perPage - Expected items per page.
 * @param {Function} requestFunc - Async request function.
 * @param {Function} parseFunc - Parsing function.
 * @param {string} [ctokenPath=""] - Specifier for ctoken.
 * @returns {Promise<Array<Object>>}
 */
export async function getValidatedContinuations(
    results,
    continuationType,
    limit,
    perPage,
    requestFunc,
    parseFunc,
    ctokenPath = ""
) {
    const items = [];
    let currentResults = results;

    while ("continuations" in currentResults && items.length < limit) {
        const additionalParams = getContinuationParams(currentResults, ctokenPath);

        const wrappedParseFunc = (rawResponse) => getParsedContinuationItems(rawResponse, parseFunc, continuationType);
        const validateFunc = (parsed) => validateResponse(parsed, perPage, limit, items.length);

        const response = await resendRequestUntilParsedResponseIsValid(
            requestFunc,
            additionalParams,
            wrappedParseFunc,
            validateFunc,
            3
        );

        currentResults = response.results;
        items.push(...response.parsed);
    }

    return items;
}

/**
 * Helper to parse continuation items.
 * @param {Object} response - The raw response.
 * @param {Function} parseFunc - The parsing logic.
 * @param {string} continuationType - The continuation subkey.
 * @returns {Object} Dictionary with raw results and parsed items.
 */
export function getParsedContinuationItems(response, parseFunc, continuationType) {
    // TODO: Comprobar que continuationContents existe antes de acceder
    const results = response["continuationContents"][continuationType];
    return {
        results: results,
        parsed: getContinuationContents(results, parseFunc)
    };
}

/**
 * Extracts continuation params from results.
 * @param {Object} results - Results object.
 * @param {string} [ctokenPath=""] - Path modifier.
 * @returns {string} The formatted URL parameters.
 */
export function getContinuationParams(results, ctokenPath = "") {
    const ctoken = nav(results, ["continuations", 0, `next${ctokenPath}ContinuationData`, "continuation"]);
    return getContinuationString(ctoken);
}

/**
 * Extracts reloadable continuation params from results.
 * @param {Object} results - Results object.
 * @returns {string} The formatted URL parameters.
 */
export function getReloadableContinuationParams(results) {
    const ctoken = nav(results, ["continuations", 0, "reloadContinuationData", "continuation"]);
    return getContinuationString(ctoken);
}

/**
 * Formats the continuation token into query parameters.
 * @param {string} ctoken - The continuation token.
 * @returns {string} Formatted string.
 */
export function getContinuationString(ctoken) {
    return `&ctoken=${ctoken}&continuation=${ctoken}`;
}

/**
 * Parses the actual contents from a continuation block.
 * @param {Object} continuation - The continuation sub-block.
 * @param {Function} parseFunc - The parser function.
 * @returns {Array<Object>}
 */
export function getContinuationContents(continuation, parseFunc) {
    for (const term of ["contents", "items"]) {
        if (term in continuation) {
            return parseFunc(continuation[term]);
        }
    }
    return [];
}

/**
 * Keeps requesting and parsing until validation passes or max retries are hit.
 * @param {Function} requestFunc - Async request function.
 * @param {string} requestAdditionalParams - Additional URL params.
 * @param {Function} parseFunc - Function that parses the raw response.
 * @param {Function} validateFunc - Function that validates the parsed result.
 * @param {number} maxRetries - Maximum retry attempts.
 * @returns {Promise<Object>} The best parsed object found.
 */
export async function resendRequestUntilParsedResponseIsValid(
    requestFunc,
    requestAdditionalParams,
    parseFunc,
    validateFunc,
    maxRetries
) {
    let response = await requestFunc(requestAdditionalParams);
    let parsedObject = parseFunc(response);
    let retryCounter = 0;

    while (!validateFunc(parsedObject) && retryCounter < maxRetries) {
        response = await requestFunc(requestAdditionalParams);
        const attempt = parseFunc(response);

        // If the new attempt yielded more parsed items, keep it
        if (attempt.parsed.length > parsedObject.parsed.length) {
            parsedObject = attempt;
        }
        retryCounter++;
    }

    return parsedObject;
}

/**
 * Validates if the response returned the expected minimum number of items.
 * @param {Object} response - The parsed response object containing a "parsed" array.
 * @param {number} perPage - Expected items per page.
 * @param {number} limit - Total absolute limit.
 * @param {number} currentCount - How many items we already have.
 * @returns {boolean} True if the response is valid.
 */
export function validateResponse(response, perPage, limit, currentCount) {
    const remainingItemsCount = limit - currentCount;
    const expectedItemsCount = Math.min(perPage, remainingItemsCount);

    return response.parsed.length >= expectedItemsCount;
}