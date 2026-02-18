/**
 * NodeInputSelector.mjs – ComfyUI node search + input picker.
 *
 * Two-step UI:
 *  1. Autocomplete text field that searches workflow nodes by ID, title, or class_type.
 *  2. After selecting a node, a dropdown panel lists its input property names;
 *     clicking one fills in the full `[nodeId, "inputs", inputName]` path.
 */
import { html } from 'htm/preact';
import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const Root = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
`;
Root.className = 'node-input-selector-root';

const SearchInput = styled('input')`
  padding: 8px 10px;
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
SearchInput.className = 'node-search-input';

const DropdownList = styled('div')`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  border: ${props => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  background-color: ${props => props.theme.colors.background.card};
  box-shadow: ${props => props.theme.shadow.elevated};
`;
DropdownList.className = 'node-dropdown-list';

const DropdownItem = styled('div')`
  padding: 8px 12px;
  cursor: pointer;
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  color: ${props => props.theme.colors.text.primary};

  &:hover {
    background-color: ${props => props.theme.colors.background.hover};
  }
`;
DropdownItem.className = 'node-dropdown-item';

const SubLabel = styled('span')`
  font-size: ${props => props.theme.typography.fontSize.small};
  color: ${props => props.theme.colors.text.secondary};
  margin-left: 6px;
`;
SubLabel.className = 'node-sublabel';

const InputPanel = styled('div')`
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  border: ${props => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  background-color: ${props => props.theme.colors.background.card};
  overflow: hidden;
`;
InputPanel.className = 'node-input-panel';

const InputPanelHeader = styled('div')`
  padding: 6px 10px;
  background-color: ${props => props.theme.colors.background.secondary};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.small};
  font-weight: ${props => props.theme.typography.fontWeight.bold};
  color: ${props => props.theme.colors.text.secondary};
`;
InputPanelHeader.className = 'node-input-panel-header';

const InputPanelItem = styled('div')`
  padding: 6px 10px;
  cursor: pointer;
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  color: ${props => props.theme.colors.primary.background};

  &:hover {
    background-color: ${props => props.theme.colors.background.hover};
  }
`;
InputPanelItem.className = 'node-input-panel-item';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get a display-friendly title for a ComfyUI node.
 * @param {string} nodeId
 * @param {Object} node
 * @returns {string}
 */
function getNodeTitle(nodeId, node) {
  return node._meta?.title || node.title || node.class_type || `Node ${nodeId}`;
}

/**
 * Return the list of input keys for a node that are plain values (not links).
 * @param {Object} node
 * @returns {string[]}
 */
function getNodeInputKeys(node) {
  if (!node.inputs || typeof node.inputs !== 'object') return [];
  return Object.entries(node.inputs)
    .filter(([, v]) => !Array.isArray(v))  // skip link arrays like [nodeId, slotIndex]
    .map(([k]) => k);
}

// ============================================================================
// NodeInputSelector Component
// ============================================================================

/**
 * NodeInputSelector – two-step node + input picker for replace mappings.
 *
 * @param {Object}   props
 * @param {Object}   props.workflowJson   - The uploaded ComfyUI workflow JSON object.
 * @param {Array}    [props.value]        - Current value: [nodeId, "inputs", inputName] or null.
 * @param {Function} props.onChange       - Called with [nodeId, "inputs", inputName] when selected.
 * @param {string}   [props.placeholder]  - Placeholder for search input.
 * @returns {preact.VNode}
 */
export function NodeInputSelector({
  workflowJson = {},
  value = null,
  onChange,
  placeholder = 'Search node by ID, name, or type…',
}) {
  const theme = currentTheme.value;

  // Display text: either the currently selected path or blank for new searches
  const [query,         setQuery]        = useState('');
  const [results,       setResults]      = useState([]);
  const [selectedNode,  setSelectedNode] = useState(null); // { nodeId, node }
  const [showDropdown,  setShowDropdown] = useState(false);
  const rootRef = useRef(null);

  // Initialise display from current value
  useEffect(() => {
    if (value && Array.isArray(value) && value.length >= 1) {
      const nodeId = value[0];
      const node   = workflowJson[nodeId];
      if (node) {
        setSelectedNode({ nodeId, node });
        setQuery(getNodeTitle(nodeId, node));
      } else {
        setQuery(String(nodeId));
      }
    } else {
      setQuery('');
      setSelectedNode(null);
    }
  }, []); // only on mount

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = useCallback((e) => {
    const q = e.target.value;
    setQuery(q);
    setSelectedNode(null);

    if (!q.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const lower = q.toLowerCase();
    const hits = [];
    for (const [nodeId, node] of Object.entries(workflowJson)) {
      if (typeof node !== 'object' || !node.class_type) continue;
      const title = getNodeTitle(nodeId, node);
      if (
        nodeId.toLowerCase().includes(lower) ||
        title.toLowerCase().includes(lower) ||
        node.class_type.toLowerCase().includes(lower)
      ) {
        hits.push({ nodeId, node, title });
      }
    }
    setResults(hits.slice(0, 20));
    setShowDropdown(true);
  }, [workflowJson]);

  const handleSelectNode = useCallback((nodeId, node) => {
    setSelectedNode({ nodeId, node });
    setQuery(getNodeTitle(nodeId, node));
    setShowDropdown(false);
    setResults([]);
  }, []);

  const handleSelectInput = useCallback((inputName) => {
    if (!selectedNode) return;
    onChange([selectedNode.nodeId, 'inputs', inputName]);
  }, [selectedNode, onChange]);

  const inputKeys = selectedNode ? getNodeInputKeys(selectedNode.node) : [];

  return html`
    <${Root} ref=${rootRef}>
      <${SearchInput}
        theme=${theme}
        value=${query}
        onInput=${handleSearch}
        onFocus=${() => query && setShowDropdown(results.length > 0)}
        placeholder=${placeholder}
      />

      ${showDropdown && results.length > 0 && html`
        <${DropdownList} theme=${theme}>
          ${results.map(({ nodeId, node, title }) => html`
            <${DropdownItem}
              key=${nodeId}
              theme=${theme}
              onClick=${() => handleSelectNode(nodeId, node)}
            >
              ${title}
              <${SubLabel} theme=${theme}>${node.class_type} (${nodeId})</${SubLabel}>
            </${DropdownItem}>
          `)}
        </${DropdownList}>
      `}

      ${selectedNode && inputKeys.length > 0 && html`
        <${InputPanel} theme=${theme}>
          <${InputPanelHeader} theme=${theme}>
            ${getNodeTitle(selectedNode.nodeId, selectedNode.node)} – select an input:
          </${InputPanelHeader}>
          ${inputKeys.map(key => html`
            <${InputPanelItem}
              key=${key}
              theme=${theme}
              onClick=${() => handleSelectInput(key)}
            >
              ${key}
            </${InputPanelItem}>
          `)}
        </${InputPanel}>
      `}
    </${Root}>
  `;
}
