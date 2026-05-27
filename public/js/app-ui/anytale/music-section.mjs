/**
 * MusicSection – Music tab for the AnyTale editor.
 *
 * Provides genre management (CRUD), per-genre track sub-lists with generation,
 * and a fixed BGM player bar backed by globalBgmPlayer.
 *
 * @module app-ui/anytale/music-section
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { formButtonStates } from '../forms.mjs';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Checkbox } from '../../custom-ui/io/checkbox.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { MultiSelect } from '../../custom-ui/io/multi-select.mjs';
import { RangeSlider } from '../../custom-ui/io/range-slider.mjs';
import { Modal } from '../../custom-ui/overlays/modal.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { H2, VerticalLayout, HorizontalLayout, HorizontalEdgesLayout } from '../../custom-ui/themed-base.mjs';
import { globalBgmPlayer } from '../../custom-ui/global-audio-player.mjs';
import { queueSSEManager } from '../queue-sse-manager.mjs';
import { getClientId } from '../client-id.mjs';
import { useProgress } from '../../custom-ui/msg/progress-context.mjs';

// ============================================================================
// Constants
// ============================================================================

const MUSICAL_KEYS = [
  'C major', 'C# major', 'Db major', 'D major',
  'D# major', 'Eb major', 'E major', 'F major', 'F# major', 'Gb major',
  'G major', 'G# major', 'A major', 'A# major', 'Bb major', 'B major',
  'C minor', 'C# minor', 'Db minor', 'D minor',
  'D# minor', 'Eb minor', 'E minor', 'F minor', 'F# minor', 'Gb minor',
  'G minor', 'G# minor', 'A minor', 'A# minor', 'Bb minor', 'B minor'
];

// Numeric values expected by the AceStep workflow: 2=2/4, 3=3/4, 4=4/4, 6=6/8
const TIME_SIGNATURES = ['2', '3', '4', '6'];
const TIME_SIGNATURE_LABELS = ['2/4', '3/4', '4/4', '6/8'];
const TIME_SIGNATURE_MAP = { '2': '2/4', '3': '3/4', '4': '4/4', '6': '6/8' };

function formatTimeSignature(value) {
  return TIME_SIGNATURE_MAP[value] || value;
}

// ============================================================================
// API helpers
// ============================================================================

async function fetchGenres() {
  const res = await fetch('/anytale/genres');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiCreateGenre(data) {
  const res = await fetch('/anytale/genres', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiSaveGenre(uid, data) {
  const res = await fetch(`/anytale/genres/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiDeleteGenre(uid) {
  const res = await fetch(`/anytale/genres/${encodeURIComponent(uid)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function apiGenerateTrack(genreUid, genreOverrides) {
  const res = await fetch(`/anytale/genres/${encodeURIComponent(genreUid)}/generate-track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: getClientId(), genreOverrides }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============================================================================
// Helper functions
// ============================================================================

function csvToArray(str) {
  if (!str || !str.trim()) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function arrayToCsv(arr) {
  return Array.isArray(arr) ? arr.join(', ') : '';
}

function genreToEdit(genre) {
  return {
    name: genre.name || '',
    disabled: genre.disabled ?? false,
    musicPrompt: genre.musicPrompt || '',
    variationsStr: arrayToCsv(genre.variations),
    adjectivesStr: arrayToCsv(genre.adjectives),
    nounsStr: arrayToCsv(genre.nouns),
    keys: Array.isArray(genre.keys) ? [...genre.keys] : [],
    bpmMin: genre.bpmMin ?? 60,
    bpmMax: genre.bpmMax ?? 120,
    timeSignatures: Array.isArray(genre.timeSignatures) ? [...genre.timeSignatures] : [],
  };
}

function editToGenre(edit, genre) {
  return {
    ...genre,
    name: edit.name,
    disabled: edit.disabled ?? false,
    musicPrompt: edit.musicPrompt,
    variations: csvToArray(edit.variationsStr),
    adjectives: csvToArray(edit.adjectivesStr),
    nouns: csvToArray(edit.nounsStr),
    keys: edit.keys,
    bpmMin: edit.bpmMin,
    bpmMax: edit.bpmMax,
    timeSignatures: edit.timeSignatures,
  };
}

function makeEditKey(edit) {
  return JSON.stringify({
    name: edit.name,
    disabled: edit.disabled ?? false,
    musicPrompt: edit.musicPrompt,
    variationsStr: edit.variationsStr,
    adjectivesStr: edit.adjectivesStr,
    nounsStr: edit.nounsStr,
    keys: [...(edit.keys || [])].sort(),
    bpmMin: edit.bpmMin,
    bpmMax: edit.bpmMax,
    timeSignatures: [...(edit.timeSignatures || [])].sort(),
  });
}

// Stable key representing a completely blank genre edit — used as the baseline
// for newly-added local genres that have no server record yet.
const BLANK_GENRE_EDIT_KEY = makeEditKey({
  name: '',
  musicPrompt: '',
  variationsStr: '',
  adjectivesStr: '',
  nounsStr: '',
  keys: [],
  bpmMin: 60,
  bpmMax: 120,
  timeSignatures: [],
});

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============================================================================
// Styled Components
// ============================================================================

const ScrollArea = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow-y: auto;
  padding-right: ${() => currentTheme.value.spacing.small.padding};
`;
ScrollArea.className = 'music-scroll-area';

const GenreFormGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${() => currentTheme.value.spacing.medium.gap};
`;
GenreFormGrid.className = 'genre-form-grid';

const FullSpan = styled('div')`
  grid-column: 1 / -1;
`;
FullSpan.className = 'genre-full-span';

const StyledTextarea = styled('textarea')`
  width: 100%;
  resize: vertical;
  padding: ${() => currentTheme.value.spacing.small.padding};
  border-radius: 6px;
  border: 2px solid ${() => currentTheme.value.colors.border.primary};
  background-color: ${() => currentTheme.value.colors.background.tertiary};
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  transition: border-color 0.15s ease;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${() => currentTheme.value.colors.border.focus};
    border-color: ${() => currentTheme.value.colors.border.focus};
  }
`;
StyledTextarea.className = 'genre-textarea';

const TextareaLabel = styled('label')`
  margin-bottom: 5px;
  color: ${() => currentTheme.value.colors.text.secondary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  display: block;
`;
TextareaLabel.className = 'genre-textarea-label';

const TextareaGroup = styled('div')`
  display: flex;
  flex-direction: column;
`;
TextareaGroup.className = 'genre-textarea-group';

const TrackRowContent = styled('div')`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
`;
TrackRowContent.className = 'track-row-content';

const TrackName = styled('span')`
  font-family: ${() => currentTheme.value.typography.fontFamily};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  color: ${() => currentTheme.value.colors.text.primary};
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
TrackName.className = 'track-name';

const MetaChip = styled('span')`
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  padding: 2px 6px;
  border-radius: 4px;
  background-color: ${() => currentTheme.value.colors.background.secondary};
  color: ${() => currentTheme.value.colors.text.secondary};
  flex-shrink: 0;
  white-space: nowrap;
`;
MetaChip.className = 'track-meta-chip';

const ButtonRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
  flex: none;
`;
ButtonRow.className = 'music-button-row';

const BgmBar = styled('div')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.medium.gap};
  padding: ${() => currentTheme.value.spacing.medium.padding};
  background-color: ${() => currentTheme.value.colors.background.card};
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  border: 2px solid ${() => currentTheme.value.colors.border.secondary};
  flex: none;
`;
BgmBar.className = 'bgm-bar';

const BgmInfoArea = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
`;
BgmInfoArea.className = 'bgm-info-area';

const BgmTrackLabel = styled('div')`
  font-family: ${() => currentTheme.value.typography.fontFamily};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  color: ${() => currentTheme.value.colors.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
BgmTrackLabel.className = 'bgm-track-label';

const BgmSubLabel = styled('div')`
  font-family: ${() => currentTheme.value.typography.fontFamily};
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  color: ${() => currentTheme.value.colors.text.secondary};
`;
BgmSubLabel.className = 'bgm-sub-label';

const BgmControlsRow = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`;
BgmControlsRow.className = 'bgm-controls-row';

const BgmProgressBar = styled('div')`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: ${() => currentTheme.value.colors.border.primary};
  overflow: hidden;
  cursor: pointer;
`;
BgmProgressBar.className = 'bgm-progress-bar';

const BgmProgressFill = styled('div')`
  height: 100%;
  border-radius: 3px;
  background: ${() => currentTheme.value.colors.primary.background};
  transition: width 0.1s linear;
`;
BgmProgressFill.className = 'bgm-progress-fill';

const BgmTime = styled('span')`
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  color: ${() => currentTheme.value.colors.text.secondary};
  flex-shrink: 0;
  min-width: 72px;
  text-align: right;
  font-family: ${() => currentTheme.value.typography.fontFamily};
`;
BgmTime.className = 'bgm-time';

const NowPlayingBadge = styled('span')`
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  color: ${() => currentTheme.value.colors.primary.text};
  background: ${() => currentTheme.value.colors.primary.background};
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  opacity: 0.85;
`;
NowPlayingBadge.className = 'now-playing-badge';

const PlaylistItemRow = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
`;
PlaylistItemRow.className = 'playlist-item-row';

const PlaylistItemName = styled('span')`
  font-family: ${() => currentTheme.value.typography.fontFamily};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  color: ${() => currentTheme.value.colors.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
`;
PlaylistItemName.className = 'playlist-item-name';

const PlaylistRowItem = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: ${() => currentTheme.value.spacing.small.padding};
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  &:hover {
    background: ${() => currentTheme.value.colors.background.hover};
  }
`;
PlaylistRowItem.className = 'playlist-row-item';

const PlaylistScrollArea = styled('div')`
  max-height: 400px;
  overflow-y: auto;
`;
PlaylistScrollArea.className = 'playlist-scroll-area';

// ============================================================================
// BgmPlayerBar
// ============================================================================

function BgmPlayerBar({ onPlaylistOpen, genres }) {
  const [trackInfo, setTrackInfo] = useState(() => globalBgmPlayer.getCurrentTrack());
  const [playing, setPlaying] = useState(() => globalBgmPlayer.isPlaying());
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  // Subscribe to player events (track-start / stop / playlist-updated)
  useEffect(() => {
    return globalBgmPlayer.subscribe(({ event, url, label, index, total }) => {
      if (event === 'track-start') {
        setTrackInfo({ url, label, index, total });
        setPlaying(true);
        setProgress(0);
        setElapsed(0);
        setDuration(globalBgmPlayer.getDuration());
      } else if (event === 'stop') {
        setTrackInfo(null);
        setPlaying(false);
        setProgress(0);
        setElapsed(0);
        setDuration(0);
      } else if (event === 'playlist-updated') {
        setTrackInfo(prev => prev ? { ...prev, total } : prev);
      }
    });
  }, []);

  // Attach timeupdate listener to the active audio element
  useEffect(() => {
    if (!playing) return;
    const audio = globalBgmPlayer.getCurrentAudioElement();
    if (!audio) return;

    const onTimeUpdate = () => {
      setElapsed(globalBgmPlayer.getCurrentTime());
      setDuration(globalBgmPlayer.getDuration());
      setProgress(globalBgmPlayer.getProgress() * 100);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => audio.removeEventListener('timeupdate', onTimeUpdate);
  }, [playing, trackInfo]);

  const genreName = useMemo(() => {
    if (!trackInfo || !genres) return '';
    const genre = genres.find(g => g.tracks?.some(t => t.audioUrl === trackInfo.url));
    return genre?.name || '';
  }, [trackInfo, genres]);

  const handlePlayStop = useCallback(() => {
    if (playing) {
      globalBgmPlayer.stop();
    } else {
      globalBgmPlayer.play();
    }
  }, [playing]);

  const hasPlaylist = globalBgmPlayer._playlist.length > 0;

  return html`
    <${BgmBar}>
      <${BgmInfoArea}>
        <${BgmTrackLabel}>
          ${trackInfo ? trackInfo.label : 'No track playing'}
        </${BgmTrackLabel}>
        <${BgmSubLabel}>
          ${trackInfo
            ? `${genreName ? `${genreName} - ` : ''}${trackInfo.total} track${trackInfo.total !== 1 ? 's' : ''} queued`
            : 'BGM Player'}
        </${BgmSubLabel}>
      </${BgmInfoArea}>
      <${BgmControlsRow}>
        <${Button}
          variant="small-icon"
          icon=${playing ? 'stop' : 'play'}
          onClick=${handlePlayStop}
          disabled=${!playing && !hasPlaylist}
          tooltip=${playing ? 'Stop' : 'Play'}
        />
        <${BgmProgressBar}>
          <${BgmProgressFill} style=${{ width: `${progress}%` }} />
        </${BgmProgressBar}>
        <${BgmTime}>${formatTime(elapsed)} / ${formatTime(duration)}</${BgmTime}>
      </${BgmControlsRow}>
      <${Button}
        variant="small-icon"
        icon="arrow-out-up-right-square"
        tooltip="Manage playlist"
        onClick=${onPlaylistOpen}
      />
    </${BgmBar}>
  `;
}

// ============================================================================
// PlaylistModal
// ============================================================================

function PlaylistModal({ isOpen, onClose, genres }) {
  const [items, setItems] = useState([]);

  const syncItems = useCallback(() => setItems([...globalBgmPlayer._playlist]), []);

  // Sync from player and subscribe when open
  useEffect(() => {
    if (!isOpen) return;
    syncItems();
    return globalBgmPlayer.subscribe(() => syncItems());
  }, [isOpen, syncItems]);

  const getTrackLabel = useCallback((item) => {
    if (item.label) return item.label;
    const genre = genres?.find(g => g.tracks?.some(t => t.audioUrl === item.url));
    const track = genre?.tracks?.find(t => t.audioUrl === item.url);
    const trackName = track?.name || decodeURIComponent(item.url.split('/').pop().replace(/\.[^.]+$/, ''));
    return genre ? `${trackName} - ${genre.name}` : trackName;
  }, [genres]);

  // Skips track at index 0 (currently playing) via skipCurrent(); removes others directly
  const handleDelete = useCallback((index) => {
    if (index === 0) {
      globalBgmPlayer.skipCurrent();
    } else {
      globalBgmPlayer._playlist.splice(index, 1);
      syncItems();
    }
  }, [syncItems]);

  return html`
    <${Modal}
      isOpen=${isOpen}
      onClose=${onClose}
      title="BGM Queue"
      size="medium"
      minWidth="500px"
      hideCloseButton=${true}
      footer=${html`
        <${Button} variant="medium-text" color="secondary" onClick=${onClose}>Close</${Button}>
      `}
    >
      <${PlaylistScrollArea}>
        ${items.length === 0
          ? html`<div style=${{ color: currentTheme.value.colors.text.secondary, padding: '16px 0' }}>Queue is empty.</div>`
          : items.map((item, index) => html`
            <${PlaylistRowItem} key=${index}>
              <${PlaylistItemName}>${getTrackLabel(item)}</${PlaylistItemName}>
              ${index === 0 ? html`<${NowPlayingBadge}>Playing</${NowPlayingBadge}>` : null}
              <${Button}
                variant="small-icon"
                icon="x"
                color="danger"
                onClick=${() => handleDelete(index)}
                tooltip=${index === 0 ? 'Skip track' : 'Remove from queue'}
              />
            </${PlaylistRowItem}>
          `)
        }
      </${PlaylistScrollArea}>
    </${Modal}>
  `;
}

// ============================================================================
// GenreCard
// ============================================================================

function GenreCard({ genre, onSaved, onGenerateTrack, onTrackPlay, onDirtyChange }) {
  const [edit, setEdit] = useState(() => genreToEdit(genre));
  const [sliderKey, setSliderKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const recorded = !!genre.uid;
  const genreId = genre.uid || genre._localId;
  const savedKey = useMemo(
    () => recorded ? makeEditKey(genreToEdit(genre)) : BLANK_GENRE_EDIT_KEY,
    [genre, recorded]
  );
  const dirty = makeEditKey(edit) !== savedKey;
  const { saveLabel, saveEnabled, revertEnabled } = formButtonStates(recorded, dirty);

  const prevDirtyRef = useRef(dirty);
  useEffect(() => {
    if (prevDirtyRef.current !== dirty) {
      prevDirtyRef.current = dirty;
      onDirtyChange?.(genreId, dirty);
    }
  });

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      let saved;
      if (genre.uid) {
        const data = editToGenre(edit, genre);
        const result = await apiSaveGenre(genre.uid, data);
        saved = result.saved;
      } else {
        const data = editToGenre(edit, { ...genre, tracks: [] });
        const result = await apiCreateGenre(data);
        saved = result.saved;
      }
      onSaved(saved, genreId);
      setSliderKey(k => k + 1);
    } catch (err) {
      console.error('[GenreCard] Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [edit, genre, genreId, onSaved]);

  const handleRevert = useCallback(async () => {
    const result = await showDialog(
      'Discard all unsaved changes to this genre?',
      'Revert Genre',
      ['Revert', 'Cancel']
    );
    if (result !== 'Revert') return;
    setEdit(recorded ? genreToEdit(genre) : {
      name: '', musicPrompt: '', variationsStr: '', adjectivesStr: '',
      nounsStr: '', keys: [], bpmMin: 60, bpmMax: 120, timeSignatures: [],
    });
    setSliderKey(k => k + 1);
  }, [genre, recorded]);

  const handleTrackListChange = useCallback(async (newTracks) => {
    if (!genre.uid) return;
    try {
      const data = { ...editToGenre(edit, genre), tracks: newTracks };
      const result = await apiSaveGenre(genre.uid, data);
      onSaved(result.saved, genre.uid);
    } catch (err) {
      console.error('[GenreCard] Track list update failed:', err);
    }
  }, [edit, genre, onSaved]);

  const trackHeaderActions = useMemo(() => [{
    icon: 'play',
    title: 'Add to BGM playlist and play',
    onClick: (track) => onTrackPlay(track),
  }], [onTrackPlay]);

  return html`
    <${VerticalLayout} gap="medium">
      <${GenreFormGrid}>
        <${FullSpan}>
          <${Checkbox}
            label="Hidden from AnyTale Play"
            checked=${!!edit.disabled}
            onChange=${() => setEdit(p => ({ ...p, disabled: !p.disabled }))}
          />
        </${FullSpan}>
        <${FullSpan}>
          <${Input}
            label="Genre Name"
            value=${edit.name}
            onInput=${(e) => setEdit(p => ({ ...p, name: e.target.value }))}
            widthScale="full"
          />
        </${FullSpan}>
        <${FullSpan}>
          <${TextareaGroup}>
            <${TextareaLabel}>Music Prompt</${TextareaLabel}>
            <${StyledTextarea}
              rows="3"
              value=${edit.musicPrompt}
              onInput=${(e) => setEdit(p => ({ ...p, musicPrompt: e.target.value }))}
              placeholder="e.g. Calm {{variation}} ambient music, atmospheric, soothing"
            />
          </${TextareaGroup}>
        </${FullSpan}>
        <${FullSpan}>
          <${TextareaGroup}>
            <${TextareaLabel}>Variations (comma-separated)</${TextareaLabel}>
            <${StyledTextarea}
              rows="2"
              value=${edit.variationsStr}
              onInput=${(e) => setEdit(p => ({ ...p, variationsStr: e.target.value }))}
              placeholder="e.g. forest, ocean, rain"
            />
          </${TextareaGroup}>
        </${FullSpan}>
        <${FullSpan}>
          <${TextareaGroup}>
            <${TextareaLabel}>Adjectives (comma-separated)</${TextareaLabel}>
            <${StyledTextarea}
              rows="2"
              value=${edit.adjectivesStr}
              onInput=${(e) => setEdit(p => ({ ...p, adjectivesStr: e.target.value }))}
              placeholder="e.g. Serene, Mystic, Gentle"
            />
          </${TextareaGroup}>
        </${FullSpan}>
        <${FullSpan}>
          <${TextareaGroup}>
            <${TextareaLabel}>Nouns (comma-separated)</${TextareaLabel}>
            <${StyledTextarea}
              rows="2"
              value=${edit.nounsStr}
              onInput=${(e) => setEdit(p => ({ ...p, nounsStr: e.target.value }))}
              placeholder="e.g. Drift, Current, Whisper"
            />
          </${TextareaGroup}>
        </${FullSpan}>
        <${FullSpan}>
          <${RangeSlider}
            key=${sliderKey}
            label="BPM Range"
            minAllowed=${40}
            maxAllowed=${240}
            min=${edit.bpmMin}
            max=${edit.bpmMax}
            snap=${1}
            widthScale="full"
            onChange=${({ min, max }) => setEdit(p => ({ ...p, bpmMin: min, bpmMax: max }))}
          />
        </${FullSpan}>
        <${FullSpan}>
          <${MultiSelect}
            label="Keys"
            options=${MUSICAL_KEYS}
            value=${edit.keys}
            onChange=${(keys) => setEdit(p => ({ ...p, keys }))}
            widthScale="full"
          />
        </${FullSpan}>
        <${FullSpan}>
          <${MultiSelect}
            label="Time Signatures"
            options=${TIME_SIGNATURES}
            optionLabels=${TIME_SIGNATURE_LABELS}
            value=${edit.timeSignatures}
            onChange=${(timeSignatures) => setEdit(p => ({ ...p, timeSignatures }))}
            widthScale="full"
          />
        </${FullSpan}>
      </${GenreFormGrid}>

      <${HorizontalLayout} justifyContent="flex-end">
        <${ButtonRow}>
          <${Button}
            variant="small-text"
            color="primary"
            icon="save"
            disabled=${!saveEnabled || saving}
            loading=${saving}
            onClick=${handleSave}
          >
            ${saveLabel}
          <//>
          <${Button}
            variant="small-text"
            color="secondary"
            icon="undo"
            disabled=${!revertEnabled}
            onClick=${handleRevert}
          >
            Revert
          <//>
        </${ButtonRow}>
      </${HorizontalLayout}>

      <${HorizontalEdgesLayout}>
        <${H2}>Tracks</${H2}>
      </${HorizontalEdgesLayout}>

      <div>
      <${Button}
        variant="small-text"
        color="primary"
        icon="music"
        disabled=${!genre.uid}
        onClick=${() => onGenerateTrack(genre.uid, editToGenre(edit, genre))}
      >
        Generate Track
      <//>
      </div>

      <${PlaylistScrollArea}>
        <${DynamicList}
          condensed=${true}
          items=${genre.tracks || []}
          renderItem=${(track) => html`
            <${TrackRowContent}>
              <${TrackName}>${track.name}</${TrackName}>
              ${track.key ? html`<${MetaChip}>${track.key}</${MetaChip}>` : null}
              ${track.bpm ? html`<${MetaChip}>${track.bpm} BPM</${MetaChip}>` : null}
              ${track.timeSignature ? html`<${MetaChip}>${formatTimeSignature(track.timeSignature)}</${MetaChip}>` : null}
            </${TrackRowContent}>
          `}
          headerActions=${trackHeaderActions}
          createItem=${() => null}
          onChange=${handleTrackListChange}
          showDragButton=${false}
          hideAddItem=${true}
          deleteIcon="trash"
        />
      </${PlaylistScrollArea}>
    </${VerticalLayout}>
  `;
}

// ============================================================================
// MusicSection
// ============================================================================

/**
 * MusicSection – Music tab content for the AnyTale editor.
 *
 * Manages genres and tracks, handles SSE-based track generation progress,
 * and renders the BGM player bar.
 */
