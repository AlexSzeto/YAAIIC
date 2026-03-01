/**
 * sound-editor-modal.mjs – In-browser audio editor with waveform visualisation,
 * non-destructive region-based trim/crop, and labelled clip region management.
 *
 * Saving physical edits produces a new derived media entry (origin field set).
 * Saving clip-region-only changes updates the existing entry in place.
 *
 * @module app-ui/sound-editor/sound-editor-modal
 */
import WaveSurfer from 'https://esm.sh/wavesurfer.js@7';
import RegionsPlugin from 'https://esm.sh/wavesurfer.js@7/dist/plugins/regions.js';

import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';

import { currentTheme } from '../../custom-ui/theme.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { HorizontalLayout, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import {
  BaseOverlay,
  BaseContainer,
  BaseHeader,
  BaseTitle,
  BaseContent,
  BaseFooter,
} from '../../custom-ui/overlays/modal-base.mjs';
import { showTextPrompt } from '../../custom-ui/overlays/dialog.mjs';

// ============================================================================
// Module-level helpers
// ============================================================================

/**
 * Re-render clip regions on the waveform, preserving the current active
 * (drag) selection region.
 * @param {RegionsPlugin} regionsPlugin
 * @param {Array}         clips
 * @param {Object|null}   activeRegion
 * @param {string}        clipColor  – CSS color for clip region fill
 */
function renderClipRegions(regionsPlugin, clips, activeRegion = null, clipColor = 'rgba(0,123,255,0.2)') {
  regionsPlugin.getRegions()
    .filter(r => r !== activeRegion)
    .forEach(r => r.remove());

  clips.forEach(clip => {
    regionsPlugin.addRegion({
      id:      clip.id,
      start:   clip.start,
      end:     clip.end,
      content: clip.label,
      color:   clipColor,
      drag:    false,
      resize:  false,
    });
  });
}

