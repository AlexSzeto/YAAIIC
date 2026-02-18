/**
 * TaskForm.mjs – Polymorphic task form for pre/post-generation tasks.
 *
 * Task types supported:
 *  - template   : { template, to, condition? }
 *  - from        : { from, to, condition? }
 *  - model (LLM) : { model, imagePath, prompt, to, condition? }
 *  - executeWorkflow : { process: "executeWorkflow", name, workflow, parameters: { inputMapping, outputMapping }, condition? }
 *
 * The task type is determined by which discriminating key is present:
 *  - has `template` → "template"
 *  - has `from` → "from"
 *  - has `model` → "model"
 *  - has `process === "executeWorkflow"` → "executeWorkflow"
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { DynamicList } from '../custom-ui/DynamicList.mjs';
import { ConditionBuilder } from './ConditionBuilder.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const FormRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.small.gap};
`;
FormRoot.className = 'task-form-root';

const Row = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
Row.className = 'task-form-row';

const FieldLabel = styled('label')`
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.small};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  color: ${props => props.theme.colors.text.secondary};
`;
FieldLabel.className = 'task-form-label';

const StyledInput = styled('input')`
  padding: 7px 10px;
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  border: ${props => `2px solid ${props.theme.colors.border.primary}`};
  background-color: ${props => props.theme.colors.background.tertiary};
  color: ${props => props.theme.colors.text.primary};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  width: 100%;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.border};
  }
`;
StyledInput.className = 'task-styled-input';

const StyledTextarea = styled('textarea')`
  padding: 7px 10px;
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  border: ${props => `2px solid ${props.theme.colors.border.primary}`};
  background-color: ${props => props.theme.colors.background.tertiary};
  color: ${props => props.theme.colors.text.primary};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  width: 100%;
  min-height: 80px;
  resize: vertical;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.border};
  }
`;
StyledTextarea.className = 'task-styled-textarea';

const StyledSelect = styled('select')`
  padding: 7px 10px;
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  border: ${props => `2px solid ${props.theme.colors.border.primary}`};
  background-color: ${props => props.theme.colors.background.tertiary};
  color: ${props => props.theme.colors.text.primary};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  width: 100%;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.border};
  }
`;
StyledSelect.className = 'task-styled-select';

const SectionTitle = styled('div')`
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.small};
  font-weight: ${props => props.theme.typography.fontWeight.bold};
  color: ${props => props.theme.colors.text.secondary};
  margin-top: 4px;
`;
SectionTitle.className = 'task-section-title';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Detect task type from its fields.
 * @param {Object} task
 * @returns {'template'|'from'|'model'|'executeWorkflow'}
 */
export function getTaskType(task) {
  if (task.process === 'executeWorkflow') return 'executeWorkflow';
  if (task.template !== undefined)        return 'template';
  if (task.from     !== undefined)        return 'from';
  if (task.model    !== undefined)        return 'model';
  return 'template'; // default
}

/** Blank task skeletons for each type */
const BLANK_TASKS = {
  template:         { template: '', to: '' },
  from:             { from: '', to: '' },
  model:            { model: '', imagePath: 'saveImagePath', prompt: '', to: '' },
  executeWorkflow:  { process: 'executeWorkflow', name: '', workflow: '', parameters: { inputMapping: [], outputMapping: [] } },
};

/**
 * Convert a task to a different type, preserving `to` and `condition`.
 */
function convertTaskType(task, newType) {
  const base = { ...BLANK_TASKS[newType] };
  if (task.to)        base.to        = task.to;
  if (task.condition) base.condition = task.condition;
  return base;
}

// ============================================================================
// Sub-form: Template task
// ============================================================================

