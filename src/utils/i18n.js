const i18n = require("i18n");
const path = require("path");

// Configure i18n
i18n.configure({
  locales: ["en", "hi"],
  defaultLocale: "en",
  directory: path.join(__dirname, "../locales"),
  objectNotation: true,
  updateFiles: false,
  autoReload: false,
  syncFiles: false,
});

// Initialize i18n
i18n.init();

/**
 * Get translation for a given key
 * @param {string} locale - Locale code (en, hi)
 * @param {string} key - Translation key (e.g., "errors.badRequest")
 * @param {Object} variables - Variables to interpolate in the translation
 * @returns {string} Translated message
 */
function translate(locale, key, variables = {}) {
  const originalLocale = i18n.getLocale();
  const targetLocale = locale || "en";

  // Set locale temporarily
  i18n.setLocale(targetLocale);

  // ✅ Proper interpolation using i18n
  let translated = i18n.__(key, variables);

  // Restore original locale
  i18n.setLocale(originalLocale || "en");

  return translated;
}


/**
 * Get translation helper that uses current locale
 * @param {string} locale - Locale code
 * @returns {Function} Translation function
 */
function getTranslator(locale) {
  return (key, variables = {}) => {
    return translate(locale || "en", key, variables);
  };
}

module.exports = {
  translate,
  getTranslator,
  i18n,
};

