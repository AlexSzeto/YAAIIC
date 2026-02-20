/**
 * workflow-editor.mjs – Main workflow editor component.
 *
 * Renders:
 *  - A header with an "Open" button that launches a ListSelectModal for workflow selection
 *  - A vertical form with all workflow configuration sections
 *  - Save / delete controls with validation
 *  - Toast notifications on save/error
 */
import { html } from 'htm/preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { Checkbox } from '../../custom-ui/io/checkbox.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
import { H1, VerticalLayout, HorizontalLayout, H3 } from '../../custom-ui/themed-base.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { NodeInputSelector } from './node-input-selector.mjs';
import { TaskForm, getTaskType } from './task-form.mjs';
import { ConditionBuilder } from './condition-builder.mjs';
import { HamburgerMenu } from '../hamburger-menu.mjs';
import { Icon } from '../../custom-ui/layout/icon.mjs';
import ListSelectModal from '../../custom-ui/overlays/list-select.mjs';
import { AppHeader } from '../themed-base.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const PageRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.large.gap};
  padding: ${props => props.theme.spacing.large.padding};
  /* max-width: 900px; */
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

const EmptyState = styled('div')`
  padding: 20px;
  text-align: center;
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  color: ${props => props.theme.colors.text.muted};
`;
EmptyState.className = 'workflow-empty-state';

const InlineArrowIcon = html`<${Icon} name="arrow-right-stroke" size="14px" style=${{ position: 'relative', top: '2px' }}/>`

// ============================================================================
// Helpers
// ============================================================================

/**
 * Returns the icon name for a workflow summary based on its properties.
 * @param {{ hidden?: boolean, type?: string }} wf
 * @returns {string}
 */
function getWorkflowIcon(wf) {
  if (wf.hidden) return 'eye-slash';
  if (wf.type === 'inpaint') return 'brush';
  if (wf.type === 'video') return 'video';
  if (wf.type === 'audio') return 'music';
  return 'image';
}

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
  if (!replace.some(r => r.from === 'saveImagePath' || r.from === 'saveAudioPath')
      && !(workflow.postGenerationTasks || []).some(t => t.process === 'extractOutputMediaFromTextFile'))
    errors.push('Missing required output path binding (saveImagePath, saveAudioPath, or extractOutputMediaFromTextFile post-task)');
  return errors;
}

// ============================================================================
// BasicInfoForm
// ============================================================================

