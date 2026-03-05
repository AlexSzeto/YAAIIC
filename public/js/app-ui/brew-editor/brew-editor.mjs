/**
 * brew-editor.mjs – Main Brew Editor component.
 *
 * Renders:
 *  - A header with Open / Upload Audio buttons and hamburger navigation
 *  - A ListSelectModal for selecting, creating, importing, and exporting brews
 *  - Top-level brew settings (label)
 *  - DynamicList for Sound Sources (SoundSourceForm) — shows/edits global sources
 *  - DynamicList for Channels (ChannelForm)
 *  - Action bar: Record / Preview / Stop / Export / Save / Delete
 */
import { html } from 'htm/preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
import { H1, VerticalLayout, HorizontalLayout } from '../../custom-ui/themed-base.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { Icon } from '../../custom-ui/layout/icon.mjs';
import ListSelectModal from '../../custom-ui/overlays/list-select.mjs';
import { showDialog, showNumberPrompt } from '../../custom-ui/overlays/dialog.mjs';
import { AppHeader } from '../themed-base.mjs';
import { HamburgerMenu } from '../hamburger-menu.mjs';
import { SoundSourceForm } from './sound-source-form.mjs';
import { ChannelForm } from './channel-form.mjs';
import { AmbientCoffee } from '../../ambrew/ambient-coffee.mjs';
import { openFolderSelect } from '../use-folder-select.mjs';
import { Gallery } from '../main/gallery.mjs';
import { createGalleryPreview } from '../main/gallery-preview.mjs';

// ============================================================================
// Audio helpers
// ============================================================================

/** Encode an AudioBuffer as a 16-bit PCM WAV Blob. */
function audioBufferToWavBlob(audioBuffer) {
  const numCh     = audioBuffer.numberOfChannels;
  const rate      = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const dataBytes = numFrames * numCh * 2;
  const buf       = new ArrayBuffer(44 + dataBytes);
  const view      = new DataView(buf);
  const write     = (off, str) =>
    [...str].forEach((c, i) => view.setUint8(off + i, c.charCodeAt(0)));

  write(0, 'RIFF');  view.setUint32(4,  36 + dataBytes, true);
  write(8, 'WAVE');  write(12, 'fmt ');
  view.setUint32(16, 16,          true);
  view.setUint16(20, 1,           true);
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

// ============================================================================
// Styled Components
// ============================================================================

const PageRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.large.gap};
  padding: ${props => props.theme.spacing.large.padding};
  margin: 0 auto;
`;
PageRoot.className = 'brew-editor-page';

const EmptyState = styled('div')`
  padding: 40px;
  text-align: center;
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  color: ${props => props.theme.colors.text.muted};
`;
EmptyState.className = 'brew-empty-state';

const SectionTitle = styled('div')`
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.large};
  font-weight: ${props => props.theme.typography.fontWeight.bold};
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: ${props => props.theme.spacing.small.gap};
`;
SectionTitle.className = 'brew-section-title';

/** Outlined panel that displays the MM:SS playback timer. */
const TimerPanel = styled('div')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4rem;
  padding: ${props => props.theme.spacing.small.padding};
  border: ${props => props.theme.border.width} solid ${props => props.theme.colors.border.primary};
  border-radius: ${props => props.theme.spacing.medium.borderRadius};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  color: ${props => props.theme.colors.text.primary};
  letter-spacing: 0.05em;
`;
TimerPanel.className = 'brew-timer-panel';

// ============================================================================
// Default factory helpers
// ============================================================================

function createDefaultBrew() {
  return {
    label: 'New Brew',
    sources: [],
    channels: [],
  };
}

function createDefaultSource() {
  return {
    uid: Date.now(),
    label: 'Source',
    clips: [],
    repeatCount: { min: 1, max: 1 },
    repeatDelay: { min: 0.1, max: 0.1 },
    attack: { min: 0, max: 0.5 },
    decay: { min: 0, max: 0.5 },
  };
}

function createDefaultChannel() {
  return {
    label: 'Channel',
    gain: 0.5,
    muffle: null,
    reverb: null,
    radio: null,
    underwater: false,
    tracks: [],
  };
}

// ============================================================================
// Main BrewEditor Component
// ============================================================================

