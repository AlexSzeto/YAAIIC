/**
 * brew-editor.mjs – Main Brew Editor component.
 *
 * Renders:
 *  - A header with Open / New / Import / Export / Upload Audio buttons
 *  - A ListSelectModal for selecting saved brews
 *  - Top-level brew settings (label, mediaUrl)
 *  - DynamicList for Sound Sources (SoundSourceForm)
 *  - DynamicList for Channels (ChannelForm)
 *  - Action bar: Record / Preview / Stop / Save / Delete
 */
import { html } from 'htm/preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Checkbox } from '../../custom-ui/io/checkbox.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
import { H1, VerticalLayout, HorizontalLayout } from '../../custom-ui/themed-base.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import ListSelectModal from '../../custom-ui/overlays/list-select.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { AppHeader } from '../themed-base.mjs';
import { SoundSourceForm } from './sound-source-form.mjs';
import { ChannelForm } from './channel-form.mjs';
import { AmbientCoffee } from '../../ambrew/ambient-coffee.js';

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

// ============================================================================
// Default factory helpers
// ============================================================================

function createDefaultBrew() {
  return {
    label: 'New Brew',
    mediaUrl: '',
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

  // Hidden file inputs (refs to DOM input elements)
  const importInputRef = useRef(null);
  const uploadAudioInputRef = useRef(null);

  // Audio playback refs
  const coffeeRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedBlobRef = useRef(null);

  // ── Load brew list on mount ────────────────────────────────────────────────
  useEffect(() => {
    loadBrewList();
  }, []);

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

  async function handleOpenBrew(item) {
    try {
      const res = await fetch(`/api/brews/${encodeURIComponent(item.id)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBrew(data);
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

  async function handleDelete() {
    if (!brew?.label) return;
    const result = await showDialog(
      `Delete "${brew.label}"? This cannot be undone.`,
      'Confirm Delete',
      ['Delete', 'Cancel']
    );
    if (result !== 'Delete') return;

    try {
      const res = await fetch(`/api/brews/${encodeURIComponent(brew.label)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      setBrew(null);
      await loadBrewList();
      toast.success('Brew deleted');
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`);
    }
  }

  // ── Import / Export ────────────────────────────────────────────────────────

  function handleImportClick() {
    importInputRef.current && importInputRef.current.click();
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        setBrew(parsed);
        toast.success(`Imported "${parsed.label || file.name}"`);
      } catch {
        toast.error('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = '';
  }

  function handleExport() {
    if (!brew) return;
    const json = JSON.stringify(brew, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brew.label || 'brew'}.json`;
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

  async function startPreview() {
    if (!brew) return;

    // Stop any current playback
    stopPlayback();

    // Resume AudioContext if suspended (browser autoplay policy)
    if (AmbientCoffee.audioContext.state === 'suspended') {
      await AmbientCoffee.audioContext.resume();
    }

    const coffee = new AmbientCoffee();
    coffeeRef.current = coffee;

    // Wire up recording if enabled
    if (isRecording) {
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
      await coffee.loadBrew(brew);
      coffee.playBrew(brew.label);
      setIsPlaying(true);
    } catch (e) {
      toast.error(`Preview failed: ${e.message}`);
      stopPlayback();
    }
  }

  function stopPlayback() {
    if (coffeeRef.current) {
      // Silence immediately — AmbientBrew.disconnect() is private on AmbientCoffee,
      // so we zero the master gain to stop audio output.
      coffeeRef.current.gain.value = 0;
      coffeeRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
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

  // ── Brew mutation helpers ──────────────────────────────────────────────────

  const handleBrewChange = useCallback((patch) => {
    setBrew(prev => ({ ...prev, ...patch }));
  }, []);

  const handleSourcesChange = useCallback((sources) => {
    setBrew(prev => ({ ...prev, sources }));
  }, []);

  const handleChannelsChange = useCallback((channels) => {
    setBrew(prev => ({ ...prev, channels }));
  }, []);

  // Source labels derived from current brew — passed into ChannelForm/TrackForm
  const sourceLabels = (brew?.sources || []).map(s => s.label).filter(Boolean);

  // ── Render ─────────────────────────────────────────────────────────────────

  return html`
    <${PageRoot} theme=${theme}>

      <!-- Hidden inputs -->
      <input
        type="file"
        accept=".json"
        ref=${importInputRef}
        style="display:none"
        onChange=${handleImportFile}
      />
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
            icon="folder"
            color="secondary"
            onClick=${() => setIsListOpen(true)}
          >
            Open
          </${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="plus"
            color="secondary"
            onClick=${() => setBrew(createDefaultBrew())}
          >
            New
          </${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="upload"
            color="secondary"
            onClick=${handleImportClick}
          >
            Import
          </${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="download"
            color="secondary"
            disabled=${!brew}
            onClick=${handleExport}
          >
            Export
          </${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="music"
            color="secondary"
            onClick=${handleUploadAudioClick}
          >
            Upload Audio
          </${Button}>
        </${HorizontalLayout}>
      </${AppHeader}>

      <!-- Brew selector modal -->
      <${ListSelectModal}
        isOpen=${isListOpen}
        title="Open Brew"
        items=${savedBrews}
        itemIcon="music"
        actionLabel="New Brew"
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
          <${VerticalLayout} gap="medium">
            <${Input}
              label="Label"
              value=${brew.label || ''}
              widthScale="full"
              onInput=${(e) => handleBrewChange({ label: e.target.value })}
              placeholder="Brew name"
            />
            <${Input}
              label="Media URL (base path for clips)"
              value=${brew.mediaUrl ?? ''}
              widthScale="full"
              onInput=${(e) => handleBrewChange({ mediaUrl: e.target.value })}
              placeholder="Leave empty when using gallery-selected clips"
            />
          </${VerticalLayout}>
        </${Panel}>

        <!-- Sound Sources -->
        <${Panel} variant="outlined">
          <${DynamicList}
            title="Sound Sources"
            items=${brew.sources || []}
            renderItem=${(item, i) => html`
              <${SoundSourceForm}
                item=${item}
                onChange=${(updated) => {
                  const next = [...(brew.sources || [])];
                  next[i] = updated;
                  handleSourcesChange(next);
                }}
              />
            `}
            getTitle=${(item) => item.label || 'Source'}
            createItem=${createDefaultSource}
            onChange=${handleSourcesChange}
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
            <${Checkbox}
              label="Record Audio"
              checked=${isRecording}
              onChange=${(e) => setIsRecording(e.target.checked)}
            />
            <${Button}
              variant="medium-icon-text"
              icon="play"
              color="primary"
              disabled=${isPlaying}
              onClick=${startPreview}
            >
              Preview
            </${Button}>
            <${Button}
              variant="medium-icon-text"
              icon="square"
              color="secondary"
              disabled=${!isPlaying}
              onClick=${stopPlayback}
            >
              Stop
            </${Button}>
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
            <div style="flex:1" />
            <${Button}
              variant="medium-icon-text"
              icon="save"
              color="primary"
              disabled=${isSaving}
              onClick=${handleSave}
            >
              ${isSaving ? 'Saving…' : 'Save'}
            </${Button}>
            <${Button}
              variant="medium-icon-text"
              icon="trash"
              color="danger"
              disabled=${!savedBrews.some(b => b.id === brew?.label)}
              onClick=${handleDelete}
            >
              Delete
            </${Button}>
          </${HorizontalLayout}>
        </${Panel}>
      `}
    </${PageRoot}>
  `;
}
