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
 * { "or":  [ { "where": { "data": "field" }, "equals": { "value": true } } ] }
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const Root = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.medium.gap};
`;
Root.className = 'condition-builder-root';

const ToggleRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.medium.gap};
`;
ToggleRow.className = 'condition-builder-toggle-row';

const ConditionRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.medium.gap};
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

// ============================================================================
// ConditionItem
// ============================================================================

const MODE_OPTIONS = [
  { label: 'All of', value: 'and' },
  { label: 'One of', value: 'or' },
];

const CHECK_TYPE_OPTIONS = [
  { label: 'equals', value: 'equals' },
  { label: 'is not', value: 'isNot' },
];

function ConditionItem({ condition, index, onChange, onDelete }) {
  const theme = currentTheme.value;
  const fieldName = condition.where?.data ?? '';
  const checkType = condition.isNot !== undefined ? 'isNot' : 'equals';
  const rawValue  = condition[checkType]?.value;

  const updateCondition = useCallback((updates) => {
    onChange(index, { ...condition, ...updates });
  }, [condition, index, onChange]);

  const handleCheckTypeChange = useCallback((e) => {
    const newType = e.target.value;
    const oldType = checkType;
    if (newType === oldType) return;
    const next = { ...condition };
    const preserved = next[oldType]?.value;
    delete next[oldType];
    next[newType] = { value: preserved };
    onChange(index, next);
  }, [condition, checkType, index, onChange]);

  return html`
    <${ConditionRow} theme=${theme}>
      <${Input}
        placeholder="field name"
        value=${fieldName}
        onInput=${(e) => updateCondition({ where: { data: e.target.value } })}
      />
      <${Select}
        options=${CHECK_TYPE_OPTIONS}
        value=${checkType}
        onChange=${handleCheckTypeChange}
      />
      <${Input}
        placeholder="value"
        value=${valueToString(rawValue)}
        onInput=${(e) => updateCondition({ [checkType]: { value: coerceValue(e.target.value) } })}
      />
      <${Button}
        variant="medium-icon"
        icon="trash"
        color="danger"
        onClick=${() => onDelete(index)}
        title="Remove condition"
      />
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

  // Normalize bare single-condition objects (has `where` but no `and`/`or` wrapper)
  const normalized = value && value.where && !value.and && !value.or
    ? { and: [value] }
    : value;

  // Normalise: extract mode ('and'|'or') and conditions array
  const mode       = normalized && normalized.or ? 'or' : 'and';
  const conditions = (normalized && (normalized.and || normalized.or)) || [];

  const emit = useCallback((newMode, newConditions) => {
    if (newConditions.length === 0) {
      onChange(null);
    } else {
      onChange({ [newMode]: newConditions });
    }
  }, [onChange]);

  const handleModeChange = useCallback((e) => {
    emit(e.target.value, conditions);
  }, [conditions, emit]);

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
      <${ToggleRow} theme=${theme}>
        <${Select}
          options=${MODE_OPTIONS}
          value=${mode}
          onChange=${handleModeChange}
        />
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
