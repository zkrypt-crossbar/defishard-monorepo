
/**
 * Formats a long ID with a tooltip showing the full ID
 * @param {string} id - The ID to format
 * @param {number} maxLength - Maximum length before truncating (default: 30)
 * @returns {object} - Object with formatted text and full ID for tooltip
 */
export const formatLongIdWithTooltip = (id, maxLength = 30) => {
  if (!id) return { text: 'None', full: 'None' };
  
  if (id.length <= maxLength) {
    return { text: id, full: id };
  }
  
  const firstPart = id.substring(0, 10);
  const lastPart = id.substring(id.length - 10);
  
  return {
    text: `${firstPart}...${lastPart}`,
    full: id
  };
};

