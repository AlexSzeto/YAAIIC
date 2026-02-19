/**
 * node-input-selector.mjs – ComfyUI node + input picker using two Select dropdowns.
 *
 * Left select: chooses a root node from the workflow JSON (label = title, value = nodeId).
 * Right select: once a node is selected, lists its direct-value input fields.
 * Selecting a right-side input calls `onChange([nodeId, "inputs", inputName])`.
 */
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Select } from '../../custom-ui/io/select.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const SelectorRow = styled('div')`
  display: flex;
  gap: ${props => props.theme.spacing.small.gap};
  align-items: flex-start;
`;
SelectorRow.className = 'node-input-selector-row';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Return a display title for a ComfyUI node.
 */
function getNodeTitle(nodeId, node) {
  return node._meta?.title || node.title || node.class_type || `Node ${nodeId}`;
}

/**
 * Return the list of input keys whose values are plain (non-linked) values.
 */
function getNodeInputKeys(node) {
  if (!node.inputs || typeof node.inputs !== 'object') return [];
  return Object.entries(node.inputs)
    .filter(([, v]) => !Array.isArray(v))   // skip link arrays like [nodeId, slotIndex]
    .map(([k]) => k);
}

// ============================================================================
// NodeInputSelector Component
// ============================================================================

/**
 * NodeInputSelector – Two-select UI for choosing a node input path.
 *
 * @param {Object}   props
 * @param {Object}   props.workflowJson   - The ComfyUI workflow JSON object.
 * @param {Array}    [props.value]        - Current value: [nodeId, "inputs", inputName] or null.
 * @param {Function} props.onChange       - Called with [nodeId, "inputs", inputName] when a field is selected.
 * @returns {preact.VNode}
 */
export function NodeInputSelector({ workflowJson = {}, value = null, onChange }) {
  const theme = currentTheme.value;

  // Derive selected nodeId from the current value prop
  const selectedNodeId = value && Array.isArray(value) && value.length >= 1
    ? String(value[0])
    : '';
  const selectedInput = value && Array.isArray(value) && value.length >= 3
    ? value[2]
    : '';

  // Local state tracks node selection (may differ from persisted value during interaction)
  const [activeNodeId, setActiveNodeId] = useState(selectedNodeId);

  // Keep active node in sync when the external value changes
  useEffect(() => {
    setActiveNodeId(selectedNodeId);
  }, [selectedNodeId]);

  // Build node options from workflowJson (only nodes with a class_type)
  const nodeOptions = [
    { label: '— choose node —', value: '' },
    ...Object.entries(workflowJson)
      .filter(([, node]) => node && typeof node === 'object' && node.class_type)
      .map(([nodeId, node]) => ({
        label: `${getNodeTitle(nodeId, node)} (${nodeId})`,
        value: nodeId,
      })),
  ];

  // Build input options for the currently active node
  const activeNode = activeNodeId ? workflowJson[activeNodeId] : null;
  const inputKeys  = activeNode ? getNodeInputKeys(activeNode) : [];
  const inputOptions = [
    { label: '— choose input —', value: '' },
    ...inputKeys.map(k => ({ label: k, value: k })),
  ];

  const handleNodeChange = (e) => {
    const nodeId = e.target.value;
    setActiveNodeId(nodeId);
    // Clear the input selection when node changes
    if (nodeId !== selectedNodeId) {
      onChange(nodeId ? [nodeId, 'inputs', ''] : null);
    }
  };

  const handleInputChange = (e) => {
    const inputName = e.target.value;
    if (activeNodeId && inputName) {
      onChange([activeNodeId, 'inputs', inputName]);
    }
  };

  return html`
    <${SelectorRow} theme=${theme}>
      <${Select}
        options=${nodeOptions}
        value=${activeNodeId}
        onChange=${handleNodeChange}
        style=${{ maxWidth: '200px' }}
      />
      <${Select}
        options=${inputOptions}
        value=${selectedInput}
        disabled=${!activeNodeId || inputKeys.length === 0}
        onChange=${handleInputChange}
        style=${{ maxWidth: '200px' }}
      />
    </${SelectorRow}>
  `;
}
