# AnyTale Image History Ordering and Preload

## Goal

New images should be appended to the end of the history list (oldest-first, newest-last), the viewer should jump to the last item after generation, the slideshow should traverse forward and stop at the last image, and the editor should preload images on page load based on the active tab's current name.

## Tasks

### Phase 1 — Reverse image history ordering

- [x] In `anytale.mjs`, change `handleGenerationComplete` to append new images to the end of history (`[...prev, media]`); add a `navigateToLastRef = useRef(false)` and a `useEffect` on `history` that calls `nav.selectLast()` when `navigateToLastRef.current` is true, then clears the ref.
- [x] In `anytale.mjs`, reverse the items from the gallery `onLoad` callback (server returns newest-first; reverse to oldest-first) before calling `setHistory`, and navigate to `items.length - 1` (the newest, now at the end).
- [x] In `anytale-viewer.mjs`, change the slideshow timer to call `onNext` instead of `onPrev`, and change the stop condition from `currentIndex === 0` to `currentIndex === items.length - 1`.

### Phase 2 — Preload matching images on page load

- [x] In `anytale.mjs`, import `loadPlot` and `loadCharacter` from `./anytale/anytale-state.mjs`.
- [x] In `anytale.mjs`, add a mount-only `useEffect` that reads the active tab from `localStorage`, resolves the lookup name (plot name for `parts-plot`, character name for `character-outfits`), and if non-empty fetches `/media-data?query=<name>&sort=ascending&limit=1000`, filters results to exact name matches (`item.name === name`), sets history to the filtered array, and navigates to the last item.

## Implementation Details

### History ordering rationale
- **Before:** `setHistory(prev => [media, ...prev])` — prepend, index 0 = newest
- **After:** `setHistory(prev => [...prev, media])` — append, last index = newest

### Navigate-to-last after append
`nav.selectLast()` captures `items.length` from the previous render and will clamp to the old last index if called synchronously before the re-render. Use a ref flag:
```js
const navigateToLastRef = useRef(false);

// In handleGenerationComplete:
setHistory(prev => [...prev, media]);
navigateToLastRef.current = true;

// useEffect watching history:
useEffect(() => {
  if (navigateToLastRef.current && history.length > 0) {
    nav.selectLast();
    navigateToLastRef.current = false;
  }
}, [history]);
```

### Gallery items order
Server returns items with `sort=descending` (newest first). Before storing in history, reverse the array so history is oldest-first:
```js
onLoad=${(items) => {
  if (items && items.length > 0) {
    const ordered = items.slice().reverse();
    setHistory(ordered);
    nav.selectByIndex(ordered.length - 1);
  }
}}
```

### Slideshow changes
```js
// Timer: onNext instead of onPrev
timerRef.current = setInterval(() => { onNext && onNext(); }, intervalSeconds * 1000);

// Stop condition: last image instead of first
useEffect(() => {
  if (isPlaying && currentIndex === items.length - 1) setIsPlaying(false);
}, [currentIndex, items.length]);
```

### Preload fetch
```js
useEffect(() => {
  const tab = localStorage.getItem('anytale-active-tab') || 'parts-plot';
  const name = tab === 'character-outfits'
    ? loadCharacter().name?.trim() || ''
    : loadPlot().name?.trim() || '';
  if (!name) return;
  fetchJson(`/media-data?${new URLSearchParams({ query: name, sort: 'ascending', limit: '1000' })}`)
    .then(items => {
      const exact = items.filter(item => item.name === name);
      if (exact.length > 0) {
        setHistory(exact);
        nav.selectByIndex(exact.length - 1);
      }
    })
    .catch(err => console.error('[AnyTalePage] Preload failed:', err));
}, []);
```
