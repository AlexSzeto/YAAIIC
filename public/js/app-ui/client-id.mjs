const KEY = 'clientId';

function _uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback for non-secure HTTP contexts: getRandomValues is always available.
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return [...b].map((v, i) =>
    ([4, 6, 8, 10].includes(i) ? '-' : '') + v.toString(16).padStart(2, '0')
  ).join('');
}

/**
 * Returns a stable UUID for this browser tab, persisted in sessionStorage.
 * Survives page refreshes within the same tab; each new tab gets a fresh UUID.
 */
export function getClientId() {
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = _uuid();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}