export function BrewEditor() {
  const theme = currentTheme.value;
  const toast = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [brew, setBrew] = useState(null);
  const [savedBrews, setSavedBrews] = useState([]);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentFolder, setCurrentFolder] = useState({ uid: '', label: 'Unsorted' });
  const [recordDuration, setRecordDuration] = useState(30);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  // Global sound sources — separate from the brew's own sources array.
  // The Sound Sources panel edits these; the brew's sources array mirrors them.
  const [globalSources, setGlobalSources] = useState([]);
  // Cached effective playback lengths keyed by source label (not persisted).
  const [sourceLengths, setSourceLengths] = useState({});
  // Runtime channel enable/disable state — never saved, resets on each preview start.
  // Shape: { [channelLabel]: { enabled: boolean } }
  const [channelStates, setChannelStates] = useState({});
  // Whether the global Sound Sources panel is visible. Shown by default, hidden when a brew opens.
  const [showSources, setShowSources] = useState(true);

  // Brew-level gallery (audio only, read-only browsing)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Audio playback refs
  const coffeeRef = useRef(null);
  const recorderRef = useRef(null);
  // true when the auto-stop timeout fires and the recording should be saved.
  const autoSaveRecordingRef = useRef(false);
  // Timeout handle for auto-stopping a recording session.
  const recordTimeoutRef = useRef(null);
  const timerRef = useRef(null);

  // ── Load brew list, current folder, and global sources on mount ────────────
  useEffect(() => {
    loadBrewList();
    loadCurrentFolder();
    loadGlobalSources();
  }, []);

  async function loadCurrentFolder() {
    try {
      const res = await fetch('/folder');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.current !== undefined) {
        const folder = data.list.find((f) => f.uid === data.current) || { uid: '', label: 'Unsorted' };
        setCurrentFolder(folder);
      }
    } catch (e) {
      // Non-fatal: folder defaults to Unsorted
      console.error('Failed to load current folder:', e);
    }
  }

  // ── API helpers ────────────────────────────────────────────────────────────

  async function loadBrewList() {
    try {
      const res = await fetch('/api/brews');
      if (!res.ok) throw new Error(await res.text());
      const list = await res.json();
      setSavedBrews(list.map(b => ({ id: b.name, label: b.name })));
    } catch (e) {
      toast.error(`Failed to load brews: ${e.message}`);
    }
  }

  async function loadGlobalSources() {
    try {
      const res = await fetch('/api/sound-sources');
      if (res.ok) {
        const sources = await res.json();
        // Assign UIDs to any existing source that predates the uid field.
        // These are held in memory and persisted the next time the user saves globals.
        setGlobalSources(sources.map((s, i) => s.uid ? s : { ...s, uid: Date.now() + i }));
      }
    } catch {
      // Non-fatal: sources will be empty
    }
  }

  /**
   * Resolves plain-string clips in a brew's sources to { url, label } objects.
   * Fetches /api/media-data once and matches each clip URL against entry.audioUrl,
   * using the matched entry's name as the label. Clips that are already objects
   * with a label are left unchanged.
   *
   * @param {Object} brewData - The brew definition object (mutated in-place on a shallow copy)
   * @returns {Object} A new brew object with resolved clip labels
   */
  async function resolveClipLabels(brewData) {
    // Check if resolution is needed at all (any plain string or unlabelled clips)
    const needsResolution = (brewData.sources || []).some((src) =>
      (src.clips || []).some((clip) => typeof clip === 'string' || (typeof clip === 'object' && clip.url && !clip.label))
    );
    if (!needsResolution) return brewData;

    // Fetch media data once for lookup
    let mediaList = [];
    try {
      const res = await fetch('/media-data?limit=10000');
      if (res.ok) mediaList = await res.json();
    } catch {
      // Non-fatal: fall back to showing URLs
    }

    const urlToName = new Map(
      mediaList
        .filter((e) => e.audioUrl)
        .map((e) => [e.audioUrl, e.name || e.audioUrl])
    );

    const resolvedSources = (brewData.sources || []).map((src) => ({
      ...src,
      clips: (src.clips || []).map((clip) => {
        const url = typeof clip === 'string' ? clip : clip.url || '';
        const existingLabel = typeof clip === 'object' ? clip.label : '';
        const label = existingLabel || urlToName.get(url) || url;
        return { url, label };
      }),
    }));

    return { ...brewData, sources: resolvedSources };
  }

  /**
   * Fetch global sound sources, then merge with the brew's sources:
   * - For each brew source matching a global source (by uid first, then label),
   *   overwrite it with the global data. The global version is the source of truth,
   *   so if the global label changed the brew source and track references are updated.
   * - For each brew source with no match in the global list, POST it to the global
   *   list so it becomes global.
   * Returns the updated globalSources array and a merged brew.
   */
  async function mergeGlobalSources(brewData) {
    let globals = [];
    try {
      const res = await fetch('/api/sound-sources');
      if (res.ok) globals = await res.json();
    } catch {
      // Non-fatal: proceed without globals
    }

    // Assign UIDs to any global source that predates the uid field.
    globals = globals.map((s, i) => s.uid ? s : { ...s, uid: Date.now() + i });

    const globalByUid = new Map(globals.map(s => [s.uid, s]));
    const globalByLabel = new Map(globals.map(s => [s.label, s]));
    const brewSources = brewData.sources || [];

    // Upsert brew sources not yet in the global list (no uid match and no label match)
    const toAdd = brewSources.filter(s => {
      if (s.uid && globalByUid.has(s.uid)) return false;
      if (s.label && globalByLabel.has(s.label)) return false;
      return true;
    });
    for (const src of toAdd) {
      const srcWithUid = src.uid ? src : { ...src, uid: Date.now() };
      try {
        await fetch('/api/sound-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(srcWithUid),
        });
        globals.push(srcWithUid);
        globalByUid.set(srcWithUid.uid, srcWithUid);
        globalByLabel.set(srcWithUid.label, srcWithUid);
      } catch {
        // Non-fatal
      }
    }

    // Collect label renames: brew source matched by uid but global has a different label.
    // The global label is the source of truth.
    const labelRemap = new Map();
    for (const brewSrc of brewSources) {
      if (brewSrc.uid && globalByUid.has(brewSrc.uid)) {
        const globalSrc = globalByUid.get(brewSrc.uid);
        if (globalSrc.label !== brewSrc.label) {
          labelRemap.set(brewSrc.label, globalSrc.label);
        }
      }
    }

    // Build merged brew sources: global data overwrites brew data on any match
    const mergedBrewSources = brewSources.map(s => {
      if (s.uid && globalByUid.has(s.uid)) return { ...globalByUid.get(s.uid) };
      if (s.label && globalByLabel.has(s.label)) return { ...globalByLabel.get(s.label) };
      return s;
    });

    let mergedBrew = { ...brewData, sources: mergedBrewSources };
    // Apply any label renames to track source references
    if (labelRemap.size > 0) {
      mergedBrew = remapTrackSources(mergedBrew, labelRemap);
    }

    return { globals, mergedBrew };
  }

  /**
   * Collect all source labels referenced by any track in any channel.
   */
  function getUsedSourceLabels(brewData) {
    const used = new Set();
    for (const ch of (brewData.channels || [])) {
      for (const track of (ch.tracks || [])) {
        if (track.type === 'loop' && track.source) {
          used.add(track.source);
        } else if (Array.isArray(track.sources)) {
          track.sources.filter(Boolean).forEach(s => used.add(s));
        }
      }
    }
    return used;
  }

  /**
   * Rewrite track source references in a brew when source labels have been renamed.
   * @param {Object} brewData
   * @param {Map<string,string>} labelMap - Map from old label → new label
   * @returns {Object} Updated brew data (new object reference)
   */
  function remapTrackSources(brewData, labelMap) {
    if (!labelMap.size) return brewData;
    const channels = (brewData.channels || []).map(ch => ({
      ...ch,
      tracks: (ch.tracks || []).map(track => {
        if (track.type === 'loop' && labelMap.has(track.source)) {
          return { ...track, source: labelMap.get(track.source) };
        }
        if (Array.isArray(track.sources)) {
          return { ...track, sources: track.sources.map(s => labelMap.get(s) ?? s) };
        }
        return track;
      }),
    }));
    return { ...brewData, channels };
  }

  /**
   * Prune the brew's sources to only those referenced by existing tracks.
   */
  function pruneBrewSources(brewData) {
    const used = getUsedSourceLabels(brewData);
    const prunedSources = (brewData.sources || []).filter(s => used.has(s.label));
    return { ...brewData, sources: prunedSources };
  }

  async function handleOpenBrew(item) {
    try {
      const res = await fetch(`/api/brews/${encodeURIComponent(item.id)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Resolve any plain-string clip URLs to { url, label } objects
      const resolved = await resolveClipLabels(data);
      // Merge with global sound sources
      const { globals, mergedBrew } = await mergeGlobalSources(resolved);
      setGlobalSources(globals);
      // Prune brew sources to only those used by tracks
      setBrew(pruneBrewSources(mergedBrew));
      setShowSources(false);
      setIsListOpen(false);
    } catch (e) {
      toast.error(`Failed to load brew: ${e.message}`);
    }
  }

  async function handleSave() {
    if (!brew?.label?.trim()) {
      toast.error('Brew label is required');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/brews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: brew.label, data: brew }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadBrewList();
      toast.success('Brew saved');
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteByName(name) {
    const result = await showDialog(
      `Delete "${name}"? This cannot be undone.`,
      'Confirm Delete',
      ['Delete', 'Cancel']
    );
    if (result !== 'Delete') return;

    try {
      const res = await fetch(`/api/brews/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      // If the deleted brew is currently loaded, clear it
      if (brew?.label === name) setBrew(null);
      await loadBrewList();
      toast.success('Brew deleted');
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`);
    }
  }


  async function handleExportByName(name) {
    // Export loaded brew directly; otherwise fetch first
    if (brew && brew.label === name) {
      exportBrewData(name, brew);
      return;
    }
    try {
      const res = await fetch(`/api/brews/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      exportBrewData(name, data);
    } catch (e) {
      toast.error(`Export failed: ${e.message}`);
    }
  }

  function exportBrewData(name, data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'brew'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Audio Preview ──────────────────────────────────────────────────────────

  /**
   * Start audio preview, optionally with recording.
   * @param {Object|null} brewOverride - A temp brew for sub-previews (channel preview).
   *   Pass null/undefined to preview the full current brew.
   * @param {boolean} withRecording - When true, record the full brew and auto-save on completion.
   *   Ignored for sub-previews (brewOverride set).
   */
  async function startPreview(brewOverride, withRecording = false, recordingDuration = null) {
    const targetBrew = brewOverride || brew;
    if (!targetBrew) return;

    // Stop any current playback
    stopPlayback();

    // Resume AudioContext if suspended (browser autoplay policy)
    if (AmbientCoffee.audioContext.state === 'suspended') {
      await AmbientCoffee.audioContext.resume();
    }

    const coffee = new AmbientCoffee();
    coffeeRef.current = coffee;

    // Wire up recording (only for the full brew, not sub-previews)
    if (withRecording && !brewOverride) {
      const dest = AmbientCoffee.audioContext.createMediaStreamDestination();
      coffee.connect(dest);
      const chunks = [];
      const brewLabel = targetBrew.label || 'unnamed';
      const recorder = new MediaRecorder(dest.stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        // Only upload when the auto-stop timeout fired (not when user pressed Stop).
        if (autoSaveRecordingRef.current) {
          const filename = `brew-loop-${brewLabel}.wav`;
          try {
            // MediaRecorder captures webm; decode it then re-encode as WAV so
            // the uploaded file is in a universally supported format.
            const webmBlob = new Blob(chunks, { type: 'audio/webm' });
            const arrayBuffer = await webmBlob.arrayBuffer();
            const audioBuffer = await AmbientCoffee.audioContext.decodeAudioData(arrayBuffer);
            const wavBlob = audioBufferToWavBlob(audioBuffer);
            const formData = new FormData();
            formData.append('audio', wavBlob, filename);
            const res = await fetch('/upload/audio', { method: 'POST', body: formData });
            if (!res.ok) {
              const data = await res.json().catch(() => ({ error: res.statusText }));
              throw new Error(data.error || res.statusText);
            }
            toast.success(`Recording "${filename}" saved to media library`);
          } catch (e) {
            toast.error(`Recording save failed: ${e.message}`);
          }
        }
        autoSaveRecordingRef.current = false;
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    }

    try {
      // When recording the full brew, use cutInto() for an immediate hard cut
      // to full volume so the MediaRecorder captures audio from the first frame.
      // For all other previews (sub-previews or non-recording), use the normal
      // loadBrew + playBrew flow which applies the standard fade-in.
      if (withRecording && !brewOverride) {
        await coffee.cutInto(targetBrew);
      } else {
        await coffee.loadBrew(targetBrew);
        coffee.playBrew(targetBrew.label);
      }
      setIsPlaying(true);

      // Re-apply any persisted channel enabled states to the new session
      Object.entries(channelStates).forEach(([label, state]) => {
        if (state.enabled === false) {
          coffee.getChannel(label)?.setEnabled(false);
        }
      });

      // Start the playback timer
      setPlaybackSeconds(0);
      timerRef.current = setInterval(() => {
        setPlaybackSeconds(prev => prev + 1);
      }, 1000);

      // When recording, auto-stop after the specified duration and save the result.
      if (withRecording && !brewOverride) {
        const secs = Math.max(1, Number(recordingDuration ?? recordDuration) || 30);
        recordTimeoutRef.current = setTimeout(() => {
          autoSaveRecordingRef.current = true;
          stopPlayback();
        }, secs * 1000);
      }
    } catch (e) {
      console.log(e)
      toast.error(`Preview failed: ${e.message}`);
      stopPlayback();
    }
  }

  function stopPlayback() {
    // Cancel any pending auto-save timeout so it doesn't fire after a manual stop.
    if (recordTimeoutRef.current) {
      clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = null;
    }
    if (coffeeRef.current) {
      // Silence immediately, then stop all internal track loops
      coffeeRef.current.gain.value = 0;
      console.log('[BrewEditor] stopPlayback() — calling coffee.stop()');
      coffeeRef.current.stop();
      coffeeRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      // autoSaveRecordingRef.current is false here on manual stop → onstop discards blob.
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    // Stop and reset the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPlaybackSeconds(0);
    setIsPlaying(false);
    setIsRecording(false);
  }

  // ── Source mutation helpers ────────────────────────────────────────────────

  /**
   * Handle a change to a global source. Updates both globalSources and the
   * brew's sources array (for data structure validity).
   * Matches the brew source by uid (preferred) or the old label as fallback.
   * If the label changed the brew's track references are updated to match.
   * Persistence is done explicitly via "Save Global".
   */
  const handleGlobalSourceChange = useCallback((updatedSource, index) => {
    const oldSource = globalSources[index];
    const nextGlobals = [...globalSources];
    nextGlobals[index] = updatedSource;
    setGlobalSources(nextGlobals);

    // Mirror the change in the brew's sources array
    setBrew(prev => {
      if (!prev) return prev;
      const nextSources = [...(prev.sources || [])];
      // Match by uid if available, otherwise by the old source label
      const brewIdx = nextSources.findIndex(s =>
        (updatedSource.uid && s.uid === updatedSource.uid) ||
        (!updatedSource.uid && s.label === oldSource.label)
      );
      if (brewIdx < 0) return { ...prev, sources: nextSources };
      const oldBrewLabel = nextSources[brewIdx].label;
      nextSources[brewIdx] = updatedSource;
      // If the label changed, update track references to the new label
      if (oldBrewLabel !== updatedSource.label) {
        return remapTrackSources(
          { ...prev, sources: nextSources },
          new Map([[oldBrewLabel, updatedSource.label]])
        );
      }
      return { ...prev, sources: nextSources };
    });
  }, [globalSources]);

  const handleGlobalSourcesChange = useCallback(async (nextGlobals) => {
    // Detect deleted sources — prefer uid matching, fall back to label
    const deletedSources = globalSources.filter(s => {
      if (s.uid) return !nextGlobals.some(ng => ng.uid === s.uid);
      return s.label && !nextGlobals.some(ng => ng.label === s.label);
    });

    setGlobalSources(nextGlobals);
    // Mirror in brew sources and clear any track references to deleted sources.
    setBrew(prev => {
      if (!prev) return prev;
      const nextUids = new Set(nextGlobals.map(s => s.uid).filter(Boolean));
      const nextLabels = new Set(nextGlobals.map(s => s.label));
      const deletedLabels = new Set(deletedSources.map(s => s.label));
      // Keep brew sources not matched to any global source (shouldn't normally happen),
      // then replace/add from the new global list.
      const kept = (prev.sources || []).filter(s => {
        if (s.uid) return !nextUids.has(s.uid) && !deletedLabels.has(s.label);
        return !nextLabels.has(s.label);
      });
      // Clear track sources that pointed to a now-deleted global source
      const channels = (prev.channels || []).map(ch => ({
        ...ch,
        tracks: (ch.tracks || []).map(track => {
          if (track.type === 'loop' && deletedLabels.has(track.source)) {
            return { ...track, source: '' };
          }
          if (Array.isArray(track.sources)) {
            const clearedSources = track.sources.map(s => deletedLabels.has(s) ? '' : s);
            return { ...track, sources: clearedSources };
          }
          return track;
        }),
      }));
      return { ...prev, sources: [...nextGlobals, ...kept], channels };
    });

    // Delete removed sources from the API
    for (const src of deletedSources) {
      try {
        await fetch(`/api/sound-sources/${encodeURIComponent(src.label)}`, {
          method: 'DELETE',
        });
      } catch {
        // Non-fatal
      }
    }
  }, [globalSources]);

  // ── Source length cache update ─────────────────────────────────────────────

  const handleSourceLengthsChange = useCallback((lengths) => {
    setSourceLengths(prev => ({ ...prev, ...lengths }));
  }, []);

  // ── Brew mutation helpers ──────────────────────────────────────────────────

  const handleBrewChange = useCallback((patch) => {
    setBrew(prev => ({ ...prev, ...patch }));
  }, []);

  const handleChannelsChange = useCallback((channels) => {
    setBrew(prev => {
      if (!prev) return prev;
      // Merge any global sources not yet in brew.sources before pruning,
      // so sources newly referenced by event tracks are included in the saved brew.
      const existingLabels = new Set((prev.sources || []).map(s => s.label));
      const mergedSources = [
        ...(prev.sources || []),
        ...globalSources.filter(s => s.label && !existingLabels.has(s.label)),
      ];
      const updated = { ...prev, channels, sources: mergedSources };
      return pruneBrewSources(updated);
    });
  }, [globalSources]);

  // ── Live channel property helpers ─────────────────────────────────────────

  /** Helper to read a channel's enabled state (defaults to true). */
  const isChannelEnabled = (label) => channelStates[label]?.enabled ?? true;

  /**
   * Called from the per-channel onChange before handleChannelsChange.
   * Compares only the three live-editable properties and calls the appropriate
   * setter on the playing AmbientChannel if a change is detected.
   */
  function handleChannelLiveUpdate(label, next, prev) {
    if (!isPlaying || !coffeeRef.current) return;
    const ch = coffeeRef.current.getChannel(label);
    if (!ch) return;
    if (next.gain      !== prev.gain)      ch.setGain(next.gain ?? 0.5);
    if (next.muffle    !== prev.muffle)    ch.setMuffle(next.muffle);
    if (next.reverb    !== prev.reverb)    ch.setReverb(next.reverb);
    if (next.radio     !== prev.radio)     ch.setRadio(next.radio ?? null);
    if (next.underwater !== prev.underwater) ch.setUnderwater(next.underwater ?? false);
    // Per-track live updates (gain range and pan)
    const nextTracks = next.tracks || [];
    const prevTracks = prev.tracks || [];
    nextTracks.forEach((nextTrack, i) => {
      const prevTrack = prevTracks[i];
      if (!prevTrack) return;
      const track = ch.getTrack(i);
      if (!track) return;
      if (JSON.stringify(nextTrack.gain) !== JSON.stringify(prevTrack.gain)) track.setGainRange(nextTrack.gain ?? { min: 0.5, max: 0.5 });
      if (JSON.stringify(nextTrack.pan)  !== JSON.stringify(prevTrack.pan))  track.setPanConfig(nextTrack.pan ?? null);
    });
  }

  function handleChannelEnabled(label, enabled) {
    setChannelStates(prev => ({ ...prev, [label]: { ...prev[label], enabled } }));
    coffeeRef.current?.getChannel(label)?.setEnabled(enabled);
  }

  function handleChannelSolo(label) {
    const allLabels = (brew?.channels || []).map(ch => ch.label);
    const next = {};
    allLabels.forEach(l => {
      next[l] = { enabled: l === label };
      coffeeRef.current?.getChannel(l)?.setEnabled(l === label);
    });
    setChannelStates(next);
  }

  // Source labels derived from global sources — passed into ChannelForm/TrackForm.
  // Plain labels are used as values; display labels include the effective length when known.
  const sourceLabels = globalSources.map(s => s.label).filter(Boolean);

  // Set of source labels currently referenced by any track in the loaded brew.
  // Used to show lock icons on the Sound Sources list.
  const usedSourceLabels = brew ? getUsedSourceLabels(brew) : new Set();

  // Disable the brew-level preview when any channel has no tracks or any track lacks a source
  function trackHasSource(track) {
    if (track.type === 'loop') return Boolean(track.source);
    return Array.isArray(track.sources) && track.sources.length > 0 && track.sources.every(s => Boolean(s));
  }
  const channels = brew?.channels || [];
  const brewPreviewDisabled = channels.length === 0 ||
    channels.some(ch => {
      const tracks = ch.tracks || [];
      return tracks.length === 0 || tracks.some(t => !trackHasSource(t));
    });

  // ── Render ─────────────────────────────────────────────────────────────────

  return html`
    <${PageRoot} theme=${theme}>

      <!-- Page header -->
      <${AppHeader}>
        <${H1}>Brew Editor</${H1}>
        <${HorizontalLayout} gap="small">
          <${Button}
            variant="medium-icon-text"
            icon="music"
            color="secondary"
            onClick=${() => setIsGalleryOpen(true)}
          >
            Gallery
          </${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="folder"
            color="secondary"
            onClick=${() => openFolderSelect({ currentFolder, onFolderChanged: setCurrentFolder, toast })}
          >
            ${currentFolder.label}
          </${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="save"
            color="secondary"
            onClick=${() => setIsListOpen(true)}
          >
            Open
          </${Button}>
          <${HamburgerMenu} />
        </${HorizontalLayout}>
      </${AppHeader}>

      <!-- Audio gallery modal (audio only, no search/action bar) -->
      <${Gallery}
        isOpen=${isGalleryOpen}
        onClose=${() => setIsGalleryOpen(false)}
        queryPath="/media-data"
        previewFactory=${createGalleryPreview}
        fileTypeFilter=${['audio']}
        hideControls=${true}
      />

      <!-- Brew selector modal (Open, New, per-item Export and Delete) -->
      <${ListSelectModal}
        isOpen=${isListOpen}
        title="Open Brew"
        items=${savedBrews}
        itemIcon="disc"
        actionLabel="New Brew"
        itemActions=${[
          {
            icon: 'download',
            title: 'Export brew as JSON',
            onClick: (item) => handleExportByName(item.id),
          },
          {
            icon: 'trash',
            color: 'danger',
            title: 'Delete brew',
            onClick: (item) => handleDeleteByName(item.id),
          },
        ]}
        onSelectItem=${handleOpenBrew}
        onAction=${() => { setBrew(createDefaultBrew()); setShowSources(false); setIsListOpen(false); }}
        onClose=${() => setIsListOpen(false)}
        emptyMessage="No saved brews yet"
      />

      <!-- Sound Sources (global list, collapsible) -->
      ${showSources && html`
        <${Panel} variant="outlined">
          <${DynamicList}
            title="Sound Sources (Global)"
            items=${globalSources}
            renderItem=${(item, i) => html`
              <${SoundSourceForm}
                item=${item}
                onSourceLengthsChange=${handleSourceLengthsChange}
                onChange=${(updated) => handleGlobalSourceChange(updated, i)}
              />
            `}
            getTitle=${(item) => {
              const label = item.label || 'Source';
              const len = sourceLengths[item.label];
              const text = len != null ? `${label} (${len}s)` : label;
              // lock = used by a channel in the current brew, lock-open = not used or no brew
              const iconName = (brew && usedSourceLabels.has(item.label)) ? 'lock' : 'lock-open-alt';
              return html`
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  <${Icon} name=${iconName} size="14px" color=${theme.colors.text.secondary} />
                  ${text}
                </span>
              `;
            }}
            createItem=${createDefaultSource}
            onChange=${handleGlobalSourcesChange}
            addLabel="Add Source"
          />
        </${Panel}>
      `}

      <!-- Action container between Sound Sources and Brew sections -->
      <${Panel} variant="default">
        <${HorizontalLayout} gap="small">
          <${Button}
            variant="medium-icon-text"
            icon=${showSources ? 'eye-slash' : 'eye'}
            color="secondary"
            onClick=${() => setShowSources(v => !v)}
          >
            ${showSources ? 'Hide' : 'Show'}
          </${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="save"
            color="secondary"
            onClick=${async () => {
              try {
                for (const src of globalSources) {
                  await fetch('/api/sound-sources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(src),
                  });
                }
                toast.success('Global sources saved');
              } catch (e) {
                toast.error(`Save failed: ${e.message}`);
              }
            }}
          >
            Save Global
          </${Button}>
        </${HorizontalLayout}>
      </${Panel}>

      <!-- Empty state -->
      ${!brew ? html`
        <${Panel} variant="default">
          <${EmptyState} theme=${theme}>
            Open or create a brew to get started.
          </${EmptyState}>
        </${Panel}>
      ` : html`

        <!-- Brew Settings -->
        <${Panel} variant="outlined">
          <${SectionTitle} theme=${theme}>Brew Settings</${SectionTitle}>
          <${Input}
            label="Label"
            value=${brew.label || ''}
            widthScale="full"
            onInput=${(e) => handleBrewChange({ label: e.target.value })}
            placeholder="Brew name"
          />
        </${Panel}>

        <!-- Channels -->
        <${Panel} variant="outlined">
          <${DynamicList}
            title="Channels"
            items=${brew.channels || []}
            renderItem=${(item, i) => html`
              <${ChannelForm}
                item=${item}
                sourceLabels=${sourceLabels}
                sourceLengths=${sourceLengths}
                enabled=${isChannelEnabled(item.label)}
                onEnabledChange=${(enabled) => handleChannelEnabled(item.label, enabled)}
                onSolo=${() => handleChannelSolo(item.label)}
                onChange=${(updated) => {
                  handleChannelLiveUpdate(item.label, updated, item);
                  const next = [...(brew.channels || [])];
                  next[i] = updated;
                  handleChannelsChange(next);
                }}
              />
            `}
            getTitle=${(item) => item.label || 'Channel'}
            createItem=${createDefaultChannel}
            onChange=${handleChannelsChange}
            addLabel="Add Channel"
          />
        </${Panel}>

        <!-- Action Bar -->
        <${Panel} variant="default">
          <${HorizontalLayout} gap="small" style=${{ flexWrap: 'wrap', alignItems: 'center' }}>
            <!-- Left edge: Record button, preview toggle, timer -->
            <${Button}
              variant="medium-icon-text"
              icon="microphone"
              loading=${isRecording}
              color=${isRecording ? 'danger' : 'secondary'}
              disabled=${isRecording}
              onClick=${async () => {
                const duration = await showNumberPrompt('Recording Duration (seconds)', recordDuration, 1);
                if (duration === null) return;
                setRecordDuration(duration);
                startPreview(null, true, duration);
              }}
            >
              ${isRecording ? 'Recording…' : 'Record'}
            </${Button}>
            <${Button}
              variant="medium-icon-text"
              icon=${isPlaying ? 'stop' : 'play'}
              color=${isPlaying ? 'secondary' : 'primary'}
              disabled=${!isPlaying && brewPreviewDisabled}
              onClick=${isPlaying ? stopPlayback : () => startPreview()}
            >
              ${isPlaying ? 'Stop' : 'Preview'}
            </${Button}>
            <${TimerPanel} theme=${theme}>
              ${String(Math.floor(playbackSeconds / 60)).padStart(2, '0')}:${String(playbackSeconds % 60).padStart(2, '0')}
            </${TimerPanel}>

            <!-- Right edge: Save -->
            <div style="flex:1" />
            <${Button}
              variant="medium-icon-text"
              icon="save"
              color="primary"
              disabled=${isSaving}
              onClick=${handleSave}
            >
              ${isSaving ? 'Saving…' : 'Save Brew'}
            </${Button}>
          </${HorizontalLayout}>
        </${Panel}>
      `}
    </${PageRoot}>
  `;
}
