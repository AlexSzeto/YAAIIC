/**
 * workflow-editor.mjs – Main workflow editor component.
 *
 * Renders:
 *  - A workflow list/selection panel with upload capability
 *  - A vertical form with all workflow configuration sections
 *  - Save / delete controls with validation
 *  - Toast notifications on save/error
 */
import { html } from 'htm/preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { useToast } from '../custom-ui/msg/toast.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { Input } from '../custom-ui/io/input.mjs';
import { Select } from '../custom-ui/io/select.mjs';
import { Checkbox } from '../custom-ui/io/checkbox.mjs';
import { Panel } from '../custom-ui/layout/panel.mjs';
import { H1, H2, VerticalLayout, HorizontalLayout } from '../custom-ui/themed-base.mjs';
import { DynamicList } from '../custom-ui/dynamic-list.mjs';
import { NodeInputSelector } from './node-input-selector.mjs';
import { TaskForm, getTaskType } from './task-form.mjs';
import { ConditionBuilder } from './condition-builder.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const PageRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.large.gap};
  padding: ${props => props.theme.spacing.large.padding};
  max-width: 900px;
  margin: 0 auto;
`;
PageRoot.className = 'workflow-editor-page';

const FormRow = styled('div')`
  display: flex;
  gap: ${props => props.theme.spacing.medium.gap};
  flex-wrap: wrap;
`;
FormRow.className = 'editor-form-row';

const DisabledWrapper = styled('div')`
  position: relative;
  display: inline-block;
`;
DisabledWrapper.className = 'editor-disabled-wrapper';

const SaveTooltip = styled('div')`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 220px;
  padding: 8px 12px;
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  background-color: ${props => props.theme.colors.background.card};
  border: ${props => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  box-shadow: ${props => props.theme.shadow.elevated};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.small};
  color: ${props => props.theme.colors.danger.background};
  pointer-events: none;
  z-index: 100;
  display: ${props => props.visible ? 'block' : 'none'};
`;
SaveTooltip.className = 'editor-save-tooltip';

const WorkflowListPanel = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.small.gap};
`;
WorkflowListPanel.className = 'workflow-list-panel';

const WorkflowListItem = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  cursor: pointer;
  background-color: ${props => props.selected
    ? props.theme.colors.primary.background
    : 'transparent'};
  border-left: ${props => props.selected
    ? `3px solid ${props.theme.colors.primary.background}`
    : '3px solid transparent'};
  transition: background-color ${props => props.theme.transitions.fast};

  &:hover {
    background-color: ${props => props.selected
      ? props.theme.colors.primary.background
      : props.theme.colors.background.hover};
  }
`;
WorkflowListItem.className = 'workflow-list-item';

const WorkflowItemName = styled('span')`
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  color: ${props => props.selected ? props.theme.colors.primary.text : props.theme.colors.text.primary};
  flex: 1;
`;
WorkflowItemName.className = 'workflow-item-name';

const Badge = styled('span')`
  font-size: ${props => props.theme.typography.fontSize.small};
  padding: 2px 6px;
  border-radius: 10px;
  background-color: ${props => props.theme.colors.background.secondary};
  color: ${props => props.theme.colors.text.secondary};
`;
Badge.className = 'workflow-badge';

const HiddenInput = styled('input')`
  display: none;
