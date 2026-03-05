/**
 * track-form.mjs – Sub-form for editing a single ambient track within a channel.
 *
 * Props: { item, onChange, sourceLabels, sourceLengths }
 * Calls onChange(updatedItem) on every field edit.
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { Input } from '../../custom-ui/io/input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { ToggleSwitch } from '../../custom-ui/io/toggle-switch.mjs';
import { RangeSlider } from '../../custom-ui/io/range-slider.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { VerticalLayout, HorizontalLayout } from '../../custom-ui/themed-base.mjs';

const TYPE_OPTIONS = [
  { label: 'Event', value: 'event' },
  { label: 'Loop', value: 'loop' },
];

/** Static fallback maxima when no source length data is available. */
const DEFAULT_DELAY_MAX = 120;
const DEFAULT_DURATION_MAX = 120;

/**
 * TrackForm – Fields for a single track entry within a channel.
 *
 * @param {Object}   props
 * @param {Object}   props.item           - The track object
 * @param {Function} props.onChange       - Called with updated track object
 * @param {string[]} props.sourceLabels   - Source labels available in the current brew
 * @param {Object}   [props.sourceLengths] - Map of source label → effective length (s)
 */
export function TrackForm({ item, onChange, sourceLabels = [], sourceLengths = {} }) {
  // Build options with effective length annotation when available
  const sourceOptions = sourceLabels.map(l => ({
    label: sourceLengths[l] != null ? `${l} (${sourceLengths[l]}s)` : l,
    value: l,
  }));

  const handleLabelChange = useCallback((e) => {
    onChange({ ...item, label: e.target.value });
  }, [item, onChange]);

  const handleTypeChange = useCallback((e) => {
    const type = e.target.value;
    if (type === 'event') {
      onChange({
        ...item,
        type,
        sources: item.sources || [],
        delay: item.delay || { min: 0.1, max: 5 },
        delayAfterPrev: item.delayAfterPrev ?? false,
        source: undefined,
        duration: undefined,
      });
    } else {
      onChange({
        ...item,
        type,
        // Default to '' (placeholder) so the slider/preview stay disabled until user picks a source
        source: item.source || '',
        duration: item.duration || { min: 4, max: 30 },
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
        options=${[
          { label: '- select source -', value: '' },
          ...sourceOptions,
        ]}
        heightScale="compact"
        onChange=${(e) => {
          const newVal = e.target.value;
          const next = [...(item.sources || [])];
          next[index] = newVal;
          // Auto-update track label when a source is set and label is still the default
          const updated = { ...item, sources: next };
          if (newVal && (item.label === 'Track' || !item.label)) {
            updated.label = newVal;
          }
          onChange(updated);
        }}
      />
    `;
  }, [item, onChange, sourceOptions]);

  // --- Loop-type handler ---

  const handleSourceChange = useCallback((e) => {
    const newSource = e.target.value;
    // Auto-update track label when source changes and label is still the default
    const updated = { ...item, source: newSource };
    if (newSource && (item.label === 'Track' || !item.label)) {
      updated.label = newSource;
    }
    onChange(updated);
  }, [item, onChange]);

  const delay = item.delay || { min: 0.1, max: 5 };
  const rawDuration = item.duration || { min: 4, max: 30 };
  // Clamp min to crossfade-safe minimum so old data with min=0 displays correctly.
  const duration = { min: Math.max(4, rawDuration.min), max: Math.max(4, rawDuration.max) };

  // ── Dynamic slider limits ─────────────────────────────────────────────────

  // For event tracks: longest source length among all assigned sources
  const eventSources = item.sources || [];
  const assignedEventLengths = eventSources
    .map(s => sourceLengths[s])
    .filter(l => l != null && l > 0);
  const longestEventSource = assignedEventLengths.length > 0 ? Math.max(...assignedEventLengths) : null;
  const eventDelayMax = Math.min(60, Math.max(1, longestEventSource != null ? longestEventSource * 10 : DEFAULT_DELAY_MAX));
  const eventHasNoSource = eventSources.length === 0 || eventSources.every(s => !s);

  // For loop tracks: the assigned source's effective length
  const loopSourceLabel = item.source || '';
  const loopSourceLength = (loopSourceLabel && sourceLengths[loopSourceLabel] != null)
    ? sourceLengths[loopSourceLabel]
    : null;
  const loopDurationMax = Math.min(60, Math.max(1, loopSourceLength != null ? loopSourceLength : DEFAULT_DURATION_MAX));
  const loopHasNoSource = !loopSourceLabel;

  return html`
    <${VerticalLayout} gap="medium">

      <${HorizontalLayout} gap="small" style=${{ alignItems: 'flex-end' }}>
        <${Input}
          label="Label"
          value=${item.label || ''}
          onInput=${handleLabelChange}
          onBlur=${handleLabelChange}
          placeholder="Track name"
        />
        <${Select}
          label="Type"
          id="track-type"
          value=${item.type || 'event'}
          options=${TYPE_OPTIONS}
          onChange=${handleTypeChange}
        />
        <${Input}
          label="Clones"
          type="number"
          value=${item.clones ?? 1}
          widthScale="narrow"
          onInput=${handleClonesChange}
        />
      </${HorizontalLayout}>

      ${item.type === 'loop' ? html`
        <${Select}
          label="Source"
          id="track-source"
          value=${item.source || ''}
          options=${[
            { label: '- select source -', value: '' },
            ...sourceOptions,
          ]}
          onChange=${handleSourceChange}
        />

        <${RangeSlider}
          label="Duration per Loop (s)"
          minAllowed=${4}
          maxAllowed=${loopDurationMax}
          snap=${0.1}
          min=${duration.min}
          max=${duration.max}
          widthScale="wide"
          disabled=${loopHasNoSource}
          onChange=${({ min, max }) => onChange({ ...item, duration: { min, max } })}
        />
      ` : html`
        <${DynamicList}
          title="Sources"
          items=${item.sources || []}
          renderItem=${renderSourceSelect}
          getTitle=${(s) => s || 'Source'}
          createItem=${() => ''}
          onChange=${handleSourcesChange}
          addLabel="Add Source"
          condensed=${true}
        />

        <${RangeSlider}
          label="Delay (s)"
          minAllowed=${0.1}
          maxAllowed=${eventDelayMax}
          snap=${0.1}
          min=${delay.min}
          max=${delay.max}
          widthScale="wide"
          disabled=${eventHasNoSource}
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
