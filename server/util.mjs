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
