/**
 * condition-builder.mjs – AND/OR condition group builder.
 *
 * Renders an AND/OR toggle and a list of condition items. Each condition item
 * specifies a source (data / generationData), a field name, and an expected
 * value.
 *
 * Output JSON structure:
 * { "and": [ { "where": { "data": "field" }, "equals": { "value": "v" } } ] }
 * or
 * { "or":  [ { "where": { "generationData": "field" }, "equals": { "value": true } } ] }
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { Input } from '../custom-ui/io/input.mjs';
import { Select } from '../custom-ui/io/select.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const Root = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.small.gap};
`;
Root.className = 'condition-builder-root';

const ToggleRow = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
`;
ToggleRow.className = 'condition-builder-toggle-row';

const ToggleLabel = styled('span')`
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.small};
  color: ${props => props.theme.colors.text.secondary};
`;
ToggleLabel.className = 'condition-toggle-label';

const ConditionRow = styled('div')`
  display: flex;
  align-items: flex-end;
  gap: 6px;
  flex-wrap: wrap;
`;
ConditionRow.className = 'condition-row';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Coerce a string input to the appropriate JS type for the condition value.
 * "true" / "false" → boolean; numeric strings → number; otherwise string.
 */
function coerceValue(raw) {
  if (raw === 'true')  return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== '') return num;
  return raw;
}

/**
 * Represent a condition value as an editable string.
 */
function valueToString(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

const SOURCE_OPTIONS = [
  { label: 'data', value: 'data' },
  { label: 'generationData', value: 'generationData' },
];

// ============================================================================
// ConditionItem
// ============================================================================

function ConditionItem({ condition, index, onChange, onDelete }) {
  const source    = condition.where ? Object.keys(condition.where)[0] : 'data';
  const fieldName = condition.where ? condition.where[source] : '';
  const rawValue  = condition.equals?.value;

  const updateCondition = useCallback((updates) => {
    onChange(index, { ...condition, ...updates });
  }, [condition, index, onChange]);

  return html`
    <${ConditionRow}>
      <${Select}
        options=${SOURCE_OPTIONS}
        value=${source}
        onChange=${(e) => updateCondition({ where: { [e.target.value]: fieldName } })}
      />
      <${Input}
        placeholder="field name"
        value=${fieldName}
        onInput=${(e) => updateCondition({ where: { [source]: e.target.value } })}
      />
      <span style="padding-bottom:10px;white-space:nowrap;font-size:0.85em;">equals</span>
      <${Input}
        placeholder="value"
        value=${valueToString(rawValue)}
        onInput=${(e) => updateCondition({ equals: { value: coerceValue(e.target.value) } })}
      />
      <div style="padding-bottom:6px;">
        <${Button}
          variant="small-icon"
          icon="trash"
          color="danger"
          onClick=${() => onDelete(index)}
          title="Remove condition"
        />
      </div>
    </${ConditionRow}>
  `;
}

// ============================================================================
// ConditionBuilder Component
// ============================================================================

/**
 * ConditionBuilder – Builds AND/OR condition groups.
 *
 * @param {Object}   props
 * @param {Object}   [props.value]     - Current condition object `{ and: [...] }` or `{ or: [...] }` or null.
 * @param {Function} props.onChange    - Called with the new condition object (or null when all removed).
 * @returns {preact.VNode}
 *
 * @example
 * html`
 *   <${ConditionBuilder}
 *     value=${task.condition || null}
 *     onChange=${(cond) => updateTask({ ...task, condition: cond })}
 *   />
 * `
 */
export function ConditionBuilder({ value, onChange }) {
  const theme = currentTheme.value;

  // Normalise: extract mode ('and'|'or') and conditions array
  const mode       = value && value.or ? 'or' : 'and';
  const conditions = (value && (value.and || value.or)) || [];

  const emit = useCallback((newMode, newConditions) => {
    if (newConditions.length === 0) {
      onChange(null);
    } else {
      onChange({ [newMode]: newConditions });
    }
  }, [onChange]);

  const handleToggleMode = useCallback(() => {
    emit(mode === 'and' ? 'or' : 'and', conditions);
  }, [mode, conditions, emit]);

  const handleAdd = useCallback(() => {
    emit(mode, [...conditions, { where: { data: '' }, equals: { value: '' } }]);
  }, [mode, conditions, emit]);

  const handleChange = useCallback((index, newCond) => {
    emit(mode, conditions.map((c, i) => i === index ? newCond : c));
  }, [mode, conditions, emit]);

  const handleDelete = useCallback((index) => {
    emit(mode, conditions.filter((_, i) => i !== index));
  }, [mode, conditions, emit]);

  return html`
    <${Root} theme=${theme}>
      <${ToggleRow}>
        <${ToggleLabel} theme=${theme}>Condition logic:</${ToggleLabel}>
        <${Button}
          variant="small-text"
          color=${mode === 'and' ? 'primary' : 'secondary'}
          disabled=${conditions.length === 0}
          onClick=${handleToggleMode}
          title="Toggle AND / OR"
        >
          ${mode.toUpperCase()}
        </${Button}>
        <${Button}
          variant="small-icon"
          icon="plus"
          color="secondary"
          onClick=${handleAdd}
          title="Add condition"
        />
      </${ToggleRow}>

      ${conditions.map((cond, i) => html`
        <${ConditionItem}
          key=${i}
          condition=${cond}
          index=${i}
          onChange=${handleChange}
          onDelete=${handleDelete}
        />
      `)}
    </${Root}>
  `;
}
