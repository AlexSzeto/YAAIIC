/**
 * channel-form.mjs – Sub-form for editing a single ambient channel.
 *
 * Props: { item, onChange, sourceLabels }
 * Calls onChange(updatedItem) on every field edit.
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { Input } from '../../custom-ui/io/input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { ToggleSwitch } from '../../custom-ui/io/toggle-switch.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { VerticalLayout } from '../../custom-ui/themed-base.mjs';
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
    delay: { min: 0, max: 5 },
    delayAfterPrev: false,
  };
}

/**
 * ChannelForm – Fields for a single channel entry.
 *
 * @param {Object}   props
 * @param {Object}   props.item         - The channel object
 * @param {Function} props.onChange     - Called with updated channel object
 * @param {string[]} props.sourceLabels - Source labels available in the current brew
 */
export function ChannelForm({ item, onChange, sourceLabels = [] }) {
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
        onChange=${(updated) => {
          const next = [...(item.tracks || [])];
          next[index] = updated;
          onChange({ ...item, tracks: next });
        }}
      />
    `;
  }, [item, onChange, sourceLabels]);

  const tracks = item.tracks || [];

  return html`
    <${VerticalLayout} gap="medium">
      <${Input}
        label="Label"
        value=${item.label || ''}
        widthScale="full"
        onInput=${handleLabelChange}
        placeholder="Channel name"
      />

      <${Select}
        label="Distance"
        id="channel-distance"
        value=${item.distance || 'medium'}
        options=${DISTANCE_OPTIONS}
        widthScale="full"
        onChange=${handleDistanceChange}
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
