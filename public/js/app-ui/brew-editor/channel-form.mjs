/**
 * channel-form.mjs – Sub-form for editing a single ambient channel.
 *
 * Props: { item, onChange, sourceLabels, sources, sourceLengths, onPreview, isPlaying, onStop }
 * Calls onChange(updatedItem) on every field edit.
 * Calls onPreview(tempBrew) to preview just this channel with all brew sources.
 * Calls onStop() to stop playback.
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { Input } from '../../custom-ui/io/input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { ToggleSwitch } from '../../custom-ui/io/toggle-switch.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { VerticalLayout, HorizontalLayout } from '../../custom-ui/themed-base.mjs';
import { TrackForm } from './track-form.mjs';

const DISTANCE_OPTIONS = [
  { label: 'Very Far', value: 'very-far' },
  { label: 'Far', value: 'far' },
  { label: 'Medium', value: 'medium' },
  { label: 'Close', value: 'close' },
];

/** Default factory for a new track item. */
function createTrack() {
  return {
    label: 'Track',
    type: 'event',
    clones: 1,
    sources: [],
    delay: { min: 0.1, max: 5 },
    delayAfterPrev: false,
  };
}

/**
 * Returns true if a track has at least one valid (non-empty) source assigned.
 * @param {Object} track
 * @returns {boolean}
 */
function trackHasSource(track) {
  if (track.type === 'loop') return Boolean(track.source);
  return Array.isArray(track.sources) && track.sources.some(s => Boolean(s));
}

/**
 * ChannelForm – Fields for a single channel entry.
 *
 * @param {Object}   props
 * @param {Object}   props.item           - The channel object
 * @param {Function} props.onChange       - Called with updated channel object
 * @param {string[]} props.sourceLabels   - Source labels available in the current brew
 * @param {Object[]} [props.sources]      - Full source objects for preview (all brew sources)
 * @param {Object}   [props.sourceLengths] - Map of source label → effective length (s)
 * @param {Function} [props.onPreview]    - Called with a temp brew to preview this channel
 * @param {boolean}  [props.isPlaying]    - Whether audio is currently playing globally
 * @param {Function} [props.onStop]       - Called to stop playback
 */
export function ChannelForm({ item, onChange, sourceLabels = [], sources = [], sourceLengths = {}, onPreview, isPlaying, onStop }) {
  const handleLabelChange = useCallback((e) => {
    onChange({ ...item, label: e.target.value });
  }, [item, onChange]);

  const handleDistanceChange = useCallback((e) => {
    onChange({ ...item, distance: e.target.value });
  }, [item, onChange]);

  const handleTracksChange = useCallback((tracks) => {
    onChange({ ...item, tracks });
  }, [item, onChange]);

  const handleChannelPreview = useCallback(() => {
    if (!onPreview) return;
    const tempBrew = {
      label: 'Preview',
      sources,
      channels: [item],
    };
    onPreview(tempBrew);
  }, [item, sources, onPreview]);

  const renderTrack = useCallback((track, index) => {
    return html`
      <${TrackForm}
        item=${track}
        sourceLabels=${sourceLabels}
        sourceLengths=${sourceLengths}
        onChange=${(updated) => {
          const next = [...(item.tracks || [])];
          next[index] = updated;
          // Auto-update channel label when a track label is set and channel label is still default
          const trackLabelChanged = updated.label && updated.label !== track.label;
          const channelLabelIsDefault = !item.label || item.label === 'Channel';
          if (trackLabelChanged && channelLabelIsDefault) {
            onChange({ ...item, label: updated.label, tracks: next });
          } else {
            onChange({ ...item, tracks: next });
          }
        }}
      />
    `;
  }, [item, onChange, sourceLabels, sourceLengths]);

  const tracks = item.tracks || [];

  // Disable channel preview if there are no tracks or any track lacks a source
  const previewDisabled = tracks.length === 0 || tracks.some(t => !trackHasSource(t));

  return html`
    <${VerticalLayout} gap="medium">

      <${HorizontalLayout} gap="small" style=${{ alignItems: 'flex-end' }}>
        <${Input}
          label="Label"
          value=${item.label || ''}
          onInput=${handleLabelChange}
          placeholder="Channel name"
        />
        <${Select}
          label="Distance"
          id="channel-distance"
          value=${item.distance || 'medium'}
          options=${DISTANCE_OPTIONS}
          onChange=${handleDistanceChange}
        />
      </${HorizontalLayout}>

      <${HorizontalLayout} gap="small">
        <${ToggleSwitch}
          label="Muffled"
          checked=${item.muffled ?? false}
          onChange=${(e) => onChange({ ...item, muffled: e.target.checked })}
        />
        <${ToggleSwitch}
          label="Reverb"
          checked=${item.reverb ?? false}
          onChange=${(e) => onChange({ ...item, reverb: e.target.checked })}
        />
      </${HorizontalLayout}>

      <${DynamicList}
        title="Tracks"
        items=${tracks}
        renderItem=${renderTrack}
        getTitle=${(track) => track.label || 'Track'}
        createItem=${createTrack}
        onChange=${handleTracksChange}
        addLabel="Add Track"
      />

      ${onPreview ? html`
        <${HorizontalLayout} gap="small">
          <${Button}
            variant="medium-icon-text"
            icon=${isPlaying ? 'stop' : 'play'}
            color=${isPlaying ? 'secondary' : 'primary'}
            disabled=${!isPlaying && previewDisabled}
            onClick=${isPlaying ? onStop : handleChannelPreview}
          >
            ${isPlaying ? 'Stop' : 'Preview'}
          </${Button}>
        </${HorizontalLayout}>
      ` : null}
    </${VerticalLayout}>
  `;
}
