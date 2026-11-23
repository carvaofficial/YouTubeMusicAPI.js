/**
 * @fileoverview Minimal i18n system replacing gettext for parsing translated Google JSONs.
 */

export class I18n {
    /**
     * @param {string} [language="en"] - Language code (e.g. "es", "fr", "pt_BR").
     */
    constructor(language = 'en') {
        this.language = language;
        this.translations = {};
    }

    /**
     * Loads translations asynchronously from JSON files.
     * Environment agnostic: works in Node and is "bundler-friendly".
     * @returns {Promise<void>}
     */
    async setup() {
        if (this.language === 'en') {
            return; // English is the original msgid, no dictionary needed
        }

        try {
            // Dynamic import of the language JSON
            // The assert { type: "json" } / with { type: "json" } is the ESM standard
            const module = await import(`../locales/${this.language}.json`, {
                with: { type: 'json' }
            });

            // Compatibility in case the bundler wraps it in a "default"
            this.translations = module.default || module;
        } catch (error) {
            // If the language is not supported or fails, we silently fall back to English
            this.translations = {};
        }
    }

    /**
     * Gets the translation of a text string.
     * Equivalent to the `_('string')` function in Python's gettext.
     * @param {string} text - The original text in English (msgid).
     * @returns {string} The translated text, or the original if not found.
     */
    getTranslation(text) {
        return this.translations[text] || text;
    }
}