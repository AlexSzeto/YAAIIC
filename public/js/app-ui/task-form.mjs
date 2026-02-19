/**
 * task-form.mjs – Polymorphic task form for pre/post-generation tasks.
 *
 * Task types supported:
 *  - template             : { template, to, condition? }
 *  - from                 : { from, to, condition? }
 *  - model (LLM)          : { model, imagePath, prompt, to, condition? }
 *  - additionalProcessing : { process: <processorName>, parameters: {}, condition? }
 *  - executeWorkflow      : { process: "executeWorkflow", name, workflow, parameters: { inputMapping, outputMapping }, condition? }
 *
 * The task type is determined by which discriminating key is present:
 *  - has `template` → "template"
 *  - has `from` → "from"
 *  - has `model` → "model"
 *  - has `process` matching ADDITIONAL_PROCESSORS → "additionalProcessing"
 *  - has `process === "executeWorkflow"` → "executeWorkflow"
 */
import { html } from 'htm/preact';
import { useCallback, useState, useEffect } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { Input } from '../custom-ui/io/input.mjs';
import { Select } from '../custom-ui/io/select.mjs';
import { Textarea } from '../custom-ui/io/textarea.mjs';
import { DynamicList } from '../custom-ui/dynamic-list.mjs';
import { Icon } from '../custom-ui/layout/icon.mjs';
import { ConditionBuilder } from './condition-builder.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const FormRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.small.gap};
`;
FormRoot.className = 'task-form-root';

// ============================================================================
// Helpers
// ============================================================================

const ADDITIONAL_PROCESSORS = [
  { value: 'extractOutputMediaFromTextFile', label: 'Extract output media from text file' },
  { value: 'crossfadeVideoFrames',           label: 'Crossfade video frames' },
  { value: 'extractOutputTexts',             label: 'Extract output texts' },
];

const ADDITIONAL_PROCESSOR_DEFAULTS = {
  extractOutputMediaFromTextFile: { filename: '' },
  crossfadeVideoFrames:           { blendFrames: 10 },
  extractOutputTexts:             { properties: [] },
};

/**
 * Detect task type from its fields.
 * @param {Object} task
 * @returns {'template'|'from'|'model'|'additionalProcessing'|'executeWorkflow'}
 */
export function getTaskType(task) {
  if (task.process === 'executeWorkflow')                              return 'executeWorkflow';
  if (ADDITIONAL_PROCESSORS.some(p => p.value === task.process))     return 'additionalProcessing';
  if (task.template !== undefined)                                     return 'template';
  if (task.from     !== undefined)                                     return 'from';
  if (task.model    !== undefined)                                     return 'model';
  return 'template'; // default
}

/** Blank task skeletons for each type */
const BLANK_TASKS = {
  template:             { template: '', to: '' },
  from:                 { from: '', to: '' },
  model:                { model: '', imagePath: 'saveImagePath', prompt: '', to: '' },
  additionalProcessing: { process: 'extractOutputMediaFromTextFile', parameters: { filename: '' } },
  executeWorkflow:      { process: 'executeWorkflow', name: '', parameters: { workflow: '', inputMapping: [], outputMapping: [] } },
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

const TASK_TYPE_OPTIONS = [
  { value: 'template',             label: 'Template fill' },
  { value: 'from',                 label: 'Value copy' },
  { value: 'model',                label: 'LLM task' },
  { value: 'additionalProcessing', label: 'Additional processing' },
];

const TASK_TYPE_OPTIONS_WITH_EXECUTE = [
  ...TASK_TYPE_OPTIONS,
  { value: 'executeWorkflow', label: 'Execute workflow' },
];

// ============================================================================
// Sub-form: Template task
// ============================================================================

function TemplateTaskForm({ task, onChange }) {
  return html`
    <${Textarea}
      label="Template (use {{variable}} for substitutions)"
      fullWidth
      value=${task.template || ''}
      onInput=${(e) => onChange({ ...task, template: e.target.value })}
      placeholder="e.g. jpg or {{prompt}}-output"
    />
    <${Input}
      label="To (target field)"
      value=${task.to || ''}
      onInput=${(e) => onChange({ ...task, to: e.target.value })}
      placeholder="e.g. imageFormat"
      style=${{ maxWidth: '200px' }}
    />
  `;
}

// ============================================================================
// Sub-form: Value copy task (from → to)
// ============================================================================

function FromTaskForm({ task, onChange }) {
  return html`
    <${Input}
      label="From (source field)"
      value=${task.from || ''}
      onInput=${(e) => onChange({ ...task, from: e.target.value })}
      placeholder="e.g. prompt"
      style=${{ maxWidth: '200px' }}
    />
    <${Input}
      label="To (target field)"
      value=${task.to || ''}
      onInput=${(e) => onChange({ ...task, to: e.target.value })}
      placeholder="e.g. description"
      style=${{ maxWidth: '200px' }}
    />
  `;
}

// ============================================================================
// Sub-form: LLM task
// ============================================================================

function ModelTaskForm({ task, onChange }) {
  return html`
    <${Input}
      label="Model"
      value=${task.model || ''}
      onInput=${(e) => onChange({ ...task, model: e.target.value })}
      placeholder="e.g. user-v4/joycaption-beta:latest"
      style=${{ maxWidth: '200px' }}
    />
    <${Input}
      label="Image path field"
      value=${task.imagePath || ''}
      onInput=${(e) => onChange({ ...task, imagePath: e.target.value })}
      placeholder="e.g. saveImagePath"
      style=${{ maxWidth: '200px' }}
    />
    <${Textarea}
      label="Prompt"
      fullWidth
      value=${task.prompt || ''}
      onInput=${(e) => onChange({ ...task, prompt: e.target.value })}
      placeholder="LLM system prompt…"
    />
    <${Input}
      label="To (target field)"
      value=${task.to || ''}
      onInput=${(e) => onChange({ ...task, to: e.target.value })}
      placeholder="e.g. description"
      style=${{ maxWidth: '200px' }}
    />
  `;
}

// ============================================================================
// Sub-form: Additional processing task
// ============================================================================

function AdditionalProcessingTaskForm({ task, onChange }) {
  const process = task.process || ADDITIONAL_PROCESSORS[0].value;
  const params  = task.parameters || {};

  const handleProcessChange = useCallback((e) => {
    const newProcess = e.target.value;
    onChange({ ...task, process: newProcess, parameters: { ...ADDITIONAL_PROCESSOR_DEFAULTS[newProcess] } });
  }, [task, onChange]);

  const updateParam = useCallback((key, value) => {
    onChange({ ...task, parameters: { ...params, [key]: value } });
  }, [task, params, onChange]);

  return html`
    <${Select}
      label="Processor"
      options=${ADDITIONAL_PROCESSORS}
      value=${process}
      onChange=${handleProcessChange}
      style=${{ maxWidth: '200px' }}
    />

    ${process === 'extractOutputMediaFromTextFile' && html`
      <${Input}
        label="Filename"
        value=${params.filename || ''}
        onInput=${(e) => updateParam('filename', e.target.value)}
        placeholder="output text file name"
        style=${{ maxWidth: '200px' }}
      />
    `}

    ${process === 'crossfadeVideoFrames' && html`
      <${Input}
        label="Blend frames"
        type="number"
        value=${params.blendFrames ?? 10}
        onInput=${(e) => updateParam('blendFrames', parseInt(e.target.value, 10) || 0)}
        style=${{ maxWidth: '200px' }}
      />
    `}

    ${process === 'extractOutputTexts' && html`
      <${DynamicList}
        title="Properties"
        items=${params.properties || []}
        renderItem=${(item, i) => html`
          <${Input}
            fullWidth
            value=${item}
            onInput=${(e) => {
              const next = [...(params.properties || [])];
              next[i] = e.target.value;
              updateParam('properties', next);
            }}
          />
        `}
        getTitle=${(item) => item || 'Property name'}
        createItem=${() => ''}
        onChange=${(items) => updateParam('properties', items)}
        addLabel="Add Property"
      />
    `}
  `;
}

// ============================================================================
// Sub-form: executeWorkflow task
// ============================================================================

function MappingForm({ mapping, onChange }) {
  return html`
    <${Input}
      label="From"
      value=${mapping.from || ''}
      onInput=${(e) => onChange({ ...mapping, from: e.target.value })}
      placeholder="source field"
      style=${{ maxWidth: '200px' }}
    />
    <${Input}
      label="To"
      value=${mapping.to || ''}
      onInput=${(e) => onChange({ ...mapping, to: e.target.value })}
      placeholder="target field"
      style=${{ maxWidth: '200px' }}
    />
  `;
}

function ExecuteWorkflowTaskForm({ task, onChange }) {
  const params = task.parameters || { workflow: '', inputMapping: [], outputMapping: [] };
  const [workflowOptions, setWorkflowOptions] = useState([]);

  useEffect(() => {
    fetch('/api/workflows')
      .then(r => r.ok ? r.json() : { workflows: [] })
      .then(data => {
        setWorkflowOptions((data.workflows || []).map(wf => ({ label: wf.name, value: wf.name })));
      })
      .catch(() => {});
  }, []);

  const updateParams = (key, value) => {
    onChange({ ...task, parameters: { ...params, [key]: value } });
  };

  return html`
    <${Input}
      label="Name (display label)"
      value=${task.name || ''}
      onInput=${(e) => onChange({ ...task, name: e.target.value })}
      placeholder="optional display name"
      style=${{ maxWidth: '200px' }}
    />
    <${Select}
      label="Workflow"
      options=${workflowOptions}
      value=${params.workflow || ''}
      onChange=${(e) => updateParams('workflow', e.target.value)}
      style=${{ maxWidth: '200px' }}
    />

    <${DynamicList}
      title="Input Mappings"
      items=${params.inputMapping || []}
      renderItem=${(item, i) => html`
        <${MappingForm}
          mapping=${item}
          onChange=${(updated) => {
            const next = [...(params.inputMapping || [])];
            next[i] = updated;
            updateParams('inputMapping', next);
          }}
        />
      `}
      getTitle=${(item) => item.from ? html`${item.from} <${Icon} name="arrow-right-stroke" size="14px" /> ${item.to || '?'}` : 'New mapping'}
      createItem=${() => ({ from: '', to: '' })}
      onChange=${(items) => updateParams('inputMapping', items)}
      addLabel="Add Input Mapping"
    />

    <${DynamicList}
      title="Output Mappings"
      items=${params.outputMapping || []}
      renderItem=${(item, i) => html`
        <${MappingForm}
          mapping=${item}
          onChange=${(updated) => {
            const next = [...(params.outputMapping || [])];
            next[i] = updated;
            updateParams('outputMapping', next);
          }}
        />
      `}
      getTitle=${(item) => item.from ? html`${item.from} <${Icon} name="arrow-right-stroke" size="14px" /> ${item.to || '?'}` : 'New mapping'}
      createItem=${() => ({ from: '', to: '' })}
      onChange=${(items) => updateParams('outputMapping', items)}
      addLabel="Add Output Mapping"
    />
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

  const typeOptions = allowExecuteWorkflow ? TASK_TYPE_OPTIONS_WITH_EXECUTE : TASK_TYPE_OPTIONS;

  return html`
    <${FormRoot} theme=${theme}>
      <${Select}
        label="Task type"
        options=${typeOptions}
        value=${taskType}
        onChange=${handleTypeChange}
        style=${{ maxWidth: '200px' }}
      />

      ${taskType === 'template'             && html`<${TemplateTaskForm}             task=${task} onChange=${onChange} />`}
      ${taskType === 'from'                 && html`<${FromTaskForm}                 task=${task} onChange=${onChange} />`}
      ${taskType === 'model'                && html`<${ModelTaskForm}                task=${task} onChange=${onChange} />`}
      ${taskType === 'additionalProcessing' && html`<${AdditionalProcessingTaskForm} task=${task} onChange=${onChange} />`}
      ${taskType === 'executeWorkflow'      && html`<${ExecuteWorkflowTaskForm}      task=${task} onChange=${onChange} />`}

      <div>
        <div style="font-family:${theme.typography.fontFamily};font-size:${theme.typography.fontSize.small};font-weight:${theme.typography.fontWeight.medium};color:${theme.colors.text.secondary};margin-bottom:5px;">
          Condition (optional)
        </div>
        <${ConditionBuilder}
          value=${task.condition || null}
          onChange=${handleConditionChange}
        />
      </div>
    </${FormRoot}>
  `;
}
