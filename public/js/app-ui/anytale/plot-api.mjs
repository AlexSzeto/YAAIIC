/**
 * plot-api.mjs – Client-side API helpers for the AnyTale plot endpoints.
 *
 * Mirrors the parts API usage pattern from anytale-form.mjs and part-item.mjs.
 */

/**
 * Fetch the list of saved plots (summary objects: { uid, name }).
 * @returns {Promise<Array<{uid: string, name: string}>>}
 */
export async function fetchPlotList() {
  const response = await fetch('/anytale/plot');
  if (!response.ok) throw new Error(`Failed to fetch plot list: HTTP ${response.status}`);
  return response.json();
}

/**
 * Save (upsert) a full plot block.
 * @param {string} uid
 * @param {Object} plotBlock
 * @returns {Promise<Object>} The saved plot block
 */
export async function savePlot(uid, plotBlock) {
  const response = await fetch(`/anytale/plot/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plotBlock),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save plot: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Delete a plot by uid.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function deletePlot(uid) {
  const response = await fetch(`/anytale/plot/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete plot: HTTP ${response.status}`);
  }
}
