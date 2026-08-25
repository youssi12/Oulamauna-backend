const prisma = require("../config/db");

// ✅ LANGUAGE SERVICE
// Dynamically fetch languages from database - no hardcoded IDs!

/**
 * Get a language by its code (e.g., "EN", "AR", "FR")
 * @param {string} code - The language code
 * @returns {Promise<{language_id: number, code: string, name: string} | null>}
 */
const getLanguageByCode = async (code) => {
  if (!code) return null;
  
  try {
    const language = await prisma.languages.findUnique({
      where: { code: code.toUpperCase() }
    });
    return language;
  } catch (error) {
    console.error(`Error fetching language ${code}:`, error);
    return null;
  }
};

/**
 * Get a language by its ID
 * @param {number} languageId 
 * @returns {Promise<{language_id: number, code: string, name: string} | null>}
 */
const getLanguageById = async (languageId) => {
  if (!languageId) return null;
  
  try {
    const language = await prisma.languages.findUnique({
      where: { language_id: languageId }
    });
    return language;
  } catch (error) {
    console.error(`Error fetching language ID ${languageId}:`, error);
    return null;
  }
};

/**
 * Get all available languages
 * @returns {Promise<Array<{language_id: number, code: string, name: string}>>}
 */
const getAllLanguages = async () => {
  try {
    const languages = await prisma.languages.findMany({
      orderBy: { language_id: 'asc' }
    });
    return languages;
  } catch (error) {
    console.error("Error fetching all languages:", error);
    return [];
  }
};

/**
 * Validate if a language code exists in the database
 * @param {string} code 
 * @returns {Promise<boolean>}
 */
const isValidLanguageCode = async (code) => {
  if (!code) return false;
  const language = await getLanguageByCode(code);
  return language !== null;
};

/**
 * Get language ID by code (helper for controllers)
 * @param {string} code 
 * @returns {Promise<number | null>}
 */
const getLanguageIdByCode = async (code) => {
  const language = await getLanguageByCode(code);
  return language ? language.language_id : null;
};

module.exports = {
  getLanguageByCode,
  getLanguageById,
  getAllLanguages,
  isValidLanguageCode,
  getLanguageIdByCode
};