import fs from 'fs';

/**
 * Set a nested value in an object given an array of keys (path).
 * If any key in the path does not exist, it will be created.
 * @param {Object} obj - The object to modify
 * @param {Array<string>} paths - Array of keys representing the path to the desired value
 * @param {*} value - The value to set at the specified path
 * @returns {Object} The modified object
 */
export function setObjectPathValue(obj, paths, value) {
  if (paths.length === 0) return value
  if (paths.length === 1) return { ...obj, [paths[0]]: value }
  const [first, ...rest] = paths
  return { ...obj, [first]: setObjectPathValue(obj[first] || {}, rest, value) }
}

/**
 * Get a nested value from an object given an array of keys (path).
 * If any key in the path does not exist, returns undefined.
 * @param {Object} obj - The object to query
 * @param {Array<string>} paths - Array of keys representing the path to the desired value
 * @returns {*} The value at the specified path, or undefined if not found
 */
export function getObjectPathValue(obj, paths) {
  return paths.reduce((o, p) => (o ? o[p] : undefined), obj)
}

/**
 * Find the next available index for image files in a storage folder.
 * @param {string} prefix - The prefix for the image files (e.g., "image")
 * @param {string} storageFolder - The path to the storage folder
 * @returns {number} The next available index
 */
export function findNextIndex(prefix, storageFolder) {
  let index = 1;
  const files = fs.readdirSync(storageFolder);
  const regex = new RegExp(`^${prefix}_(\\d+)\\.[a-zA-Z0-9]+$`);
  const imageFiles = files.filter(file => file.match(regex));
  
  if (imageFiles.length === 0) {
    return 1;
  }
  
  const indices = imageFiles.map(file => {
    const match = file.match(regex);
    return match ? parseInt(match[1]) : 0;
  });
  
  const maxIndex = Math.max(...indices);
  return maxIndex + 1;
}

/**
 * Read a text file from the storage folder and extract the output path.
 * @param {string} filename - The name of the text file to read
 * @param {string} storageFolder - The path to the storage folder
 * @returns {string} The extracted output path from the text file
 */
export function readOutputPathFromTextFile(filename, storageFolder) {
  const filePath = filename.includes(storageFolder) ? filename : `${storageFolder}\\${filename}`;
  const content = fs.readFileSync(filePath, 'utf8').trim();
  return content;
}

/**
 * Check if a value is considered blank (empty string, null, undefined, or whitespace-only)
 * @param {*} value - The value to check
 * @returns {boolean} True if the value is blank
 */
function isBlankValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

/**
 * Check if an execution condition is met
 * @param {Object} dataSources - Object containing data sources like { data: {...}, value: ... }
 * @param {Object} conditionData - Condition object with structure: { where: {...}, equals: {...} }, { where: {...}, isNot: {...} }, { or: [...] }, or { and: [...] }
 * @returns {boolean} True if condition is met, false otherwise
 * 
 * @example
 * // Simple condition format (equals):
 * // {
 * //   where: { data: "orientation" },  // Check the 'orientation' property from data
 * //   equals: { value: "landscape" }   // Compare against literal value "landscape"
 * // }
 * 
 * // Simple condition format (isNot):
 * // {
 * //   where: { data: "name" },         // Check the 'name' property from data
 * //   isNot: { value: "" }             // Check that it's NOT equal to empty string
 * // }
 * 
 * // OR condition format:
 * // {
 * //   or: [
 * //     { where: { data: "usePostPrompts" }, equals: { value: true } },
 * //     { where: { data: "name" }, equals: { value: "" } }
 * //   ]
 * // }
 * 
 * // AND condition format:
 * // {
 * //   and: [
 * //     { where: { data: "orientation" }, equals: { value: "landscape" } },
 * //     { where: { data: "aspectRatio" }, equals: { value: "wide" } }
 * //   ]
 * // }
 * 
 * // Usage:
 * const dataSources = { data: mediaData, value: mediaData };
 * const condition = { where: { data: "orientation" }, equals: { value: "landscape" } };
 * if (checkExecutionCondition(dataSources, condition)) {
 *   // Execute task...
 * }
 */
export function checkExecutionCondition(dataSources, conditionData) {
  if (!conditionData) return true; // No condition means always execute
  
  // Handle OR conditions - returns true if any subcondition is true
  if (conditionData.or && Array.isArray(conditionData.or)) {
    return conditionData.or.some(subCondition => 
      checkExecutionCondition(dataSources, subCondition)
    );
  }
  
  // Handle AND conditions - returns true only if all subconditions are true
  if (conditionData.and && Array.isArray(conditionData.and)) {
    return conditionData.and.every(subCondition => 
      checkExecutionCondition(dataSources, subCondition)
    );
  }
  
  const { where, equals, isNot } = conditionData;
  if (!where || (!equals && !isNot)) return true;
  
  /**
   * Helper function to resolve a value from data sources
   * @param {Object} valueSpec - Object like { data: "key" } or { value: "directValue" }
   * @returns {*} The resolved value
   */
  const resolveValue = (valueSpec) => {
    const specKeys = Object.keys(valueSpec);
    if (specKeys.length === 0) return undefined;
    
    const sourceKey = specKeys[0]; // e.g., "data" or "value"
    
    // If sourceKey is "value", return the direct value
    if (sourceKey === 'value') {
      return valueSpec.value;
    }
    
    // Otherwise, resolve from data sources
    const dataKey = valueSpec[sourceKey]; // e.g., "orientation"
    const sourceData = dataSources[sourceKey];
    if (!sourceData) return undefined;
    
    return sourceData[dataKey];
  };
  
  // Resolve the actual value from 'where'
  const actualValue = resolveValue(where);
  
  // Resolve the expected value from 'equals' or 'isNot'
  const compareWith = equals || isNot;
  const expectedValue = resolveValue(compareWith);
  const shouldNegate = !!isNot; // true if using isNot, false if using equals
  
  let result;
  
  // Special handling when comparing with empty string
  // Treat undefined, null, and whitespace-only strings as equivalent to ""
  if (expectedValue === '') {
    result = isBlankValue(actualValue);
  }
  // Special handling for boolean comparisons
  // Treat undefined as false when comparing with boolean values
  else if (typeof expectedValue === 'boolean') {
    // If actualValue is undefined or null, treat it as false for boolean comparison
    const normalizedActual = (actualValue === undefined || actualValue === null) ? false : actualValue;
    result = normalizedActual === expectedValue;
  }
  // Compare values
  else {
    result = actualValue === expectedValue;
  }
  
  // Negate the result if using isNot
  return shouldNegate ? !result : result;
}
