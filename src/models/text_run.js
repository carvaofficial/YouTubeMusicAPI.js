/**
 * @fileoverview Type definitions for text runs.
 * These are purely JSDoc typedefs to provide IDE autocompletion and type checking,
 * mapping exactly to the TypedDicts from the original Python library.
 */

/**
 * Represents a text run that contains a hyperlink.
 * @typedef {Object} HyperLink
 * @property {string} text - The display text.
 * @property {string} url - The URL the text links to.
 */

/**
 * Represents a plain text run without a hyperlink.
 * @typedef {Object} PlainText
 * @property {string} text - The display text.
 */

/**
 * A TextRun can be either a HyperLink or PlainText.
 * @typedef {HyperLink|PlainText} TextRun
 */

// Exportamos un objeto vacío por si algún archivo hace un import real de este módulo
export {};