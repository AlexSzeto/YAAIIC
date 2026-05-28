/**
 * character-api.mjs – Client-side API helpers for the AnyTale character endpoints.
 *
 * Mirrors the plot-api.mjs usage pattern.
 */
import { getClientId } from '../client-id.mjs';

/**
 * Fetch the list of saved characters.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchCharacterList() {
  const response = await fetch('/anytale/characters');
  if (!response.ok) throw new Error(`Failed to fetch character list: HTTP ${response.status}`);
  return response.json();
}

/**
 * Create a new character. The server assigns a UUID.
 * @param {Object} character
 * @returns {Promise<{saved: Object}>}
 */
export async function createCharacter(character) {
  const response = await fetch('/anytale/characters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(character),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create character: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Save (update) a full character object by its existing uid.
 * @param {string} uid
 * @param {Object} character
 * @returns {Promise<{saved: Object}>} The saved character
 */
export async function saveCharacter(uid, character) {
  const response = await fetch(`/anytale/characters/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(character),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save character: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Delete a character by uid.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function deleteCharacter(uid) {
  const response = await fetch(`/anytale/characters/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete character: HTTP ${response.status}`);
  }
}

/**
 * Generate a portrait image for a character using the configured portrait workflow.
 * @param {string} uid
 * @param {Array<{partUid: string, attributeValues: Object}>} parts
 * @returns {Promise<{portraitUrl: string|null}>}
 */
export async function generateCharacterPortrait(uid, parts) {
  const response = await fetch(`/anytale/characters/${encodeURIComponent(uid)}/render-portrait?queueOnly=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts, clientId: getClientId() }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to generate portrait: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Generate voice audio for a character using the configured voice workflow.
 * @param {string} uid
 * @param {string} voiceProfile
 * @param {string} [name]
 * @param {string} [personality]
 * @returns {Promise<{audioUrl: string|null, transcript: string|null}>}
 */
export async function generateCharacterVoice(uid, voiceProfile, name, personality) {
  const response = await fetch(`/anytale/characters/${encodeURIComponent(uid)}/generate-voice?queueOnly=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceProfile, personality, name, clientId: getClientId() }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to generate voice: HTTP ${response.status}`);
  }
  return response.json();
}
