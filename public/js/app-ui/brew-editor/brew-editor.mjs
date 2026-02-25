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
import ListSelectModal from '../../custom-ui/overlays/list-select.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { AppHeader } from '../themed-base.mjs';
import { HamburgerMenu } from '../hamburger-menu.mjs';
import { SoundSourceForm } from './sound-source-form.mjs';
import { ChannelForm } from './channel-form.mjs';
import { AmbientCoffee } from '../../ambrew/ambient-coffee.js';
import { openFolderSelect } from '../use-folder-select.mjs';

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
  border-radius: ${props => props.theme.spacing.small.borderRadius};
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
    label: 'Source',
    clips: [],
    repeatCount: { min: 1, max: 1 },
    repeatDelay: { min: 0, max: 0 },
    attack: { min: 0, max: 0.5 },
    decay: { min: 0, max: 0.5 },
  };
}

function createDefaultChannel() {
  return {
    label: 'Channel',
    distance: 'medium',
    muffled: false,
    reverb: false,
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
  const [hasRecording, setHasRecording] = useState(false);
  const [currentFolder, setCurrentFolder] = useState({ uid: '', label: 'Unsorted' });
  const [recordDuration, setRecordDuration] = useState(30);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  // Global sound sources — separate from the brew's own sources array.
  // The Sound Sources panel edits these; the brew's sources array mirrors them.
  const [globalSources, setGlobalSources] = useState([]);
  // Cached effective playback lengths keyed by source label (not persisted).
  const [sourceLengths, setSourceLengths] = useState({});

  // Hidden file inputs (refs to DOM input elements)
  const uploadAudioInputRef = useRef(null);

  // Audio playback refs
  const coffeeRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedBlobRef = useRef(null);
  const timerRef = useRef(null);

  // ── Load brew list and current folder on mount ─────────────────────────────
  useEffect(() => {
    loadBrewList();
    loadCurrentFolder();
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
   * - For each brew source whose label matches a global source, overwrite it
   *   with the global data.
   * - For each brew source whose label has no match in the global list, POST it
   *   to the global list so it becomes global.
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

    const globalMap = new Map(globals.map(s => [s.label, s]));
    const brewSources = brewData.sources || [];

    // Upsert any brew sources not yet in the global list
    const toAdd = brewSources.filter(s => s.label && !globalMap.has(s.label));
    for (const src of toAdd) {
      try {
        await fetch('/api/sound-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(src),
        });
        globals.push(src);
        globalMap.set(src.label, src);
      } catch {
        // Non-fatal
      }
    }

    // Build the merged brew sources: brew sources overwritten by global data
    const mergedBrewSources = brewSources.map(s =>
      globalMap.has(s.label) ? { ...globalMap.get(s.label) } : s
    );

    return {
      globals,
      mergedBrew: { ...brewData, sources: mergedBrewSources },
    };
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
      setBrew(mergedBrew);
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

  // ── Audio Upload ───────────────────────────────────────────────────────────

  function handleUploadAudioClick() {
    uploadAudioInputRef.current && uploadAudioInputRef.current.click();
  }

  async function handleUploadAudioFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const formData = new FormData();
      formData.append('audio', file);
      toast.info(`Uploading "${file.name}"…`);
      const res = await fetch('/upload/audio', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || res.statusText);
      }
      toast.success(`"${file.name}" uploaded to media library`);
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`);
    }
  }

  // ── Audio Preview ──────────────────────────────────────────────────────────

  async function startPreview(brewOverride) {
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

    // Wire up recording if enabled (only when previewing the full brew, not sub-previews)
    if (isRecording && !brewOverride) {
      setHasRecording(false);
      recordedBlobRef.current = null;
      const dest = AmbientCoffee.audioContext.createMediaStreamDestination();
      coffee.connect(dest);
      const chunks = [];
      const recorder = new MediaRecorder(dest.stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        recordedBlobRef.current = blob;
        setHasRecording(true);
      };
      recorder.start();
      recorderRef.current = recorder;
    }

    try {
      // When recording the full brew, use cutInto() for an immediate hard cut
      // to full volume so the MediaRecorder captures audio from the first frame.
      // For all other previews (sub-previews or non-recording), use the normal
      // loadBrew + playBrew flow which applies the standard fade-in.
      if (isRecording && !brewOverride) {
        await coffee.cutInto(targetBrew);
      } else {
        await coffee.loadBrew(targetBrew);
        coffee.playBrew(targetBrew.label);
      }
      setIsPlaying(true);

      // Start the playback timer
      setPlaybackSeconds(0);
      timerRef.current = setInterval(() => {
        setPlaybackSeconds(prev => prev + 1);
      }, 1000);

      // When recording, auto-stop after the specified duration
      if (isRecording && !brewOverride) {
        const secs = Math.max(1, Number(recordDuration) || 30);
        setTimeout(() => stopPlayback(), secs * 1000);
      }
    } catch (e) {
      toast.error(`Preview failed: ${e.message}`);
      stopPlayback();
    }
  }

  function stopPlayback() {
    if (coffeeRef.current) {
      // Silence immediately
      coffeeRef.current.gain.value = 0;
      coffeeRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
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
  }

  // ── Upload recorded audio loop ─────────────────────────────────────────────

  async function handleUploadRecording() {
    const blob = recordedBlobRef.current;
    if (!blob) return;

    const filename = `brew-loop-${brew?.label || 'unnamed'}.webm`;
    try {
      const formData = new FormData();
      formData.append('audio', blob, filename);
      toast.info(`Uploading recorded loop "${filename}"…`);
      const res = await fetch('/upload/audio', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || res.statusText);
      }
      toast.success(`Loop "${filename}" added to media library`);
      setHasRecording(false);
      recordedBlobRef.current = null;
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`);
    }
  }

  // ── Source mutation helpers ────────────────────────────────────────────────

  /**
   * Handle a change to a global source. Updates both globalSources and the
   * brew's sources array (for data structure validity), then persists to the API.
   */
  const handleGlobalSourceChange = useCallback(async (updatedSource, index) => {
    // Update global list in memory
    const nextGlobals = [...globalSources];
    nextGlobals[index] = updatedSource;
    setGlobalSources(nextGlobals);

    // Mirror the change in the brew's sources array
    setBrew(prev => {
      if (!prev) return prev;
      const nextSources = [...(prev.sources || [])];
      const brewIdx = nextSources.findIndex(s => s.label === updatedSource.label);
      if (brewIdx >= 0) {
        nextSources[brewIdx] = updatedSource;
      }
      return { ...prev, sources: nextSources };
    });

    // Persist to API (non-blocking)
    try {
      await fetch('/api/sound-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSource),
      });
    } catch {
      // Non-fatal
    }
  }, [globalSources]);

  const handleGlobalSourcesChange = useCallback((nextGlobals) => {
    setGlobalSources(nextGlobals);
    // Mirror in brew sources: rebuild brew.sources to include all global sources
    // used by the brew's channels, and add any new global sources at the end.
    setBrew(prev => {
      if (!prev) return prev;
      const globalLabels = new Set(nextGlobals.map(s => s.label));
      // Keep brew sources not in the global list (shouldn't normally happen), then
      // replace/add from the new global list.
      const kept = (prev.sources || []).filter(s => !globalLabels.has(s.label));
      return { ...prev, sources: [...nextGlobals, ...kept] };
    });
  }, []);

  // ── Source length cache update ─────────────────────────────────────────────

  const handleSourceLengthsChange = useCallback((lengths) => {
    setSourceLengths(prev => ({ ...prev, ...lengths }));
  }, []);

  // ── Brew mutation helpers ──────────────────────────────────────────────────

  const handleBrewChange = useCallback((patch) => {
    setBrew(prev => ({ ...prev, ...patch }));
  }, []);

  const handleChannelsChange = useCallback((channels) => {
    setBrew(prev => ({ ...prev, channels }));
  }, []);

  // Source labels derived from global sources — passed into ChannelForm/TrackForm.
  // Plain labels are used as values; display labels include the effective length when known.
  const sourceLabels = globalSources.map(s => s.label).filter(Boolean);

  // Disable the brew-level preview when any channel has no tracks or any track lacks a source
  function trackHasSource(track) {
    if (track.type === 'loop') return Boolean(track.source);
    return Array.isArray(track.sources) && track.sources.some(s => Boolean(s));
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

      <!-- Hidden inputs -->
      <input
        type="file"
        accept="audio/*"
        ref=${uploadAudioInputRef}
        style="display:none"
        onChange=${handleUploadAudioFile}
      />

      <!-- Page header -->
      <${AppHeader}>
        <${H1}>Brew Editor</${H1}>
        <${HorizontalLayout} gap="small">
          <${Button}
            variant="medium-icon-text"
            icon="music"
            color="secondary"
            onClick=${handleUploadAudioClick}
          >
            Upload Audio
          </${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="disc"
            color="secondary"
            onClick=${() => setIsListOpen(true)}
          >
            Open
          </${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="folder"
            color="secondary"
            onClick=${() => openFolderSelect({ currentFolder, onFolderChanged: setCurrentFolder, toast })}
          >
            ${currentFolder.label}
          </${Button}>
          <${HamburgerMenu} />
        </${HorizontalLayout}>
      </${AppHeader}>

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
        onAction=${() => { setBrew(createDefaultBrew()); setIsListOpen(false); }}
        onClose=${() => setIsListOpen(false)}
        emptyMessage="No saved brews yet"
      />

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

        <!-- Sound Sources (global list) -->
        <${Panel} variant="outlined">
          <${DynamicList}
            title="Sound Sources"
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
              return len != null ? `${label} (${len}s)` : label;
            }}
            createItem=${createDefaultSource}
            onChange=${handleGlobalSourcesChange}
            addLabel="Add Source"
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
                sources=${globalSources}
                sourceLengths=${sourceLengths}
                onPreview=${startPreview}
                isPlaying=${isPlaying}
                onStop=${stopPlayback}
                onChange=${(updated) => {
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
            <!-- Left edge: Record button, duration input, preview toggle, timer -->
            <${Button}
              variant="medium-icon-text"
              icon=${isRecording ? 'microphone-slash' : 'microphone'}
              color=${isRecording ? 'danger' : 'secondary'}
              onClick=${() => setIsRecording(r => !r)}
            >
              ${isRecording ? 'Recording' : 'Record'}
            </${Button}>
            <${Input}
              type="number"
              label="Duration (s)"
              value=${recordDuration}
              widthScale="compact"
              heightScale="compact"
              min=${1}
              onInput=${(e) => setRecordDuration(Number(e.target.value) || 30)}
            />
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
            ${hasRecording ? html`
              <${Button}
                variant="medium-icon-text"
                icon="upload"
                color="secondary"
                onClick=${handleUploadRecording}
              >
                Upload Loop
              </${Button}>
            ` : null}
            <${Button}
              variant="medium-icon-text"
              icon="save"
              color="primary"
              disabled=${isSaving}
              onClick=${handleSave}
            >
              ${isSaving ? 'Saving…' : 'Save'}
            </${Button}>
          </${HorizontalLayout}>
        </${Panel}>
      `}
    </${PageRoot}>
  `;
}
