/**
 * Template Utilities
 * Parses {{property|pipe1|pipe2}} syntax and substitutes values from data objects.
 */

/**
 * Apply a single pipe transformation to a value
 * @param {string|string[]} value - Current value (string or array of strings)
 * @param {string} pipeName - Name of the pipe to apply
 * @returns {string|string[]} Transformed value
 */
function applyPipe(value, pipeName) {
  switch (pipeName) {
    case 'split-by-spaces':
      // Split string by spaces into array
      if (typeof value === 'string') {
        return value.split(/\s+/).filter(s => s.length > 0);
      }
      return value;
    
    case 'snakecase':
      // Join array with underscores
      if (Array.isArray(value)) {
        return value.join('_');
      }
      return value;
    
    case 'camelcase':
      // Join array in camelCase
      if (Array.isArray(value)) {
        return value.map((s, i) => 
          i === 0 ? s.toLowerCase() : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
        ).join('');
      }
      return value;
    
    case 'kebabcase':
      // Join array with hyphens
      if (Array.isArray(value)) {
        return value.join('-');
      }
      return value;
    
    case 'titlecase':
      // Join array in Title Case with spaces
      if (Array.isArray(value)) {
        return value.map(s => 
          s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
        ).join(' ');
      }
      return value;
    
    case 'join-by-spaces':
      // Join array with spaces
      if (Array.isArray(value)) {
        return value.join(' ');
      }
      return value;
    
    case 'lowercase':
      // Lowercase string or each array element
      if (Array.isArray(value)) {
        return value.map(s => s.toLowerCase());
      }
      return typeof value === 'string' ? value.toLowerCase() : value;
    
    case 'uppercase':
      // Uppercase string or each array element
      if (Array.isArray(value)) {
        return value.map(s => s.toUpperCase());
      }
      return typeof value === 'string' ? value.toUpperCase() : value;
    
    default:
      console.warn(`Unknown pipe: ${pipeName}`);
      return value;
  }
}

/**
 * Parse a template string and substitute values from data object
 * Supports {{property|pipe1|pipe2}} syntax
 * @param {string} template - Template string with {{property|pipes}} placeholders
 * @param {object} data - Data object to pull values from
 * @returns {string} Parsed template with substituted values
 */
export function parseTemplate(template, data) {
  if (!template || typeof template !== 'string') {
    return template;
  }
  
  // Match {{property|pipe1|pipe2}} patterns
  const pattern = /\{\{([^}]+)\}\}/g;
  
  return template.replace(pattern, (match, content) => {
    // Split by pipe character
    const parts = content.split('|').map(p => p.trim());
    const propertyPath = parts[0];
    const pipes = parts.slice(1);
    
    // Get the property value from data
    // Support nested properties with dot notation
    let value = propertyPath.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : '';
    }, data);
    
    // Convert to string if not already
    if (value === null || value === undefined) {
      value = '';
    } else if (typeof value !== 'string' && !Array.isArray(value)) {
      value = String(value);
    }
    
    // Apply each pipe in order
    for (const pipe of pipes) {
      value = applyPipe(value, pipe);
    }
    
    // If final result is an array, join without separator
    if (Array.isArray(value)) {
      value = value.join('');
    }
    
    return value;
  });
}