function TemplateTaskForm({ task, onChange, theme }) {
  return html`
    <${FormRoot} theme=${theme}>
      <${Row}>
        <${FieldLabel} theme=${theme}>Template (use {{variable}} for substitutions)</${FieldLabel}>
        <${StyledTextarea}
          theme=${theme}
          value=${task.template || ''}
          onInput=${(e) => onChange({ ...task, template: e.target.value })}
          placeholder="e.g. jpg or {{prompt}}-output"
        />
      </${Row}>
      <${Row}>
        <${FieldLabel} theme=${theme}>To (target field)</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${task.to || ''}
          onInput=${(e) => onChange({ ...task, to: e.target.value })}
          placeholder="e.g. imageFormat"
        />
      </${Row}>
    </${FormRoot}>
  `;
}

// ============================================================================
// Sub-form: Value copy task (from → to)
// ============================================================================

function FromTaskForm({ task, onChange, theme }) {
  return html`
    <${FormRoot} theme=${theme}>
      <${Row}>
        <${FieldLabel} theme=${theme}>From (source field)</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${task.from || ''}
          onInput=${(e) => onChange({ ...task, from: e.target.value })}
          placeholder="e.g. prompt"
        />
      </${Row}>
      <${Row}>
        <${FieldLabel} theme=${theme}>To (target field)</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${task.to || ''}
          onInput=${(e) => onChange({ ...task, to: e.target.value })}
          placeholder="e.g. description"
        />
      </${Row}>
    </${FormRoot}>
  `;
}

// ============================================================================
// Sub-form: LLM task
// ============================================================================

function ModelTaskForm({ task, onChange, theme }) {
  return html`
    <${FormRoot} theme=${theme}>
      <${Row}>
        <${FieldLabel} theme=${theme}>Model</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${task.model || ''}
          onInput=${(e) => onChange({ ...task, model: e.target.value })}
          placeholder="e.g. user-v4/joycaption-beta:latest"
        />
      </${Row}>
      <${Row}>
        <${FieldLabel} theme=${theme}>Image path field</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${task.imagePath || ''}
          onInput=${(e) => onChange({ ...task, imagePath: e.target.value })}
          placeholder="e.g. saveImagePath"
        />
      </${Row}>
      <${Row}>
        <${FieldLabel} theme=${theme}>Prompt</${FieldLabel}>
        <${StyledTextarea}
          theme=${theme}
          value=${task.prompt || ''}
          onInput=${(e) => onChange({ ...task, prompt: e.target.value })}
          placeholder="LLM system prompt…"
        />
      </${Row}>
      <${Row}>
        <${FieldLabel} theme=${theme}>To (target field)</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${task.to || ''}
          onInput=${(e) => onChange({ ...task, to: e.target.value })}
          placeholder="e.g. description"
        />
      </${Row}>
    </${FormRoot}>
  `;
}

// ============================================================================
// Sub-form: executeWorkflow task
// ============================================================================

function MappingForm({ mapping, onChange, theme }) {
  return html`
    <${FormRoot} theme=${theme}>
      <${Row}>
        <${FieldLabel} theme=${theme}>From</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${mapping.from || ''}
          onInput=${(e) => onChange({ ...mapping, from: e.target.value })}
          placeholder="source field"
        />
      </${Row}>
      <${Row}>
        <${FieldLabel} theme=${theme}>To</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${mapping.to || ''}
          onInput=${(e) => onChange({ ...mapping, to: e.target.value })}
          placeholder="target field"
        />
      </${Row}>
    </${FormRoot}>
  `;
}

