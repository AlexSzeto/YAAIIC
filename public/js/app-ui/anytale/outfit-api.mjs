/**
 * outfit-api.mjs – Client-side API helpers for the AnyTale outfit endpoints.
 *
 * Mirrors the character-api.mjs usage pattern.
 */

/**
 * Fetch the list of saved outfits.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchOutfitList() {
  const response = await fetch('/anytale/outfits');
  if (!response.ok) throw new Error(`Failed to fetch outfit list: HTTP ${response.status}`);
  return response.json();
}

/**
 * Create a new outfit. The server assigns a UUID.
 * @param {Object} outfit
 * @returns {Promise<{saved: Object}>}
 */
export async function createOutfit(outfit) {
  const response = await fetch('/anytale/outfits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(outfit),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create outfit: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Save (update) a full outfit object by its existing uid.
 * @param {string} uid
 * @param {Object} outfit
 * @returns {Promise<{saved: Object}>} The saved outfit
 */
export async function saveOutfit(uid, outfit) {
  const response = await fetch(`/anytale/outfits/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(outfit),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save outfit: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Enqueue a render image generation for an outfit.
 * @param {string}   uid
 * @param {string[]} [visiblePartUids] – If provided, only these parts are included in the prompt.
 * @returns {Promise<void>}
 */
export async function renderOutfit(uid, visiblePartUids) {
  const response = await fetch(`/anytale/outfits/${encodeURIComponent(uid)}/render-outfit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visiblePartUids ? { visiblePartUids } : {}),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to start outfit render: HTTP ${response.status}`);
  }
}

/**
 * Delete an outfit by uid.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function deleteOutfit(uid) {
  const response = await fetch(`/anytale/outfits/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete outfit: HTTP ${response.status}`);
  }
}
