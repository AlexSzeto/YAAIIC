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
import { DiscreteSlider } from '../../custom-ui/io/discrete-slider.mjs';

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
  const handleLabelChange = useCallback((e) => {
    onChange({ ...item, label: e.target.value });
  }, [item, onChange]);

  const handleDistanceChange = useCallback((e) => {
    onChange({ ...item, distance: e.target.value });
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
        </${HorizontalLayout}>
        <${HorizontalLayout} gap="small">
          <${ToggleSwitch}
            label="On"
            checked=${enabled}
            onChange=${(e) => onEnabledChange?.(e.target.checked)}
          />
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
          <${DiscreteSlider}
            label="Distance"
            id="channel-distance"
            value=${item.distance || 'medium'}
            widthScale="wide"
            options=${DISTANCE_OPTIONS}
            onChange=${handleDistanceChange}
          />
        </${HorizontalLayout}>
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
