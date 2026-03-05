/**
 * channel-form.mjs – Sub-form for editing a single ambient channel.
 *
 * Props: { item, onChange, sourceLabels, sources, sourceLengths, enabled, onEnabledChange, onSolo }
 * Calls onChange(updatedItem) on every field edit.
 * Calls onEnabledChange(boolean) when the on/off toggle is flipped.
 * Calls onSolo() when the Solo button is clicked.
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { Input } from '../../custom-ui/io/input.mjs';

import { ToggleSwitch } from '../../custom-ui/io/toggle-switch.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { VerticalLayout, HorizontalLayout } from '../../custom-ui/themed-base.mjs';
import { TrackForm } from './track-form.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { RangeSlider } from '../../custom-ui/io/range-slider.mjs';

const DISTANCE_TO_GAIN = {
  'very-far': { min: 0.1,  max: 0.1  },
  'far':      { min: 0.25, max: 0.25 },
  'medium':   { min: 0.5,  max: 0.5  },
  'close':    { min: 0.75, max: 0.75 },
};

const MUFFLE_OPTIONS = [
  { label: 'Off',          value: '' },
  { label: 'Glass Window', value: 'glass-window' },
  { label: 'Thick Wall',   value: 'thick-wall' },
  { label: 'Outside Car',  value: 'outside-car' },
];

const REVERB_OPTIONS = [
  { label: 'Off',        value: '' },
  { label: 'Small Room', value: 'small-room' },
  { label: 'Church',     value: 'church' },
  { label: 'Opera Hall', value: 'opera-hall' },
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
 * ChannelForm – Fields for a single channel entry.
 *
 * @param {Object}   props
 * @param {Object}   props.item             - The channel object
 * @param {Function} props.onChange         - Called with updated channel object
 * @param {string[]} props.sourceLabels     - Source labels available in the current brew
 * @param {Object}   [props.sourceLengths]  - Map of source label → effective length (s)
 * @param {boolean}  [props.enabled]        - Runtime enabled state (default true)
 * @param {Function} [props.onEnabledChange] - Called with new boolean when toggle is flipped
 * @param {Function} [props.onSolo]         - Called when Solo button is clicked
 */
export function ChannelForm({ item, onChange, sourceLabels = [], sourceLengths = {}, enabled = true, onEnabledChange, onSolo }) {
  // Backward compat: derive gain from item.gain, falling back to item.distance string
  const gain = item.gain ?? (item.distance ? DISTANCE_TO_GAIN[item.distance] : null) ?? { min: 0.5, max: 0.5 };

  const handleLabelChange = useCallback((e) => {
    onChange({ ...item, label: e.target.value });
  }, [item, onChange]);

  const handleTracksChange = useCallback((tracks) => {
    onChange({ ...item, tracks });
  }, [item, onChange]);

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

  return html`
    <${VerticalLayout} gap="medium">

      <${VerticalLayout} gap="small">
        <${HorizontalLayout} gap="small">
          <${Button}
            variant="small-icon-text"
            icon="headphone"
            color="secondary"
            onClick=${() => onSolo?.()}
          >
            Solo
          </${Button}>
          <${ToggleSwitch}
            label="On"
            checked=${enabled}
            onChange=${(e) => onEnabledChange?.(e.target.checked)}
          />
        </${HorizontalLayout}>
        <${HorizontalLayout} gap="small">
          <${Select}
            label="Muffle"
            id="channel-muffle"
            value=${item.muffle ?? ''}
            options=${MUFFLE_OPTIONS}
            onChange=${(e) => onChange({ ...item, muffle: e.target.value || null })}
          />
          <${Select}
            label="Reverb"
            id="channel-reverb"
            value=${item.reverb ?? ''}
            options=${REVERB_OPTIONS}
            onChange=${(e) => onChange({ ...item, reverb: e.target.value || null })}
          />
        </${HorizontalLayout}>
        <${RangeSlider}
          label="Gain"
          minAllowed=${0}
          maxAllowed=${1}
          snap=${0.01}
          min=${gain.min}
          max=${gain.max}
          widthScale="full"
          onChange=${({ min, max }) => onChange({ ...item, gain: { min, max } })}
        />
      </${VerticalLayout}>

      <${HorizontalLayout} gap="small">
        <${Input}
          label="Label"
          value=${item.label || ''}
          onInput=${handleLabelChange}
          placeholder="Channel name"
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

    </${VerticalLayout}>
  `;
}