export function MusicSection() {
  const { show: progressShow, activeTasks } = useProgress();
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingFor, setGeneratingFor] = useState(new Set());
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [dirtyUids, setDirtyUids] = useState(new Set());

  useEffect(() => {
    fetchGenres()
      .then(data => { if (Array.isArray(data)) setGenres(data); })
      .catch(err => console.error('[MusicSection] Load genres failed:', err))
      .finally(() => setLoading(false));
  }, []);

  // SSE subscription for anytale-music tasks
  useEffect(() => {
    return queueSSEManager.subscribe({
      'queue:task-started': ({ taskId, source, endpointKey, taskData, clientId }) => {
        if (source !== 'anytale' || endpointKey !== 'anytale-music') return;
        if (clientId !== getClientId()) return;

        const genreUid = taskData?.genreUid;
        if (genreUid) setGeneratingFor(prev => new Set([...prev, genreUid]));

        const clearGenerating = () => {
          if (genreUid) setGeneratingFor(prev => { const s = new Set(prev); s.delete(genreUid); return s; });
        };

        progressShow(taskId, {
          entityType: 'anytale-music',
          defaultTitle: 'Generating track…',
          onComplete: async (data) => {
            clearGenerating();
            try {
              const updated = await fetchGenres();
              if (Array.isArray(updated)) setGenres(updated);
              if (data?.result?.audioUrl) {
                const genreName = updated?.find(g => g.uid === data.result.genreUid)?.name || '';
                const trackName = data.result.name || '';
                const label = genreName ? `${trackName} - ${genreName}` : trackName;
                globalBgmPlayer.appendToPlaylist({ url: data.result.audioUrl, label });
              }
            } catch (err) {
              console.error('[MusicSection] Failed to refresh genres after generation:', err);
            }
          },
          onCancelled: clearGenerating,
          onError: clearGenerating,
          onDismiss: clearGenerating,
        });
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect-resume: re-register banners for any anytale-music tasks already in flight
  // (handles tab switches and cases where task-started fired before this component mounted)
  useEffect(() => {
    const musicTasks = activeTasks.filter(t => t.entityType === 'anytale-music');
    musicTasks.forEach(({ taskId }) => {
      progressShow(taskId, {
        entityType: 'anytale-music',
        defaultTitle: 'Generating track…',
        onComplete: async (data) => {
          try {
            const updated = await fetchGenres();
            if (Array.isArray(updated)) setGenres(updated);
            if (data?.result?.audioUrl) {
              const genreName = updated?.find(g => g.uid === data.result.genreUid)?.name || '';
              const trackName = data.result.name || '';
              const label = genreName ? `${trackName} - ${genreName}` : trackName;
              globalBgmPlayer.appendToPlaylist({ url: data.result.audioUrl, label });
            }
          } catch (err) {
            console.error('[MusicSection] Failed to refresh genres after generation:', err);
          }
        },
      });
    });
  }, [activeTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenreAdd = useCallback(() => {
    const localGenre = {
      _localId: String(Date.now()),
      name: 'New Genre',
      musicPrompt: '',
      variations: [],
      adjectives: [],
      nouns: [],
      keys: [],
      bpmMin: 60,
      bpmMax: 120,
      timeSignatures: [],
      tracks: [],
    };
    setGenres(prev => [...prev, localGenre]);
  }, []);

  const handleGenreSaved = useCallback((savedGenre, idOrLocalId) => {
    setGenres(prev => prev.map(g =>
      (g.uid === idOrLocalId || g._localId === idOrLocalId) ? savedGenre : g
    ));
    setDirtyUids(prev => { const s = new Set(prev); s.delete(idOrLocalId); return s; });
  }, []);

  const handleGenreDeleted = useCallback((id) => {
    setGenres(prev => prev.filter(g => (g.uid || g._localId) !== id));
    setDirtyUids(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const handleDirtyChange = useCallback((id, isDirty) => {
    setDirtyUids(prev => {
      const s = new Set(prev);
      isDirty ? s.add(id) : s.delete(id);
      return s;
    });
  }, []);

  const handleGenreDeleteFromHeader = useCallback(async (genre) => {
    const genreId = genre.uid || genre._localId;
    if (!genre.uid) {
      handleGenreDeleted(genreId);
      return;
    }
    const result = await showDialog(
      `Delete "${genre.name || 'this genre'}" and all its tracks? This cannot be undone.`,
      'Delete Genre',
      ['Delete', 'Cancel']
    );
    if (result !== 'Delete') return;
    try {
      await apiDeleteGenre(genre.uid);
      handleGenreDeleted(genreId);
    } catch (err) {
      console.error('[MusicSection] Delete genre failed:', err);
    }
  }, [handleGenreDeleted]);

  const handleGenresChange = useCallback((newGenres) => {
    setGenres(newGenres);
  }, []);

  const handleGenerateTrack = useCallback(async (genreUid, genreOverrides) => {
    try {
      await apiGenerateTrack(genreUid, genreOverrides);
    } catch (err) {
      console.error('[MusicSection] Generate track failed:', err);
    }
  }, []);

  const handleTrackPlay = useCallback((track) => {
    const genre = genres.find(g => g.tracks?.some(t => t.audioUrl === track.audioUrl));
    const label = genre ? `${track.name} - ${genre.name}` : track.name;
    globalBgmPlayer.appendToPlaylist({ url: track.audioUrl, label });
  }, [genres]);

  return html`
    <div style=${{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', overflow: 'hidden', gap: currentTheme.value.spacing.medium.gap }}>
      <${ScrollArea}>
        ${loading ? html`<div style=${{ color: currentTheme.value.colors.text.secondary }}>Loading genres…</div>` : null}
        <${DynamicList}
          title="Genres"
          items=${genres}
          getTitle=${(genre) => `${genre.name || 'Unnamed Genre'}${dirtyUids.has(genre.uid || genre._localId) ? ' *' : ''}`}
          renderItem=${(genre) => html`
            <${GenreCard}
              genre=${genre}
              onSaved=${handleGenreSaved}
              onGenerateTrack=${handleGenerateTrack}
              onTrackPlay=${handleTrackPlay}
              onDirtyChange=${handleDirtyChange}
            />
          `}
          createItem=${() => null}
          onAdd=${handleGenreAdd}
          onChange=${handleGenresChange}
          onDelete=${handleGenreDeleteFromHeader}
          addLabel="Add Genre"
          showDragButton=${false}
        />
      </${ScrollArea}>
      <${BgmPlayerBar}
        onPlaylistOpen=${() => setPlaylistOpen(true)}
        genres=${genres}
      />
      <${PlaylistModal}
        isOpen=${playlistOpen}
        onClose=${() => setPlaylistOpen(false)}
        genres=${genres}
      />
    </div>
  `;
}
