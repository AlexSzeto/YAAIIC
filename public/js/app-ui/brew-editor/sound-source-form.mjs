/**
 * sound-source-form.mjs – Sub-form for editing a single ambient sound source.
 *
 * Props: { item, onChange, onSourceLengthsChange }
 * Calls onChange(updatedItem) on every field edit.
 * Calls onSourceLengthsChange({ [label]: effectiveLength }) when lengths are recalculated.
 *
 * Clips are stored as { url: string, label: string, start?: number, end?: number } objects.
 */
import { html } from 'htm/preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { AudioPlayer } from '../../custom-ui/media/audio-player.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { RangeSlider } from '../../custom-ui/io/range-slider.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { VerticalLayout, HorizontalLayout } from '../../custom-ui/themed-base.mjs';
import { Gallery } from '../main/gallery.mjs';
import { createGalleryPreview } from '../main/gallery-preview.mjs';

/**
 * Load the duration (in seconds) of an audio URL. Resolves with the duration
 * rounded to the nearest second, or null if loading fails.
 * @param {string} url
 * @returns {Promise<number|null>}
 */
function loadAudioDuration(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const audio = new Audio();
    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
    };
    audio.onloadedmetadata = () => {
      cleanup();
      const dur = audio.duration;
      resolve(isFinite(dur) ? Math.round(dur * 100) / 100 : null);
    };
    audio.onerror = () => { cleanup(); resolve(null); };
    audio.src = url;
  });
}

/**
 * Calculate the effective playback length of a source.
 * Formula: longestClipDuration + maxRepeatCount × maxRepeatDelay
 * Returns null if no clips have loaded durations.
 *
 * @param {number[]} clipDurations - array of per-clip durations (nulls omitted by caller)
 * @param {{ min: number, max: number }} repeatCount
 * @param {{ min: number, max: number }} repeatDelay
 * @returns {number|null}
 */
function calcSourceLength(clipDurations, repeatCount, repeatDelay) {
  const validDurations = clipDurations.filter(d => d != null);
  if (validDurations.length === 0) return null;
  const longest = Math.max(...validDurations);
  const maxCount = (repeatCount && repeatCount.max != null) ? repeatCount.max : 1;
  const maxDelay = (repeatDelay && repeatDelay.max != null) ? repeatDelay.max : 0;
  return Math.ceil(longest + maxCount * maxDelay);
}

/**
 * SoundSourceForm – Fields for a single sound source entry.
 *
 * @param {Object}   props
 * @param {Object}   props.item                    - The sound source object
 * @param {Function} props.onChange                - Called with updated source object
 * @param {Function} [props.onSourceLengthsChange] - Called with { [label]: length } on recalc
 */
