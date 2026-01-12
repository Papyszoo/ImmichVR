/**
 * Date utility functions for photo grouping
 */

/**
 * Group photos by month/year like Immich
 * @param {Array} photos - Array of photo objects
 * @returns {Array} Array of group objects sorted by date (newest first)
 */
export function groupPhotosByDate(photos) {
  const groups = {};
  
  photos.forEach(photo => {
    const dateStr = photo.fileCreatedAt || photo.localDateTime || photo.createdAt;
    const date = dateStr ? new Date(dateStr) : new Date();
    const key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    
    if (!groups[key]) {
      groups[key] = {
        label: key,
        date: date,
        year: date.getFullYear(),
        photos: []
      };
    }
    groups[key].photos.push(photo);
  });
  
  // Sort groups by date (newest first)
  return Object.values(groups).sort((a, b) => b.date - a.date);
}
