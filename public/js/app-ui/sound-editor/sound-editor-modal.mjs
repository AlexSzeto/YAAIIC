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
import { AppHeader } from '../themed-base.mjs';

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
 * @param {Object}   props.item       – media-data entry for the audio being edited
 * @param {Function} props.onClose    – called when modal is dismissed without saving
 * @param {Function} props.onSaved    – called with the updated media-data entry after a metadata-only save
 * @param {Function} props.onSaveTask – called with a taskId after a physical edit upload starts;
 *                                      the caller should track completion via SSE (e.g. ProgressBanner)
 */
export function SoundEditorModal({ item, onClose, onSaved, onSaveTask }) {
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
  const isPlayingRef = useRef(false); // ref mirrors isPlaying for use inside event closures
  const isLoopingRef   = useRef(false); // ref mirrors isLooping for use inside event closures
  // Mirrors clipRegions state so the 'ready' event handler (closed over at mount)
  // always sees the latest clips after a trim/crop loadBlob cycle.
  const clipRegionsRef = useRef(
    (item.clips || []).map((c, i) => ({ ...c, id: `clip-${i}` }))
  );

  // Clip region fill colour – muted variant of primary blue
  const clipColor = 'rgba(0,123,255,0.2)';

  // ── WaveSurfer initialisation ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     theme.colors.primary.background,
      progressColor: theme.colors.text.primary, // high-contrast playhead (black/white per theme)
      interact:      true,
      height:        128,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());
    regions.enableDragSelection({ color: 'rgba(120,120,120,0.35)' }); // neutral gray selection

    ws.load(item.audioUrl);

    ws.on('ready', () => {
      // Only fetch and decode the raw audio buffer on the initial load.
      // After trim/crop, loadBlob() re-triggers ready but audioBufferRef is
      // already set with the edited buffer, so we skip the fetch.
      if (!audioBufferRef.current) {
        (async () => {
          const res = await fetch(item.audioUrl);
          const ab  = await res.arrayBuffer();
          audioBufferRef.current = await new AudioContext().decodeAudioData(ab);
        })();
      }

      // Always re-render clip regions after any audio load. WaveSurfer clears
      // all regions when it reloads audio (including after loadBlob), so we
      // re-add them here rather than relying on a synchronous call made before
      // ready fires. clipRegionsRef is kept current by the trim/crop handlers.
      setTimeout(() => renderClipRegions(regions, clipRegionsRef.current, null, clipColor), 100);
    });

    // Single click on the waveform: clear the active selection region so the
    // playhead moves without creating a new selection.
    ws.on('interaction', () => {
      if (activeRegionRef.current 
          && (ws.getCurrentTime() < activeRegionRef.current.start 
          || ws.getCurrentTime() > activeRegionRef.current.end)) {
        activeRegionRef.current.remove();
        activeRegionRef.current = null;
        setHasSelection(false);

        if(isPlayingRef.current) {
          ws.pause();
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      }
    });

    // When a drag-selection is completed, register it as the active region.
    // Clip regions are added programmatically (id prefix 'clip-') and must be
    // ignored here, otherwise they overwrite activeRegionRef and get deleted on
    // the next interaction event.
    regions.on('region-created', region => {
      if (region.id && region.id.startsWith('clip-')) return;
      if (activeRegionRef.current && activeRegionRef.current.id !== region.id) {
        activeRegionRef.current.remove();
      }
      activeRegionRef.current = region;
      setHasSelection(true);
    });

    // region-out fires when the playhead exits a region boundary, which is the
    // correct signal for stopping or looping region-confined playback.
    regions.on('region-out', region => {
      if (region !== activeRegionRef.current) return;
      if (isLoopingRef.current) {
        region.play();
      } else {
        if(ws.getCurrentTime() < region.start + 0.01) return;
        ws.pause();

        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    });

    // finish fires when the entire file reaches its end (no active selection, or
    // the selection extends to the very end of the file).
    ws.on('finish', () => {
      if (activeRegionRef.current) return; // handled by region-out
      if (isLoopingRef.current) {
        ws.play();
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
      isPlayingRef.current = false;
    } else {
      setIsLooping(false);
      isLoopingRef.current = false;
      const region = activeRegionRef.current;
      if (region) {
        region.play(true);
      } else {
        ws.play();
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
    }
  }, [isPlaying]);

  const handleLoop = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    if (isPlaying) {
      ws.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      setIsLooping(true);
      isLoopingRef.current = true;
      const region = activeRegionRef.current;
      if (region) {
        region.play();
      } else {
        ws.play();
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
    }
  }, [isPlaying]);

  const handleTrim = useCallback(() => {
    const region = activeRegionRef.current;
    if (!region || !audioBufferRef.current) return;
    const newBuffer = applyTrim(audioBufferRef.current, region.start, region.end);
    const newClips  = adjustClipRegions(clipRegions, 'trim', region.start, region.end);
    audioBufferRef.current = newBuffer;
    clipRegionsRef.current = newClips; // update ref so the 'ready' handler renders the correct clips
    activeRegionRef.current = null;
    setHasSelection(false);
    setClipRegions(newClips);
    setHasPhysicalEdits(true);
    wavesurferRef.current.loadBlob(audioBufferToWavBlob(newBuffer));
    // clip regions are re-rendered by the 'ready' handler once loadBlob completes
  }, [clipRegions]);

  const handleCrop = useCallback(() => {
    const region = activeRegionRef.current;
    if (!region || !audioBufferRef.current) return;
    const newBuffer = applyCrop(audioBufferRef.current, region.start, region.end);
    const newClips  = adjustClipRegions(clipRegions, 'crop', region.start, region.end);
    audioBufferRef.current = newBuffer;
    clipRegionsRef.current = newClips; // update ref so the 'ready' handler renders the correct clips
    activeRegionRef.current = null;
    setHasSelection(false);
    setClipRegions(newClips);
    setHasPhysicalEdits(true);
    wavesurferRef.current.loadBlob(audioBufferToWavBlob(newBuffer));
    // clip regions are re-rendered by the 'ready' handler once loadBlob completes
  }, [clipRegions]);

  const handleAddClip = useCallback(async () => {
    const region = activeRegionRef.current;
    if (!region) return;
    const label = await showTextPrompt('Clip label', '', 'e.g. Rain soft');
    if (!label) return;
    const newClip = { id: `clip-${Date.now()}`, label, start: region.start, end: region.end };
    const updated = [...clipRegions, newClip];
    clipRegionsRef.current = updated;
    setClipRegions(updated);
    renderClipRegions(wsRegionsRef.current, updated, activeRegionRef.current, clipColor);
  }, [clipRegions]);

  const handleScrub = useCallback(() => {
    const region = activeRegionRef.current;
    if (!region) return;
    const updated = clipRegions.filter(
      c => !(c.start >= region.start && c.end <= region.end)
    );
    clipRegionsRef.current = updated;
    setClipRegions(updated);
    renderClipRegions(wsRegionsRef.current, updated, activeRegionRef.current, clipColor);
  }, [clipRegions]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const clipsForStorage = clipRegions.map(({ label, start, end }) => ({ label, start, end }));

      if (hasPhysicalEdits) {
        // Upload produces a new derived entry via an async task (album cover generation).
        // Pass clips in the FormData so the server saves them with the new entry from the start,
        // rather than trying to patch an entry that doesn't exist yet.
        const blob     = audioBufferToWavBlob(audioBufferRef.current);
        const formData = new FormData();
        formData.append('audio',  blob, 'edit.wav');
        formData.append('name',   item.name);
        formData.append('origin', String(item.uid));
        // Always send clips (even as empty []) so the derived entry explicitly
        // tracks clip state rather than inheriting stale data from the album pipeline.
        formData.append('clips', JSON.stringify(clipsForStorage));
        // Port original metadata so the album-generation LLM step doesn't overwrite it.
        if (item.tags        != null) formData.append('tags',        JSON.stringify(item.tags));
        if (item.description != null) formData.append('description', item.description);
        if (item.summary     != null) formData.append('summary',     item.summary);
        if (item.prompt      != null) formData.append('prompt',      item.prompt);
        formData.append('audioFormat', 'mp3'); // request server-side conversion to mp3 for storage efficiency
        const res  = await fetch('/upload/audio', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        // Hand off the taskId to the caller; the caller tracks SSE completion
        // and adds the finished entry to history (e.g. via ProgressBanner).
        onSaveTask(data.taskId);
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
      setIsSaving(false);
    }
  }, [clipRegions, hasPhysicalEdits, item, onSaved, onSaveTask, toast]);

  // ── Render ────────────────────────────────────────────────────────────────

  const footer = html`
    <${HorizontalLayout} style=${{ width: '100%' }}>
      <${HorizontalLayout} gap="small">
        <${Button}
          variant="small-icon"
          icon="repeat"
          onClick=${handleLoop}
          title="Toggle loop mode"
        ></${Button}>
        <${Button}
          variant="small-icon"
          icon=${isPlaying ? 'stop' : 'play'}
          onClick=${handlePlayPause}
          title=${isPlaying ? 'Pause playback' : 'Play active region or full audio'}
        ></${Button}>
      </${HorizontalLayout}>
      <div style="flex: 1;">
      </div>
      <${HorizontalLayout} gap="small">
        <${Button}
          variant="small-icon-text"
          icon="cut"
          onClick=${handleTrim}
          disabled=${!hasSelection}
          title="Remove selected region from audio"
        >Trim</${Button}>
        <${Button}
          variant="small-icon-text"
          icon="crop"
          onClick=${handleCrop}
          disabled=${!hasSelection}
          title="Keep only the selected region"
        >Crop</${Button}>
        <${Button}
          variant="small-icon-text"
          icon="plus"
          onClick=${handleAddClip}
          disabled=${!hasSelection}
          title="Save selected region as a named clip"
        >Clip</${Button}>
        <${Button}
          variant="small-icon-text"
          icon="minus"
          onClick=${handleScrub}
          disabled=${!hasSelection}
          title="Remove clip regions overlapping selection"
        >Scrub</${Button}>
        <${Button}
          variant="small-icon-text"
          icon="check"
          onClick=${handleSave}
          disabled=${isSaving}
        >${isSaving ? 'Saving…' : 'Save'}</${Button}>
        <${Button}
          variant="small-icon-text"
          icon="x"
          onClick=${onClose}
          disabled=${isSaving}
        >Cancel</${Button}>
      </${HorizontalLayout}>
    </${HorizontalLayout}>
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