export function SoundSourceForm({ item, onChange, onSourceLengthsChange }) {
  // Track whether the gallery is open for adding a new clip
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Per-clip durations in seconds (null = not yet loaded / failed)
  const [clipDurations, setClipDurations] = useState([]);

  const clips = item.clips || [];
  const repeatCount = item.repeatCount || { min: 1, max: 1 };
  const repeatDelay = item.repeatDelay || { min: 0, max: 0 };
  const attack = item.attack || { min: 0, max: 0.5 };
  const decay = item.decay || { min: 0, max: 0.5 };

  // ── Load clip durations whenever the clips list changes ───────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadDurations() {
      const durations = await Promise.all(
        clips.map(clip => {
          // For region clips, use (end - start) as the effective duration
          if (typeof clip === 'object' && clip.start != null && clip.end != null) {
            return Promise.resolve(Math.round((clip.end - clip.start) * 100) / 100);
          }
          const url = typeof clip === 'object' ? clip.url : (clip || '');
          return loadAudioDuration(url);
        })
      );
      if (!cancelled) setClipDurations(durations);
    }
    loadDurations();
    return () => { cancelled = true; };
  }, [clips.map(c => (typeof c === 'object' ? `${c.url}:${c.start}:${c.end}` : c)).join(',')]);

  // ── Recalculate effective source length when durations or envelope changes ─
  useEffect(() => {
    if (!onSourceLengthsChange || !item.label) return;
    const len = calcSourceLength(clipDurations, repeatCount, repeatDelay);
    onSourceLengthsChange({ [item.label]: len });
  }, [clipDurations, repeatCount.max, repeatDelay.max, item.label]);

  // ── Derived slider maxima ─────────────────────────────────────────────────
  const validDurations = clipDurations.filter(d => d != null);
  const longestClip = validDurations.length > 0 ? Math.max(...validDurations) : null;
  const repeatDelayMax = Math.min(60, Math.max(1, longestClip != null ? Math.ceil(longestClip * 10) : 60));
  const attackDecayMax = Math.min(60, Math.max(1, longestClip != null ? Math.ceil(longestClip) : 10));
  const hasNoClips = clips.length === 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLabelChange = useCallback((e) => {
    onChange({ ...item, label: e.target.value });
  }, [item, onChange]);

  const handleClipsChange = useCallback((clips) => {
    onChange({ ...item, clips });
  }, [item, onChange]);

  const handleAddClipClick = useCallback(() => {
    setGalleryOpen(true);
  }, []);

  const handleGallerySelect = useCallback((entry) => {
    const existingClips = item.clips || [];

    // Bulk-import all clip regions if the entry has them, otherwise add one full-file clip
    let newClips;
    if (Array.isArray(entry.clips) && entry.clips.length > 0) {
      newClips = entry.clips.map(clip => ({
        url: entry.audioUrl,
        label: clip.label,
        start: clip.start,
        end: clip.end,
      }));
    } else {
      newClips = [{ url: entry.audioUrl || entry.url || '', label: entry.name || '' }];
    }
    const updated = { ...item, clips: [...existingClips, ...newClips] };
    if ((!item.label || item.label === 'Source') && entry.name) {
      updated.label = entry.name;
    }
    onChange(updated);
    setGalleryOpen(false);
  }, [item, onChange]);

  const renderClipItem = useCallback((clip) => {
    const clipLabel = typeof clip === 'object' ? (clip.label || clip.url || '') : (clip || '');
    const clipUrl = typeof clip === 'object' ? (clip.url || '') : (clip || '');
    const clipStart = typeof clip === 'object' ? clip.start : undefined;
    const clipEnd = typeof clip === 'object' ? clip.end : undefined;
    return html`
      <${VerticalLayout} gap="small" style=${{ flex: 1 }}>
        <${HorizontalLayout} gap="small" style=${{ alignItems: 'center' }}>
          <${Input}
            value=${clipLabel}
            disabled=${true}
            placeholder="No clip selected"
          />
          ${clipUrl ? html`
            <${AudioPlayer} widthScale="normal" audioUrl=${clipUrl} start=${clipStart} end=${clipEnd} />
          ` : null}
        </${HorizontalLayout}>
      </${VerticalLayout}>
    `;
  }, []);

  return html`
    <${VerticalLayout} gap="medium">

      <${HorizontalLayout} gap="small" style=${{ alignItems: 'flex-end' }}>
        <${Input}
          label="Label"
          value=${item.label || ''}
          onInput=${handleLabelChange}
          placeholder="Source name"
        />
      </${HorizontalLayout}>

      <${DynamicList}
        title="Clips"
        items=${clips}
        renderItem=${renderClipItem}
        getTitle=${(clip) => (typeof clip === 'object' ? clip.label || clip.url : clip) || 'Clip'}
        createItem=${() => ({ url: '', label: '' })}
        onChange=${handleClipsChange}
        onAdd=${handleAddClipClick}
        addLabel="Add Clip"
        condensed=${true}
      />

      <${HorizontalLayout} gap="small">
        <${RangeSlider}
          label="Repeat Count"
          minAllowed=${0}
          maxAllowed=${20}
          snap=${1}
          min=${repeatCount.min}
          max=${repeatCount.max}
          widthScale="full"
          disabled=${hasNoClips}
          onChange=${({ min, max }) => onChange({ ...item, repeatCount: { min, max } })}
        />
        <${RangeSlider}
          label="Repeat Delay (s)"
          minAllowed=${0}
          maxAllowed=${repeatDelayMax}
          snap=${0.1}
          min=${repeatDelay.min}
          max=${repeatDelay.max}
          widthScale="full"
          disabled=${hasNoClips}
          onChange=${({ min, max }) => onChange({ ...item, repeatDelay: { min, max } })}
        />
        <${RangeSlider}
          label="Attack (s)"
          minAllowed=${0}
          maxAllowed=${attackDecayMax}
          snap=${0.1}
          min=${attack.min}
          max=${attack.max}
          widthScale="full"
          disabled=${hasNoClips}
          onChange=${({ min, max }) => onChange({ ...item, attack: { min, max } })}
        />
        <${RangeSlider}
          label="Decay (s)"
          minAllowed=${0}
          maxAllowed=${attackDecayMax}
          snap=${0.1}
          min=${decay.min}
          max=${decay.max}
          widthScale="full"
          disabled=${hasNoClips}
          onChange=${({ min, max }) => onChange({ ...item, decay: { min, max } })}
        />
      </${HorizontalLayout}>

      <${Gallery}
        isOpen=${galleryOpen}
        onClose=${() => setGalleryOpen(false)}
        queryPath="/media-data"
        previewFactory=${createGalleryPreview}
        selectionMode=${true}
        fileTypeFilter=${['audio']}
        onSelect=${handleGallerySelect}
      />
    </${VerticalLayout}>
  `;
}
