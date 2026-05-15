/**
 * Migration: Lowercase attribute names and merge attribute value sections in anytale-data.json
 *
 * Changes:
 * 1. Lowercase the `name` field in all `parts[].attributes[]` definitions
 * 2. For all characters[].parts[] and outfits[].parts[]:
 *    - Merge categoryAttributeValues + customAttributeValues + existing attributeValues
 *      into a single `attributeValues` object with all keys lowercased
 *    - Priority (highest wins): existing attributeValues > customAttributeValues > categoryAttributeValues
 *    - Delete categoryAttributeValues and customAttributeValues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../server/database/anytale-data.json');

function lowercaseKeys(obj) {
    if (!obj || typeof obj !== 'object') return {};
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])
    );
}

function mergePartAttributeValues(part) {
    const category = lowercaseKeys(part.categoryAttributeValues || {});
    const custom = lowercaseKeys(part.customAttributeValues || {});
    const existing = lowercaseKeys(part.attributeValues || {});

    // Merge: categoryAttributeValues < customAttributeValues < existing attributeValues
    const merged = { ...category, ...custom, ...existing };

    const result = { ...part };
    result.attributeValues = merged;
    delete result.categoryAttributeValues;
    delete result.customAttributeValues;
    return result;
}

const raw = fs.readFileSync(DB_PATH, 'utf8');
const data = JSON.parse(raw);

// 1. Lowercase attribute names in part definitions
if (Array.isArray(data.parts)) {
    for (const part of data.parts) {
        if (Array.isArray(part.attributes)) {
            for (const attr of part.attributes) {
                if (typeof attr.name === 'string') {
                    attr.name = attr.name.toLowerCase();
                }
            }
        }
    }
}

// 2. Migrate character parts
if (Array.isArray(data.characters)) {
    for (const character of data.characters) {
        if (Array.isArray(character.parts)) {
            character.parts = character.parts.map(mergePartAttributeValues);
        }
    }
}

// 3. Migrate outfit parts
if (Array.isArray(data.outfits)) {
    for (const outfit of data.outfits) {
        if (Array.isArray(outfit.parts)) {
            outfit.parts = outfit.parts.map(mergePartAttributeValues);
        }
    }
}

fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log('Migration complete:', DB_PATH);