function BasicInfoForm({ workflow, onChange, baseFiles, onBaseChange, theme }) {
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

  const baseFileOptions = (['', ...baseFiles] || []).map(f => ({ label: f || '— choose workflow —', value: f }));

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
      </${FormRow}>
      <${FormRow} theme=${theme}>
        <${Select}
          label="Base ComfyUI Workflow File"
          fullWidth="true"
          options=${baseFileOptions}
          value=${workflow.base || ''}
          onChange=${(e) => {
            onChange({ ...workflow, base: e.target.value });
            if (onBaseChange) onBaseChange(e.target.value);
          }}
        />

      </${FormRow}>

      <${FormRow} theme=${theme}>
        <${Select}
          label="Type"
          options=${typeOptions}
          value=${opts.type || 'image'}
          onChange=${(e) => updateOpts({ type: e.target.value })}
          style=${{ maxWidth: '200px' }}
        />
        <${Select}
          label="Orientation"
          options=${orientationOptions}
          value=${opts.orientation || 'portrait'}
          onChange=${(e) => updateOpts({ orientation: e.target.value })}
          style=${{ maxWidth: '200px' }}
        />
        <${Input}
          label="Input Images"
          type="number"
          value=${opts.inputImages ?? 0}
          onInput=${(e) => updateOpts({ inputImages: parseInt(e.target.value, 10) || 0 })}
          style=${{ maxWidth: '200px' }}
        />
        <${Input}
          label="Input Audios"
          type="number"
          value=${opts.inputAudios ?? 0}
          onInput=${(e) => updateOpts({ inputAudios: parseInt(e.target.value, 10) || 0 })}
          style=${{ maxWidth: '200px' }}
        />
      </${FormRow}>

      <${FormRow} theme=${theme}>
        <div style="min-width:200px;display:flex;align-items:flex-end;">
          <${Checkbox}
            key="hidden"
            label="Hidden from main UI"
            checked=${workflow.hidden || false}
            onChange=${(e) => onChange({ ...workflow, hidden: e.target.checked })}
          />
        </div>
        ${[
          ['autocomplete',   'Autocomplete'],
          ['optionalPrompt', 'Optional prompt'],
          ['nameRequired',   'Name required'],
        ].map(([key, label]) => html`
          <div style="min-width:200px;display:flex;align-items:flex-end;">
            <${Checkbox}
              key=${key}
              label=${label}
              checked=${opts[key] || false}
              onChange=${(e) => updateOpts({ [key]: e.target.checked })}
            />
          </div>
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
        value=${item.label || ''}
        onInput=${(e) => onChange({ ...item, label: e.target.value })}
        placeholder="Display label"
        style=${{ maxWidth: '200px' }}
      />
      <${Input}
        label="Value"
        value=${item.value || ''}
        onInput=${(e) => onChange({ ...item, value: e.target.value })}
        placeholder="Stored value"
        style=${{ maxWidth: '200px' }}
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
      <${HorizontalLayout} gap="medium">
        <${Input}
          label="ID"
          value=${item.id || ''}
          onInput=${(e) => onChange({ ...item, id: e.target.value })}
          placeholder="snake_case_id"
          style=${{ maxWidth: '200px' }}
        />
        <${Input}
          label="Label"
          value=${item.label || ''}
          onInput=${(e) => onChange({ ...item, label: e.target.value })}
          placeholder="Display label"
          style=${{ maxWidth: '200px' }}
        />
        <${Select}
          label="Type"
          options=${typeOptions}
          value=${item.type || 'text'}
          onChange=${(e) => onChange({ ...item, type: e.target.value, options: [] })}
          style=${{ maxWidth: '200px' }}
        />
        <${Input}
          label="Default Value"
          value=${item.default !== undefined ? String(item.default) : ''}
          onInput=${(e) => onChange({ ...item, default: e.target.value })}
          placeholder="Default"
          style=${{ maxWidth: '200px' }}
        />
      </${HorizontalLayout}>
      ${hasOptions && html`
        <${DynamicList}
          title="Options"
          condensed
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
    <${VerticalLayout} gap="medium">
      <${HorizontalLayout} gap="medium">
      <${Input}
        label="Source Field"
        value=${item.from || ''}
        onInput=${(e) => onChange({ ...item, from: e.target.value })}
        placeholder="e.g. seed, prompt, saveImagePath"
        style=${{ maxWidth: '200px' }}
      />
      <div>
        <div style="font-family:${theme.typography.fontFamily};font-size:${theme.typography.fontSize.small};font-weight:${theme.typography.fontWeight.medium};color:${theme.colors.text.secondary};margin-bottom:5px;">
          Target Node Input
        </div>
        ${workflowJson && Object.keys(workflowJson).length > 0
          ? html`
            <${NodeInputSelector}
              workflowJson=${workflowJson}
              value=${toValue}
              onChange=${handleNodeInputChange}
            />
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
      </${HorizontalLayout}>
      <${VerticalLayout} gap="small">
        <${H3}>Condition (optional)</${H3}>
        <${ConditionBuilder}
          value=${item.condition || null}
          onChange=${handleConditionChange}
        />
      </${VerticalLayout}>
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

  // Modal open state
  const [isModalOpen,     setIsModalOpen]     = useState(false);

  // Available base files from disk
  const [baseFiles,       setBaseFiles]       = useState([]);

  // Currently loaded full workflow object
  const [workflow,        setWorkflow]        = useState(null);
  const [workflowJson,    setWorkflowJson]    = useState({}); // raw ComfyUI JSON
  const [isSaving,        setIsSaving]        = useState(false);
  const [isDeleting,      setIsDeleting]      = useState(false);
  const [showTooltip,     setShowTooltip]     = useState(false);

  const fileInputRef = useRef(null);

  // Load workflow list and base files on mount
  useEffect(() => {
    loadWorkflowList();
    loadBaseFiles();
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

  async function loadBaseFiles() {
    try {
      const res = await fetch('/api/workflows/base-files');
      if (!res.ok) return;
      const data = await res.json();
      setBaseFiles(data.files || []);
    } catch {
      // non-critical; silently ignore
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

  async function handleMoveWorkflow(name, direction) {
    const index = workflowList.findIndex(wf => wf.name === name);
    if (index === -1) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= workflowList.length) return;

    const next = [...workflowList];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setWorkflowList(next);

    try {
      await fetch('/api/workflows/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map(wf => wf.name) }),
      });
    } catch (e) {
      toast.error(`Failed to save workflow order: ${e.message}`);
    }
  }

  async function handleDuplicate(name) {
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const fetchedWorkflow = data.workflow;

      // Strip trailing " (copy)" or " (copy N)" suffix, then append " (copy)"
      const baseName = fetchedWorkflow.name.replace(/ \(copy(?: \d+)?\)$/, '');
      const copyName = `${baseName} (copy)`;

      setWorkflow({ ...fetchedWorkflow, name: copyName });

      // Load raw ComfyUI JSON for the copied workflow's base file
      if (fetchedWorkflow.base) {
        try {
          const jsonRes = await fetch(`/api/workflows/base-files/${encodeURIComponent(fetchedWorkflow.base)}`);
          if (jsonRes.ok) {
            setWorkflowJson(await jsonRes.json());
          } else {
            setWorkflowJson({});
          }
        } catch {
          setWorkflowJson({});
        }
      }
    } catch (e) {
      toast.error(`Failed to duplicate workflow: ${e.message}`);
    }
  }

  async function handleUpload(file) {
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
      await loadBaseFiles();
      toast.success(`Uploaded "${data.workflow.name}"`);
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`);
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

  async function handleDelete(name) {
    if (!name) return;
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      if (workflow?.name === name) {
        setWorkflow(null);
        setWorkflowJson({});
      }
      await loadWorkflowList();
      toast.success('Workflow deleted');
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleBaseChange(filename) {
    try {
      const res = await fetch(`/api/workflows/base-files/${encodeURIComponent(filename)}`);
      if (res.ok) {
        setWorkflowJson(await res.json());
      } else {
        setWorkflowJson({});
      }
    } catch {
      setWorkflowJson({});
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
      <${AppHeader}>
        <${H1}>Workflow Editor</${H1}>
        <${HorizontalLayout} gap="small">
          <${Button}
            variant="medium-icon-text"
            icon="folder"
            color="secondary"
            onClick=${() => setIsModalOpen(true)}
          >
            Open
          </${Button}>
          <${HamburgerMenu} />
        </${HorizontalLayout}>
      </${AppHeader}>

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
              baseFiles=${baseFiles}
              onBaseChange=${handleBaseChange}
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
                if (t === 'template') return html`Template ${InlineArrowIcon} ${item.to || '?'}`;
                if (t === 'from')     return html`Copy ${item.from || '?'} ${InlineArrowIcon} ${item.to || '?'}`;
                if (t === 'model')    return html`LLM ${InlineArrowIcon} ${item.to || '?'}`;
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
              getTitle=${(item) => {
                if (!item.from) return 'New mapping';
                if (Array.isArray(item.to) && item.to.length === 3) {
                  const nodeId    = item.to[0];
                  const inputName = item.to[2];
                  const nodeTitle = workflowJson[nodeId]?._meta?.title ?? workflowJson[nodeId]?.class_type ?? nodeId;
                  return html`${item.from} ${InlineArrowIcon} ${nodeId}. ${nodeTitle} ${InlineArrowIcon} ${inputName}`;
                }
                return html`${item.from} ${InlineArrowIcon} ${Array.isArray(item.to) ? item.to.join('.') : (item.to || '?')}`;
              }}
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
                if (t === 'template')        return html`Template ${InlineArrowIcon} ${item.to || '?'}`;
                if (t === 'from')             return html`Copy ${item.from || '?'} ${InlineArrowIcon} ${item.to || '?'}`;
                if (t === 'model')            return html`LLM ${InlineArrowIcon} ${item.to || '?'}`;
                if (t === 'executeWorkflow')  return `Execute: ${item.parameters?.name || item.parameters?.workflow || '?'}`;
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
              onClick=${() => handleDelete(workflow.name)}
            >
              Delete
            </${Button}>
          </${HorizontalLayout}>
        `
      }

      <!-- Hidden file input for upload -->
      <input
        ref=${fileInputRef}
        type="file"
        accept=".json,application/json"
        style="display:none"
        onChange=${(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = '';
        }}
      />

      <!-- Workflow selection modal -->
      <${ListSelectModal}
        isOpen=${isModalOpen}
        onClose=${() => setIsModalOpen(false)}
        title="Workflows"
        variant="wide"
        items=${workflowList.map(wf => ({ id: wf.name, label: wf.name, icon: getWorkflowIcon(wf) }))}
        selectedId=${workflow?.name}
        onSelectItem=${(item) => { loadWorkflow(item.id); setIsModalOpen(false); }}
        itemActions=${[
          {
            icon: 'up-arrow',
            title: 'Move up',
            onClick: (item) => handleMoveWorkflow(item.id, -1),
            disabled: (item) => workflowList.findIndex(wf => wf.name === item.id) === 0,
            closeAfter: false,
          },
          {
            icon: 'down-arrow',
            title: 'Move down',
            onClick: (item) => handleMoveWorkflow(item.id, 1),
            disabled: (item) => workflowList.findIndex(wf => wf.name === item.id) === workflowList.length - 1,
            closeAfter: false,
          },
          {
            icon: 'copy',
            title: 'Duplicate',
            onClick: (item) => handleDuplicate(item.id),
            closeAfter: true,
          },
          {
            icon: 'trash',
            color: 'danger',
            title: 'Delete',
            onClick: (item) => handleDelete(item.id),
            closeAfter: false,
          },
        ]}
        actionLabel="Upload"
        onAction=${() => fileInputRef.current?.click()}
        emptyMessage=${listLoading ? 'Loading…' : 'No workflows yet. Click Upload to get started.'}
      />

    </${PageRoot}>
  `;
}