function ExecuteWorkflowTaskForm({ task, onChange, theme }) {
  const params = task.parameters || { inputMapping: [], outputMapping: [] };

  const updateParams = (key, items) => {
    onChange({ ...task, parameters: { ...params, [key]: items } });
  };

  return html`
    <${FormRoot} theme=${theme}>
      <${Row}>
        <${FieldLabel} theme=${theme}>Name (display label)</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${task.name || ''}
          onInput=${(e) => onChange({ ...task, name: e.target.value })}
          placeholder="optional display name"
        />
      </${Row}>
      <${Row}>
        <${FieldLabel} theme=${theme}>Workflow name</${FieldLabel}>
        <${StyledInput}
          theme=${theme}
          value=${task.workflow || ''}
          onInput=${(e) => onChange({ ...task, workflow: e.target.value })}
          placeholder="e.g. Text to Image (Flux)"
        />
      </${Row}>

      <${SectionTitle} theme=${theme}>Input Mappings</${SectionTitle}>
      <${DynamicList}
        items=${params.inputMapping || []}
        renderItem=${(item, i) => html`
          <${MappingForm}
            mapping=${item}
            theme=${theme}
            onChange=${(updated) => {
              const next = [...(params.inputMapping || [])];
              next[i] = updated;
              updateParams('inputMapping', next);
            }}
          />
        `}
        getTitle=${(item) => item.from ? `${item.from} → ${item.to || '?'}` : 'New mapping'}
        createItem=${() => ({ from: '', to: '' })}
        onChange=${(items) => updateParams('inputMapping', items)}
        addLabel="Add Input Mapping"
      />

      <${SectionTitle} theme=${theme}>Output Mappings</${SectionTitle}>
      <${DynamicList}
        items=${params.outputMapping || []}
        renderItem=${(item, i) => html`
          <${MappingForm}
            mapping=${item}
            theme=${theme}
            onChange=${(updated) => {
              const next = [...(params.outputMapping || [])];
              next[i] = updated;
              updateParams('outputMapping', next);
            }}
          />
        `}
        getTitle=${(item) => item.from ? `${item.from} → ${item.to || '?'}` : 'New mapping'}
        createItem=${() => ({ from: '', to: '' })}
        onChange=${(items) => updateParams('outputMapping', items)}
        addLabel="Add Output Mapping"
      />
    </${FormRoot}>
  `;
}

// ============================================================================
// TaskForm (main export)
// ============================================================================

/**
 * TaskForm – Polymorphic form for pre/post-generation task items.
 *
 * @param {Object}   props
 * @param {Object}   props.task              - Task data object.
 * @param {Function} props.onChange          - Called with updated task object.
 * @param {boolean}  [props.allowExecuteWorkflow=false] - Show executeWorkflow option.
 * @returns {preact.VNode}
 */
export function TaskForm({ task, onChange, allowExecuteWorkflow = false }) {
  const theme    = currentTheme.value;
  const taskType = getTaskType(task);

  const handleTypeChange = useCallback((e) => {
    onChange(convertTaskType(task, e.target.value));
  }, [task, onChange]);

  const handleConditionChange = useCallback((cond) => {
    const next = { ...task };
    if (cond === null) {
      delete next.condition;
    } else {
      next.condition = cond;
    }
    onChange(next);
  }, [task, onChange]);

  const typeOptions = [
    { value: 'template', label: 'Template fill' },
    { value: 'from',     label: 'Value copy' },
    { value: 'model',    label: 'LLM task' },
    ...(allowExecuteWorkflow
      ? [{ value: 'executeWorkflow', label: 'Execute workflow' }]
      : []),
  ];

  return html`
    <${FormRoot} theme=${theme}>
      <${Row}>
        <${FieldLabel} theme=${theme}>Task type</${FieldLabel}>
        <${StyledSelect}
          theme=${theme}
          value=${taskType}
          onChange=${handleTypeChange}
        >
          ${typeOptions.map(opt => html`
            <option key=${opt.value} value=${opt.value}>${opt.label}</option>
          `)}
        </${StyledSelect}>
      </${Row}>

      ${taskType === 'template'        && html`<${TemplateTaskForm}        task=${task} onChange=${onChange} theme=${theme} />`}
      ${taskType === 'from'            && html`<${FromTaskForm}            task=${task} onChange=${onChange} theme=${theme} />`}
      ${taskType === 'model'           && html`<${ModelTaskForm}           task=${task} onChange=${onChange} theme=${theme} />`}
      ${taskType === 'executeWorkflow' && html`<${ExecuteWorkflowTaskForm} task=${task} onChange=${onChange} theme=${theme} />`}

      <${Row}>
        <${FieldLabel} theme=${theme}>Condition (optional)</${FieldLabel}>
        <${ConditionBuilder}
          value=${task.condition || null}
          onChange=${handleConditionChange}
        />
      </${Row}>
    </${FormRoot}>
  `;
}
