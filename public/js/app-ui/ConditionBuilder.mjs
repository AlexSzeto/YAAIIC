/**
 * ConditionBuilder.mjs – AND/OR condition group builder.
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
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;
ConditionRow.className = 'condition-row';

const StyledSelect = styled('select')`
  padding: 6px 8px;
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  border: ${props => `2px solid ${props.theme.colors.border.primary}`};
  background-color: ${props => props.theme.colors.background.tertiary};
  color: ${props => props.theme.colors.text.primary};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.border};
  }
`;
StyledSelect.className = 'condition-select';

const StyledInput = styled('input')`
  flex: 1;
  min-width: 80px;
  padding: 6px 8px;
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  border: ${props => `2px solid ${props.theme.colors.border.primary}`};
  background-color: ${props => props.theme.colors.background.tertiary};
  color: ${props => props.theme.colors.text.primary};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.border};
  }
`;
StyledInput.className = 'condition-input';

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

function ConditionItem({ condition, index, onChange, onDelete, theme }) {
  const source    = condition.where ? Object.keys(condition.where)[0] : 'data';
  const fieldName = condition.where ? condition.where[source] : '';
  const rawValue  = condition.equals?.value;

  const updateCondition = useCallback((updates) => {
    const newCond = { ...condition, ...updates };
    onChange(index, newCond);
  }, [condition, index, onChange]);

  const handleSourceChange = useCallback((e) => {
    updateCondition({ where: { [e.target.value]: fieldName } });
  }, [fieldName, updateCondition]);

  const handleFieldChange = useCallback((e) => {
    updateCondition({ where: { [source]: e.target.value } });
  }, [source, updateCondition]);

  const handleValueChange = useCallback((e) => {
    updateCondition({ equals: { value: coerceValue(e.target.value) } });
  }, [updateCondition]);

  return html`
    <${ConditionRow}>
      <${StyledSelect}
        theme=${theme}
        value=${source}
        onChange=${handleSourceChange}
      >
        <option value="data">data</option>
        <option value="generationData">generationData</option>
      </${StyledSelect}>

      <${StyledInput}
        theme=${theme}
        placeholder="field name"
        value=${fieldName}
        onInput=${handleFieldChange}
      />

      <span style="color:${theme.colors.text.secondary};font-size:${theme.typography.fontSize.small}">
        equals
      </span>

      <${StyledInput}
        theme=${theme}
        placeholder="value"
        value=${valueToString(rawValue)}
        onInput=${handleValueChange}
      />

      <${Button}
        variant="small-icon"
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
    const next = conditions.map((c, i) => i === index ? newCond : c);
    emit(mode, next);
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
          theme=${theme}
        />
      `)}
    </${Root}>
  `;
}