/** Encode an AudioBuffer as a 16-bit PCM WAV Blob. */
function audioBufferToWavBlob(audioBuffer) {
  const numCh     = audioBuffer.numberOfChannels;
  const rate      = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const dataBytes = numFrames * numCh * 2; // 16-bit PCM
  const buf       = new ArrayBuffer(44 + dataBytes);
  const view      = new DataView(buf);
  const write     = (off, str) =>
    [...str].forEach((c, i) => view.setUint8(off + i, c.charCodeAt(0)));

  write(0, 'RIFF');  view.setUint32(4,  36 + dataBytes, true);
  write(8, 'WAVE');  write(12, 'fmt ');
  view.setUint32(16, 16,          true); // PCM chunk size
  view.setUint16(20, 1,           true); // PCM format
  view.setUint16(22, numCh,       true);
  view.setUint32(24, rate,        true);
  view.setUint32(28, rate * numCh * 2, true);
  view.setUint16(32, numCh * 2,   true);
  view.setUint16(34, 16,          true);
  write(36, 'data'); view.setUint32(40, dataBytes, true);

  let off = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Remove the audio between [selStart, selEnd] seconds. */
function applyTrim(src, selStart, selEnd) {
  const { sampleRate: rate, numberOfChannels: ch } = src;
  const s0     = Math.round(selStart * rate);
  const s1     = Math.round(selEnd   * rate);
  const newLen = src.length - (s1 - s0);
  const dst    = new OfflineAudioContext(ch, newLen, rate).createBuffer(ch, newLen, rate);
  for (let c = 0; c < ch; c++) {
    const s = src.getChannelData(c);
    const d = dst.getChannelData(c);
    d.set(s.subarray(0,  s0), 0);
    d.set(s.subarray(s1),    s0);
  }
  return dst;
}

/** Keep only the audio between [selStart, selEnd] seconds. */
function applyCrop(src, selStart, selEnd) {
  const { sampleRate: rate, numberOfChannels: ch } = src;
  const s0  = Math.round(selStart * rate);
  const s1  = Math.round(selEnd   * rate);
  const dst = new OfflineAudioContext(ch, s1 - s0, rate).createBuffer(ch, s1 - s0, rate);
  for (let c = 0; c < ch; c++) {
    dst.getChannelData(c).set(src.getChannelData(c).subarray(s0, s1));
  }
  return dst;
}

/**
 * Recalculate clip region timestamps after a trim or crop.
 * @param {Array}           clips     – [{id, label, start, end}]
 * @param {'trim'|'crop'}   op
 * @param {number}          selStart  – seconds (relative to pre-edit buffer)
 * @param {number}          selEnd
 * @returns {Array}
 */
function adjustClipRegions(clips, op, selStart, selEnd) {
  if (op === 'crop') {
    return clips
      .filter(c => c.start < selEnd && c.end > selStart)
      .map(c => ({
        ...c,
        start: Math.max(0, c.start - selStart),
        end:   Math.min(selEnd - selStart, c.end - selStart),
      }));
  }
  // trim: delete [selStart, selEnd]
  const deleted = selEnd - selStart;
  return clips
    .filter(c => !(c.start >= selStart && c.end <= selEnd)) // remove fully inside
    .map(c => {
      if (c.end   <= selStart) return c;                    // entirely before
      if (c.start >= selEnd)   return { ...c, start: c.start - deleted, end: c.end - deleted };
      // partial overlap – clamp
      return {
        ...c,
        start: c.start < selStart ? c.start : selStart,
        end:   c.end   > selEnd   ? c.end - deleted : selStart,
      };
    });
}

// ============================================================================
// Component
// ============================================================================

/**
 * SoundEditorModal – In-browser waveform editor modal.
 *
 * @param {Object}   props
 * @param {Object}   props.item    – media-data entry for the audio being edited
 * @param {Function} props.onClose – called when modal is dismissed without saving
 * @param {Function} props.onSaved – called with the new (or updated) media-data entry after save
 */
export function SoundEditorModal({ item, onClose, onSaved }) {
  const theme = currentTheme.value;
  const toast = useToast();

  const [clipRegions, setClipRegions] = useState(
    (item.clips || []).map((c, i) => ({ ...c, id: `clip-${i}` }))
  );
  const [hasPhysicalEdits, setHasPhysicalEdits] = useState(false);
  const [isSaving, setIsSaving]               = useState(false);
  const [hasSelection, setHasSelection]       = useState(false);
  const [isPlaying, setIsPlaying]             = useState(false);
  const [isLooping, setIsLooping]             = useState(false);

  const wavesurferRef  = useRef(null);
  const wsRegionsRef   = useRef(null);
  const audioBufferRef = useRef(null);
  const activeRegionRef = useRef(null);
  const containerRef   = useRef(null); // plain <div> for WaveSurfer mount
  const isLoopingRef   = useRef(false); // ref mirrors isLooping for use inside event closures

  // Clip region fill colour – muted variant of primary blue
  const clipColor = 'rgba(0,123,255,0.2)';

  // ── WaveSurfer initialisation ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     theme.colors.primary.background,
      progressColor: theme.colors.danger.background, // red playhead
      interact:      true,
      height:        128,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());
    regions.enableDragSelection({ color: 'rgba(120,120,120,0.35)' }); // neutral gray selection

    ws.load(item.audioUrl);

    ws.on('ready', async () => {
      // Guard: only fetch on initial load. After trim/crop, loadBlob() re-triggers
      // this event but we must NOT replace the edited buffer with the original file.
      if (audioBufferRef.current) return;
      const res = await fetch(item.audioUrl);
      const ab  = await res.arrayBuffer();
      audioBufferRef.current = await new AudioContext().decodeAudioData(ab);
      renderClipRegions(regions, clipRegions, null, clipColor);
    });

    // Single click on the waveform: clear the active selection region so the
    // playhead moves without creating a new selection.
    ws.on('interaction', () => {
      if (activeRegionRef.current) {
        activeRegionRef.current.remove();
        activeRegionRef.current = null;
        setHasSelection(false);
      }
    });

    // When a drag-selection is completed, register it as the active region.
    regions.on('region-created', region => {
      if (activeRegionRef.current && activeRegionRef.current.id !== region.id) {
        activeRegionRef.current.remove();
      }
      activeRegionRef.current = region;
      setHasSelection(true);
    });

    ws.on('finish', () => {
      if (isLoopingRef.current) {
        // Restart – prefer region play if a selection is active
        const region = activeRegionRef.current;
        if (region) {
          region.play();
        } else {
          ws.play();
        }
      } else {
        setIsPlaying(false);
      }
    });

    wavesurferRef.current = ws;
    wsRegionsRef.current  = regions;

    return () => ws.destroy();
  }, []); // runs once on mount

  // ── Button handlers ───────────────────────────────────────────────────────

  const handlePlayPause = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    if (isPlaying) {
      ws.pause();
      setIsPlaying(false);
    } else {
      const region = activeRegionRef.current;
      if (region) {
        region.play();
      } else {
        ws.play();
      }
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleLoop = useCallback(() => {
    setIsLooping(prev => {
      isLoopingRef.current = !prev;
      return !prev;
    });
  }, []);

  const handleTrim = useCallback(() => {
    const region = activeRegionRef.current;
    if (!region || !audioBufferRef.current) return;
    const newBuffer = applyTrim(audioBufferRef.current, region.start, region.end);
    const newClips  = adjustClipRegions(clipRegions, 'trim', region.start, region.end);
    audioBufferRef.current = newBuffer;
    activeRegionRef.current = null;
    setHasSelection(false);
    setClipRegions(newClips);
    setHasPhysicalEdits(true);
    wavesurferRef.current.loadBlob(audioBufferToWavBlob(newBuffer));
    renderClipRegions(wsRegionsRef.current, newClips, null, clipColor);
  }, [clipRegions]);

  const handleCrop = useCallback(() => {
    const region = activeRegionRef.current;
    if (!region || !audioBufferRef.current) return;
    const newBuffer = applyCrop(audioBufferRef.current, region.start, region.end);
    const newClips  = adjustClipRegions(clipRegions, 'crop', region.start, region.end);
    audioBufferRef.current = newBuffer;
    activeRegionRef.current = null;
    setHasSelection(false);
    setClipRegions(newClips);
    setHasPhysicalEdits(true);
    wavesurferRef.current.loadBlob(audioBufferToWavBlob(newBuffer));
    renderClipRegions(wsRegionsRef.current, newClips, null, clipColor);
  }, [clipRegions]);

  const handleAddClip = useCallback(async () => {
    const region = activeRegionRef.current;
    if (!region) return;
    const label = await showTextPrompt('Clip label', '', 'e.g. Rain soft');
    if (!label) return;
    const newClip = { id: `clip-${Date.now()}`, label, start: region.start, end: region.end };
    const updated = [...clipRegions, newClip];
    setClipRegions(updated);
    renderClipRegions(wsRegionsRef.current, updated, activeRegionRef.current, clipColor);
  }, [clipRegions]);

  const handleScrub = useCallback(() => {
    const region = activeRegionRef.current;
    if (!region) return;
    const updated = clipRegions.filter(
      c => !(c.start >= region.start && c.end <= region.end)
    );
    setClipRegions(updated);
    renderClipRegions(wsRegionsRef.current, updated, activeRegionRef.current, clipColor);
  }, [clipRegions]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const clipsForStorage = clipRegions.map(({ label, start, end }) => ({ label, start, end }));

      if (hasPhysicalEdits) {
        const blob     = audioBufferToWavBlob(audioBufferRef.current);
        const formData = new FormData();
        formData.append('audio',  blob, 'edit.wav');
        formData.append('name',   item.name);
        formData.append('origin', String(item.uid));
        const res  = await fetch('/upload/audio', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        // Patch the new entry with clip regions if any were defined
        if (clipsForStorage.length > 0) {
          await fetch('/edit', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ...data.entry, clips: clipsForStorage }),
          });
          data.entry = { ...data.entry, clips: clipsForStorage };
        }
        onSaved(data.entry);
      } else {
        // Metadata-only: patch the existing item in place
        const updated = { ...item, clips: clipsForStorage };
        const res = await fetch('/edit', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(updated),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Save failed');
        }
        onSaved(updated);
      }
    } catch (err) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [clipRegions, hasPhysicalEdits, item, onSaved, toast]);

  // ── Render ────────────────────────────────────────────────────────────────

  const footer = html`
    <${VerticalLayout} gap="small">
      <${HorizontalLayout} gap="small">
        <${Button}
          variant="medium-icon-text"
          icon="cut"
          onClick=${handleTrim}
          disabled=${!hasSelection}
          title="Remove selected region from audio"
        >Trim</${Button}>
        <${Button}
          variant="medium-icon-text"
          icon="crop"
          onClick=${handleCrop}
          disabled=${!hasSelection}
          title="Keep only the selected region"
        >Crop</${Button}>
        <${Button}
          variant="medium-icon-text"
          icon="plus"
          onClick=${handleAddClip}
          disabled=${!hasSelection}
          title="Save selected region as a named clip"
        >Clip</${Button}>
        <${Button}
          variant="medium-icon-text"
          icon="minus"
          onClick=${handleScrub}
          disabled=${!hasSelection}
          title="Remove clip regions overlapping selection"
        >Scrub</${Button}>
      </${HorizontalLayout}>
      <${HorizontalLayout} gap="small">
        <${Button}
          variant="medium-icon-text"
          icon=${isPlaying ? 'pause' : 'play'}
          onClick=${handlePlayPause}
          title=${isPlaying ? 'Pause playback' : 'Play active region or full audio'}
        >${isPlaying ? 'Pause' : 'Play'}</${Button}>
        <${Button}
          variant="medium-icon-text"
          icon="repeat"
          onClick=${handleLoop}
          title="Toggle loop mode"
        >Loop</${Button}>
        <${Button}
          variant="medium-icon-text"
          icon="x"
          onClick=${onClose}
          disabled=${isSaving}
        >Cancel</${Button}>
        <${Button}
          variant="medium-icon-text"
          icon="check"
          onClick=${handleSave}
          disabled=${isSaving}
        >${isSaving ? 'Saving…' : 'Save'}</${Button}>
      </${HorizontalLayout}>
    </${VerticalLayout}>
  `;

  const modalContent = html`
    <${BaseOverlay} bgColor=${theme.colors.overlay.background}>
      <${BaseContainer}
        bgColor=${theme.colors.background.card}
        textColor=${theme.colors.text.primary}
        borderRadius=${theme.spacing.medium.borderRadius}
        maxWidth="90vw"
        maxHeight="80vh"
        shadowColor=${theme.shadow.colorStrong}
        style=${{ width: '800px' }}
      >
        <${BaseHeader} marginBottom="16px">
          <${BaseTitle}>${item.name || 'Audio Editor'}</${BaseTitle}>
        </${BaseHeader}>

        <${BaseContent}
          marginBottom="20px"
          color=${theme.colors.text.secondary}
          fontFamily=${theme.typography.fontFamily}
          fontSize=${theme.typography.fontSize.medium}
        >
          <div ref=${containerRef} />
        </${BaseContent}>

        <${BaseFooter} marginTop="0" gap=${theme.spacing.medium.gap}>
          ${footer}
        </${BaseFooter}>
      </${BaseContainer}>
    </${BaseOverlay}>
  `;

  return createPortal(modalContent, document.body);
}
