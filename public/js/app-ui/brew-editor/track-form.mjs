/**
 * track-form.mjs – Sub-form for editing a single ambient track within a channel.
 *
 * Props: { item, onChange, sourceLabels }
 * Calls onChange(updatedItem) on every field edit.
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { Input } from '../../custom-ui/io/input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { ToggleSwitch } from '../../custom-ui/io/toggle-switch.mjs';
import { RangeSlider } from '../../custom-ui/io/range-slider.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { VerticalLayout } from '../../custom-ui/themed-base.mjs';

const TYPE_OPTIONS = [
  { label: 'Event', value: 'event' },
  { label: 'Loop', value: 'loop' },
];

/**
 * TrackForm – Fields for a single track entry within a channel.
 *
 * @param {Object}   props
 * @param {Object}   props.item         - The track object
 * @param {Function} props.onChange     - Called with updated track object
 * @param {string[]} props.sourceLabels - Source labels available in the current brew
 */
export function TrackForm({ item, onChange, sourceLabels = [] }) {
  const sourceOptions = sourceLabels.map(l => ({ label: l, value: l }));

  const handleLabelChange = useCallback((e) => {
    onChange({ ...item, label: e.target.value });
  }, [item, onChange]);

  const handleTypeChange = useCallback((e) => {
    const type = e.target.value;
    // Provide sensible defaults when switching type
    if (type === 'event') {
      onChange({
        ...item,
        type,
        sources: item.sources || [],
        delay: item.delay || { min: 0, max: 5 },
        delayAfterPrev: item.delayAfterPrev ?? false,
        // Remove loop-only fields
        source: undefined,
        duration: undefined,
      });
    } else {
      onChange({
        ...item,
        type,
        source: item.source || (sourceLabels[0] ?? ''),
        duration: item.duration || { min: 0, max: 30 },
        // Remove event-only fields
        sources: undefined,
        delay: undefined,
        delayAfterPrev: undefined,
      });
    }
  }, [item, onChange, sourceLabels]);

  const handleClonesChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    onChange({ ...item, clones: isNaN(val) ? 1 : Math.max(1, val) });
  }, [item, onChange]);

  // --- Event-type handlers ---

  const handleSourcesChange = useCallback((sources) => {
    onChange({ ...item, sources });
  }, [item, onChange]);

  const renderSourceSelect = useCallback((sourceValue, index) => {
    return html`
      <${Select}
        value=${sourceValue}
        options=${sourceOptions.length ? sourceOptions : [{ label: '(no sources)', value: '' }]}
        widthScale="full"
        heightScale="compact"
        onChange=${(e) => {
          const next = [...(item.sources || [])];
          next[index] = e.target.value;
          onChange({ ...item, sources: next });
        }}
      />
    `;
  }, [item, onChange, sourceOptions]);

  // --- Loop-type handlers ---

  const handleSourceChange = useCallback((e) => {
    onChange({ ...item, source: e.target.value });
  }, [item, onChange]);

  const delay = item.delay || { min: 0, max: 5 };
  const duration = item.duration || { min: 0, max: 30 };

  return html`
    <${VerticalLayout} gap="medium">
      <${Input}
        label="Label"
        value=${item.label || ''}
        widthScale="full"
        onInput=${handleLabelChange}
        placeholder="Track name"
      />

      <${Select}
        label="Type"
        id="track-type"
        value=${item.type || 'event'}
        options=${TYPE_OPTIONS}
        widthScale="full"
        onChange=${handleTypeChange}
      />

      <${Input}
        label="Clones"
        type="number"
        value=${item.clones ?? 1}
        widthScale="normal"
        onInput=${handleClonesChange}
      />

      ${item.type === 'loop' ? html`
        <${Select}
          label="Source"
          id="track-source"
          value=${item.source || ''}
          options=${sourceOptions.length ? sourceOptions : [{ label: '(no sources)', value: '' }]}
          widthScale="full"
          onChange=${handleSourceChange}
        />

        <${RangeSlider}
          label="Duration (s)"
          minAllowed=${0}
          maxAllowed=${120}
          snap=${0.1}
          min=${duration.min}
          max=${duration.max}
          width="100%"
          onChange=${({ min, max }) => onChange({ ...item, duration: { min, max } })}
        />
      ` : html`
        <${DynamicList}
          title="Sources"
          items=${item.sources || []}
          renderItem=${renderSourceSelect}
          getTitle=${(s) => s || 'Source'}
          createItem=${() => sourceLabels[0] ?? ''}
          onChange=${handleSourcesChange}
          addLabel="Add Source"
          condensed=${true}
        />

        <${RangeSlider}
          label="Delay (s)"
          minAllowed=${0}
          maxAllowed=${120}
          snap=${0.1}
          min=${delay.min}
          max=${delay.max}
          width="100%"
          onChange=${({ min, max }) => onChange({ ...item, delay: { min, max } })}
        />

        <${ToggleSwitch}
          label="Delay After Previous"
          checked=${item.delayAfterPrev ?? false}
          onChange=${(e) => onChange({ ...item, delayAfterPrev: e.target.checked })}
        />
      `}
    </${VerticalLayout}>
  `;
}
