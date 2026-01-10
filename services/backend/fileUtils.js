/**
 * File Utilities Module
 * Common file and filename operations
 */

const path = require('path');

// Constants
const FORMAT_EXTENSIONS = {
  'JPEG': '.jpg',
  'WEBP': '.webp',
  'PNG': '.png',
  'GIF': '.gif',
};

/**
 * Sanitize a filename for safe filesystem storage
 * Replaces unsafe characters with underscores
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Determine thumbnail format based on MIME type
 * @param {string} mimeType - MIME type of the original file
 * @returns {string} - Thumbnail format ('WEBP' or 'JPEG')
 */
function getThumbnailFormat(mimeType) {
  if (!mimeType) {
    return 'JPEG';
  }
  
  // Support WEBP for WEBP sources, use JPEG for everything else (better compatibility)
  const normalizedMimeType = mimeType.toLowerCase();
  
  if (normalizedMimeType.includes('webp')) {
    return 'WEBP';
  }
  
  return 'JPEG';
}

/**
 * Get file extension for a given format
 * @param {string} format - Format name ('JPEG', 'WEBP', etc.)
 * @returns {string} - File extension including dot (e.g., '.jpg')
 */
function getExtensionForFormat(format) {
  return FORMAT_EXTENSIONS[format.toUpperCase()] || '.jpg';
}

/**
 * Extract base filename without extension
 * @param {string} filename - Original filename
 * @returns {string} - Base filename without extension
 */
function getBaseFilename(filename) {
  return path.parse(filename).name;
}

/**
 * Get file extension from filename
 * @param {string} filename - Original filename
 * @returns {string} - File extension including dot (e.g., '.jpg')
 */
function getExtension(filename) {
  return path.parse(filename).ext || '.jpg';
}

module.exports = {
  sanitizeFilename,
  getThumbnailFormat,
  getExtensionForFormat,
  getBaseFilename,
  getExtension,
};