`;
HiddenInput.className = 'hidden-file-input';

const EmptyState = styled('div')`
  padding: 20px;
  text-align: center;
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  color: ${props => props.theme.colors.text.muted};
`;
EmptyState.className = 'workflow-empty-state';

// ============================================================================
// Validation helpers (mirrors server-side logic)
// ============================================================================

function validateWorkflowFrontend(workflow) {
  if (!workflow) return ['No workflow loaded'];
  const errors = [];
  if (!workflow.name?.trim())       errors.push('Workflow name is required');
  if (!workflow.options?.type)      errors.push('Workflow type is required');
  if (!workflow.base)               errors.push('Base workflow file is required');
  const replace = workflow.replace || [];
  if (!replace.some(r => r.from === 'prompt' || r.from === 'enhancedPrompt' || (r.from && r.from.startsWith('prompt'))))
    errors.push('Missing required prompt binding');
  if (!replace.some(r => r.from === 'seed'))
    errors.push('Missing required seed binding');
  if (!replace.some(r => r.from === 'saveImagePath' || r.from === 'saveAudioPath'))
    errors.push('Missing required output path binding (saveImagePath or saveAudioPath)');
  return errors;
}

// ============================================================================
// BasicInfoForm
// ============================================================================

function BasicInfoForm({ workflow, onChange, theme }) {
  const opts = workflow.options || {};

  const updateOpts = useCallback((patch) => {
    onChange({ ...workflow, options: { ...opts, ...patch } });
  }, [workflow, opts, onChange]);

  const typeOptions = [
    { label: 'Image', value: 'image' },
    { label: 'Video', value: 'video' },
    { label: 'Audio', value: 'audio' },
    { label: 'Inpaint', value: 'inpaint' },
  ];

  const orientationOptions = [
    { label: 'Portrait', value: 'portrait' },
    { label: 'Landscape', value: 'landscape' },
    { label: 'Detect', value: 'detect' },
  ];

  return html`
    <${VerticalLayout} gap="medium">
      <${FormRow} theme=${theme}>
        <${Input}
          label="Name"
          fullWidth
          value=${workflow.name || ''}
          onInput=${(e) => onChange({ ...workflow, name: e.target.value })}
          placeholder="Workflow display name"
        />
        <${Input}
          label="Base file"
          fullWidth
          value=${workflow.base || ''}
          onInput=${(e) => onChange({ ...workflow, base: e.target.value })}
          placeholder="filename.json"
          disabled
        />
      </${FormRow}>

      <${FormRow} theme=${theme}>
        <${Select}
          label="Type"
          fullWidth
          options=${typeOptions}
          value=${opts.type || 'image'}
          onChange=${(e) => updateOpts({ type: e.target.value })}
        />
        <${Select}
          label="Orientation"
          fullWidth
          options=${orientationOptions}
          value=${opts.orientation || 'portrait'}
          onChange=${(e) => updateOpts({ orientation: e.target.value })}
        />
        <${Input}
          label="Input Images"
          type="number"
          value=${opts.inputImages ?? 0}
          onInput=${(e) => updateOpts({ inputImages: parseInt(e.target.value, 10) || 0 })}
        />
        <${Input}
          label="Input Audios"
          type="number"
          value=${opts.inputAudios ?? 0}
          onInput=${(e) => updateOpts({ inputAudios: parseInt(e.target.value, 10) || 0 })}
        />
      </${FormRow}>

      <${FormRow} theme=${theme}>
        ${[
          ['hidden',         'Hidden from main UI'],
          ['autocomplete',   'Autocomplete'],
          ['optionalPrompt', 'Optional prompt'],
          ['nameRequired',   'Name required'],
        ].map(([key, label]) => html`
          <${Checkbox}
            key=${key}
            label=${label}
            checked=${opts[key] || false}
            onChange=${(e) => updateOpts({ [key]: e.target.checked })}
          />
        `)}
      </${FormRow}>
    </${VerticalLayout}>
  `;
}

// ============================================================================
// OptionItemForm (single select option: { label, value })
// ============================================================================

function OptionItemForm({ item, onChange }) {
  return html`
    <${HorizontalLayout} gap="small">
      <${Input}
        label="Label"
        fullWidth
        value=${item.label || ''}
        onInput=${(e) => onChange({ ...item, label: e.target.value })}
        placeholder="Display label"
      />
      <${Input}
        label="Value"
        fullWidth
        value=${item.value || ''}
        onInput=${(e) => onChange({ ...item, value: e.target.value })}
        placeholder="Stored value"
      />
    </${HorizontalLayout}>
  `;
}

// ============================================================================
// ExtraInputForm (single item inside ExtraInputsList)
// ============================================================================

function ExtraInputForm({ item, onChange }) {
  const hasOptions = item.type === 'select';

  const typeOptions = [
    { label: 'Text', value: 'text' },
    { label: 'Number', value: 'number' },
    { label: 'Select', value: 'select' },
    { label: 'Checkbox', value: 'checkbox' },
    { label: 'Textarea', value: 'textarea' },
  ];

  return html`
    <${VerticalLayout} gap="small">
      <${HorizontalLayout} gap="small">
        <${Input}
          label="ID"
          fullWidth
          value=${item.id || ''}
          onInput=${(e) => onChange({ ...item, id: e.target.value })}
          placeholder="snake_case_id"
        />
        <${Input}
          label="Label"
          fullWidth
          value=${item.label || ''}
          onInput=${(e) => onChange({ ...item, label: e.target.value })}
          placeholder="Display label"
        />
        <${Select}
          label="Type"
          fullWidth
          options=${typeOptions}
          value=${item.type || 'text'}
          onChange=${(e) => onChange({ ...item, type: e.target.value, options: [] })}
        />
      </${HorizontalLayout}>
      <${Input}
        label="Default value"
        fullWidth
        value=${item.default !== undefined ? String(item.default) : ''}
        onInput=${(e) => onChange({ ...item, default: e.target.value })}
        placeholder="Default"
      />
      ${hasOptions && html`
        <${DynamicList}
          title="Options"
          items=${item.options || []}
          renderItem=${(opt, i) => html`
            <${OptionItemForm}
              item=${opt}
              onChange=${(updated) => {
                const next = [...(item.options || [])];
                next[i] = updated;
                onChange({ ...item, options: next });
              }}
            />
          `}
          getTitle=${(opt) => opt.label || opt.value || 'Option'}
          createItem=${() => ({ label: '', value: '' })}
          onChange=${(opts) => onChange({ ...item, options: opts })}
          addLabel="Add Option"
        />
      `}
    </${VerticalLayout}>
  `;
}

// ============================================================================
// ReplaceMappingForm (single item inside ReplaceMapList)
// ============================================================================

function ReplaceMappingForm({ item, index, workflowJson, onChange, theme }) {
  const toValue = Array.isArray(item.to) ? item.to : null;
  const toDisplay = toValue ? JSON.stringify(toValue) : '';

  const handleNodeInputChange = useCallback((path) => {
    onChange({ ...item, to: path });
  }, [item, onChange]);

  const handleConditionChange = useCallback((cond) => {
    const next = { ...item };
    if (cond === null) delete next.condition;
    else next.condition = cond;
    onChange(next);
  }, [item, onChange]);

  return html`
    <${VerticalLayout} gap="small">
      <${Input}
        label="From (data field)"
        fullWidth
        value=${item.from || ''}
        onInput=${(e) => onChange({ ...item, from: e.target.value })}
        placeholder="e.g. seed, prompt, saveImagePath"
      />
      <div>
        <div style="font-family:${theme.typography.fontFamily};font-size:${theme.typography.fontSize.small};font-weight:${theme.typography.fontWeight.medium};color:${theme.colors.text.secondary};margin-bottom:5px;">
          To (node input path)
        </div>
        ${workflowJson && Object.keys(workflowJson).length > 0
          ? html`
            <${NodeInputSelector}
              workflowJson=${workflowJson}
              value=${toValue}
              onChange=${handleNodeInputChange}
            />
            ${toValue && html`
              <div style="font-size:${theme.typography.fontSize.small};color:${theme.colors.text.muted};margin-top:2px;">
                ${toDisplay}
              </div>
            `}
          `
          : html`
            <${Input}
              fullWidth
              value=${toDisplay}
              onInput=${(e) => {
                try {
                  onChange({ ...item, to: JSON.parse(e.target.value) });
                } catch {
                  // keep raw string while user types
                }
              }}
              placeholder='["nodeId", "inputs", "fieldName"]'
            />
          `
        }
      </div>
      <div>
        <div style="font-family:${theme.typography.fontFamily};font-size:${theme.typography.fontSize.small};font-weight:${theme.typography.fontWeight.medium};color:${theme.colors.text.secondary};margin-bottom:5px;">
          Condition (optional)
        </div>
        <${ConditionBuilder}
          value=${item.condition || null}
          onChange=${handleConditionChange}
        />
      </div>
    </${VerticalLayout}>
  `;
}

// ============================================================================
// WorkflowEditor Component
// ============================================================================

/**
 * WorkflowEditor – full workflow editor page component.
 *
 * @returns {preact.VNode}
 */
export function WorkflowEditor() {
  const toast = useToast();
  const [theme, setTheme] = useState(currentTheme.value);

  useEffect(() => {
    const unsub = currentTheme.subscribe(setTheme);
    return () => unsub();
  }, []);

  // List of all workflow summaries { name, hidden, type }
  const [workflowList,    setWorkflowList]    = useState([]);
  const [listLoading,     setListLoading]     = useState(false);

  // Currently loaded full workflow object
  const [workflow,        setWorkflow]        = useState(null);
  const [workflowJson,    setWorkflowJson]    = useState({}); // raw ComfyUI JSON
  const [isSaving,        setIsSaving]        = useState(false);
  const [isDeleting,      setIsDeleting]      = useState(false);
  const [showTooltip,     setShowTooltip]     = useState(false);
  const [uploading,       setUploading]       = useState(false);

  const fileInputRef = useRef(null);

  // Load workflow list on mount
  useEffect(() => {
    loadWorkflowList();
  }, []);

  async function loadWorkflowList() {
    setListLoading(true);
    try {
      const res = await fetch('/api/workflows');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setWorkflowList(data.workflows || []);
    } catch (e) {
      toast.error(`Failed to load workflows: ${e.message}`);
    } finally {
      setListLoading(false);
    }
  }

  async function loadWorkflow(name) {
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setWorkflow(data.workflow);

      // Load the raw ComfyUI JSON for the node selector
      if (data.workflow.base) {
        try {
          const baseRes = await fetch(`/api/workflows/${encodeURIComponent(name)}/base`);
          if (baseRes.ok) {
            setWorkflowJson(await baseRes.json());
          } else {
            setWorkflowJson({});
          }
        } catch {
          setWorkflowJson({});
        }
      }
    } catch (e) {
      toast.error(`Failed to load workflow: ${e.message}`);
    }
  }

  async function handleUpload(file) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('workflow', file);

      const res = await fetch('/api/workflows/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }
      const data = await res.json();
      setWorkflow(data.workflow);
      // Upload response includes the workflowJson directly
      setWorkflowJson(data.workflowJson || {});

      await loadWorkflowList();
      toast.success(`Uploaded "${data.workflow.name}"`);
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    const errors = validateWorkflowFrontend(workflow);
    if (errors.length > 0) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/workflows', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(workflow),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.errors || [data.error]).join(', '));
      }
      const data = await res.json();
      setWorkflow(data.workflow);
      await loadWorkflowList();
      toast.success('Workflow saved');
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!workflow) return;
    if (!window.confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(workflow.name)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      setWorkflow(null);
      setWorkflowJson({});
      await loadWorkflowList();
      toast.success('Workflow deleted');
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  }

  const validationErrors = validateWorkflowFrontend(workflow);
  const canSave = validationErrors.length === 0;

  // ──────────────────────────────────────────────────────────────────────────
  // Dynamic-list helpers
  // ──────────────────────────────────────────────────────────────────────────

  const updateWorkflow = useCallback((patch) => {
    setWorkflow(prev => ({ ...prev, ...patch }));
  }, []);

  const updateOptions = useCallback((optPatch) => {
    setWorkflow(prev => ({
      ...prev,
      options: { ...(prev?.options || {}), ...optPatch },
    }));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return html`
    <${PageRoot} theme=${theme}>

      <!-- Page header -->
      <div style="display:flex;align-items:center;gap:12px;">
        <${H1}>Workflow Editor</${H1}>
      </div>

      <!-- Workflow list + upload -->
      <${Panel} variant="outlined">
        <${VerticalLayout} gap="small">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <${H2}>Workflows</${H2}>
            <${HorizontalLayout} gap="small">
              <${Button}
                variant="medium-icon-text"
                icon="upload"
                color="secondary"
                loading=${uploading}
                onClick=${() => fileInputRef.current?.click()}
              >
                Upload JSON
              </${Button}>
              <${HiddenInput}
                ref=${fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange=${(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = '';
                }}
              />
            </${HorizontalLayout}>
          </div>

          <${WorkflowListPanel} theme=${theme}>
            ${listLoading
              ? html`<${EmptyState} theme=${theme}>Loading…</${EmptyState}>`
              : workflowList.length === 0
                ? html`<${EmptyState} theme=${theme}>No workflows yet. Upload a ComfyUI JSON to get started.</${EmptyState}>`
                : workflowList.map(wf => html`
                  <${WorkflowListItem}
                    key=${wf.name}
                    theme=${theme}
                    selected=${workflow?.name === wf.name}
                    onClick=${() => loadWorkflow(wf.name)}
                  >
                    <${WorkflowItemName} theme=${theme} selected=${workflow?.name === wf.name}>${wf.name}</${WorkflowItemName}>
                    ${wf.hidden && html`<${Badge} theme=${theme}>hidden</${Badge}>`}
                    <${Badge} theme=${theme}>${wf.type || 'image'}</${Badge}>
                  </${WorkflowListItem}>
                `)
            }
          </${WorkflowListPanel}>
        </${VerticalLayout}>
      </${Panel}>

      <!-- Editor form (only shown when a workflow is loaded) -->
      ${!workflow
        ? html`
          <${Panel} variant="default">
            <${EmptyState} theme=${theme}>Select or upload a workflow to begin editing.</${EmptyState}>
          </${Panel}>
        `
        : html`

          <!-- Basic Info -->
          <${Panel} variant="outlined">
            <${BasicInfoForm}
              workflow=${workflow}
              onChange=${setWorkflow}
              theme=${theme}
            />
          </${Panel}>

          <!-- Extra Inputs -->
          <${Panel} variant="outlined">
            <${DynamicList}
              title="Extra Inputs"
              items=${workflow.options?.extraInputs || []}
              renderItem=${(item, i) => html`
                <${ExtraInputForm}
                  item=${item}
                  index=${i}
                  onChange=${(updated) => {
                    const next = [...(workflow.options?.extraInputs || [])];
                    next[i] = updated;
                    updateOptions({ extraInputs: next });
                  }}
                />
              `}
              getTitle=${(item) => item.label || item.id || 'New input'}
              createItem=${() => ({ id: '', type: 'text', label: '', default: '', options: [] })}
              onChange=${(items) => updateOptions({ extraInputs: items })}
              addLabel="Add Input"
            />
          </${Panel}>

          <!-- Pre-generation Tasks -->
          <${Panel} variant="outlined">
            <${DynamicList}
              title="Pre-generation Tasks"
              items=${workflow.preGenerationTasks || []}
              renderItem=${(item, i) => html`
                <${TaskForm}
                  task=${item}
                  allowExecuteWorkflow=${false}
                  onChange=${(updated) => {
                    const next = [...(workflow.preGenerationTasks || [])];
                    next[i] = updated;
                    updateWorkflow({ preGenerationTasks: next });
                  }}
                />
              `}
              getTitle=${(item) => {
                const t = getTaskType(item);
                if (t === 'template') return `Template → ${item.to || '?'}`;
                if (t === 'from')     return `Copy ${item.from || '?'} → ${item.to || '?'}`;
                if (t === 'model')    return `LLM → ${item.to || '?'}`;
                return 'Task';
              }}
              createItem=${() => ({ template: '', to: '' })}
              onChange=${(items) => updateWorkflow({ preGenerationTasks: items })}
              addLabel="Add Task"
            />
          </${Panel}>

          <!-- Replace Mappings -->
          <${Panel} variant="outlined">
            <${DynamicList}
              title="Replace Mappings"
              items=${workflow.replace || []}
              renderItem=${(item, i) => html`
                <${ReplaceMappingForm}
                  item=${item}
                  index=${i}
                  workflowJson=${workflowJson}
                  theme=${theme}
                  onChange=${(updated) => {
                    const next = [...(workflow.replace || [])];
                    next[i] = updated;
                    updateWorkflow({ replace: next });
                  }}
                />
              `}
              getTitle=${(item) => item.from
                ? `${item.from} → ${Array.isArray(item.to) ? item.to.join('.') : (item.to || '?')}`
                : 'New mapping'}
              createItem=${() => ({ from: '', to: [] })}
              onChange=${(items) => updateWorkflow({ replace: items })}
              addLabel="Add Mapping"
            />
          </${Panel}>

          <!-- Post-generation Tasks -->
          <${Panel} variant="outlined">
            <${DynamicList}
              title="Post-generation Tasks"
              items=${workflow.postGenerationTasks || []}
              renderItem=${(item, i) => html`
                <${TaskForm}
                  task=${item}
                  allowExecuteWorkflow=${true}
                  onChange=${(updated) => {
                    const next = [...(workflow.postGenerationTasks || [])];
                    next[i] = updated;
                    updateWorkflow({ postGenerationTasks: next });
                  }}
                />
              `}
              getTitle=${(item) => {
                const t = getTaskType(item);
                if (t === 'template')        return `Template → ${item.to || '?'}`;
                if (t === 'from')             return `Copy ${item.from || '?'} → ${item.to || '?'}`;
                if (t === 'model')            return `LLM → ${item.to || '?'}`;
                if (t === 'executeWorkflow')  return `Execute: ${item.workflow || '?'}`;
                return 'Task';
              }}
              createItem=${() => ({ template: '', to: '' })}
              onChange=${(items) => updateWorkflow({ postGenerationTasks: items })}
              addLabel="Add Task"
            />
          </${Panel}>

          <!-- Save / Delete -->
          <${HorizontalLayout} gap="medium">
            <${DisabledWrapper}
              onMouseEnter=${() => !canSave && setShowTooltip(true)}
              onMouseLeave=${() => setShowTooltip(false)}
            >
              <${Button}
                variant="medium-text"
                color="primary"
                loading=${isSaving}
                disabled=${!canSave || isSaving}
                onClick=${handleSave}
              >
                Save Workflow
              </${Button}>
              ${!canSave && html`
                <${SaveTooltip} theme=${theme} visible=${showTooltip}>
                  ${validationErrors.map(e => html`<div>• ${e}</div>`)}
                </${SaveTooltip}>
              `}
            </${DisabledWrapper}>
            <${Button}
              variant="medium-text"
              color="danger"
              loading=${isDeleting}
              disabled=${isDeleting}
              onClick=${handleDelete}
            >
              Delete
            </${Button}>
          </${HorizontalLayout}>
        `
      }
    </${PageRoot}>
  `;
}
