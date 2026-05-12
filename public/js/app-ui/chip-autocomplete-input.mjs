/**
 * chip-autocomplete-input.mjs – Autocomplete input with a chip row.
 *
 * Composes AutocompleteInput with a row of removable chip buttons below it.
 * Each chip uses the `chip` Button variant with an `x` icon. The input
 * deduplicates case-insensitively before appending.
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { AutocompleteInput } from './autocomplete-input.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const ChipRow = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${() => currentTheme.value.spacing.small.gap};
  align-items: center;
`;
ChipRow.className = 'chip-autocomplete-chip-row';

// ============================================================================
// Component
// ============================================================================

/**
 * ChipAutocompleteInput – autocomplete input that appends selected values as chips.
 *
 * @param {string}   props.label
 * @param {string}   [props.placeholder]
 * @param {string[]} props.suggestions    – autocomplete candidates
 * @param {string[]} props.values         – current chip list
 * @param {Function} props.onValuesChange – (newValues: string[]) => void
 * @param {boolean}  [props.disabled]
 *
 * @example
 * <${ChipAutocompleteInput}
 *   label="Types"
 *   placeholder="Add a type..."
 *   suggestions=${['hair', 'outfit', 'accessory']}
 *   values=${part.config.type}
 *   onValuesChange=${(v) => updateConfig({ type: v })}
 * />
 */
export function ChipAutocompleteInput({ label, placeholder, suggestions = [], values = [], onValuesChange, disabled = false }) {
  const handleSelect = useCallback((value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    // Case-insensitive duplicate check
    if (values.some(v => v.toLowerCase() === trimmed.toLowerCase())) return;
    onValuesChange([...values, trimmed]);
  }, [values, onValuesChange]);

  const handleRemove = useCallback((index) => {
    onValuesChange(values.filter((_, i) => i !== index));
  }, [values, onValuesChange]);

  return html`
    <${AutocompleteInput}
      label=${label}
      placeholder=${placeholder}
      suggestions=${suggestions}
      onSelect=${handleSelect}
      disabled=${disabled}
    />
    ${values.length > 0 && html`
      <${ChipRow}>
        ${values.map((v, i) => html`
          <${Button}
            key=${v + i}
            variant="chip"
            color="primary"
            icon="x"
            disabled=${disabled}
            onClick=${() => handleRemove(i)}
          >${v}<//>
        `)}
      </${ChipRow}>
    `}
  `;
}
