/**
 * DynamicList.mjs – Reusable dynamic list with add/delete/reorder operations.
 *
 * Each item is rendered inside a collapsible panel with up/down/delete controls.
 * A caller-supplied render function generates the sub-form for each item.
 *
 * @module custom-ui/DynamicList
 */
import { html } from 'htm/preact';
import { useState, useCallback } from 'preact/hooks';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';
import { Button } from './io/button.mjs';
import { Icon } from './layout/icon.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const ListRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.small.gap};
`;
ListRoot.className = 'dynamic-list-root';

const ItemShell = styled('div')`
  border: ${props => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  border-radius: ${props => props.theme.spacing.medium.borderRadius};
  background-color: ${props => props.theme.colors.background.card};
  overflow: hidden;
`;
ItemShell.className = 'dynamic-list-item-shell';

const ItemHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background-color: ${props => props.theme.colors.background.secondary};
  cursor: pointer;
  user-select: none;

  &:hover {
    background-color: ${props => props.theme.colors.background.hover};
  }
`;
ItemHeader.className = 'dynamic-list-item-header';

const ItemTitle = styled('span')`
  flex: 1;
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  color: ${props => props.theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
ItemTitle.className = 'dynamic-list-item-title';

const ItemBody = styled('div')`
  padding: ${props => props.theme.spacing.medium.padding};
  display: ${props => props.collapsed ? 'none' : 'block'};
`;
ItemBody.className = 'dynamic-list-item-body';

const AddRow = styled('div')`
  display: flex;
  justify-content: flex-start;
`;
AddRow.className = 'dynamic-list-add-row';

// ============================================================================
// DynamicListItem Component
// ============================================================================

function DynamicListItem({
  item,
  index,
  total,
  title,
  renderItem,
  onMoveUp,
  onMoveDown,
  onDelete,
  theme,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const stopProp = useCallback((e) => e.stopPropagation(), []);

  return html`
    <${ItemShell} theme=${theme}>
      <${ItemHeader} theme=${theme} onClick=${() => setCollapsed(c => !c)}>
        <${Icon}
          name=${collapsed ? 'chevron-right' : 'chevron-down'}
          size="16px"
          color=${theme.colors.text.secondary}
        />
        <${ItemTitle} theme=${theme}>${title}</${ItemTitle}>
        <div onClick=${stopProp} style="display:flex;gap:4px;">
          <${Button}
            variant="small-icon"
            icon="up-arrow"
            disabled=${index === 0}
            onClick=${onMoveUp}
            title="Move up"
          />
          <${Button}
            variant="small-icon"
            icon="down-arrow"
            disabled=${index === total - 1}
            onClick=${onMoveDown}
            title="Move down"
          />
          <${Button}
            variant="small-icon"
            icon="trash"
            color="danger"
            onClick=${onDelete}
            title="Delete"
          />
        </div>
      </${ItemHeader}>
      <${ItemBody} theme=${theme} collapsed=${collapsed}>
        ${renderItem(item, index)}
      </${ItemBody}>
    </${ItemShell}>
  `;
}

// ============================================================================
// DynamicList Component
// ============================================================================

/**
 * DynamicList – Generic ordered list with add / delete / reorder controls.
 *
 * @param {Object}   props
 * @param {Array}    props.items           - Array of item data objects.
 * @param {Function} props.renderItem      - `(item, index) => VNode` sub-form renderer.
 * @param {Function} props.getTitle        - `(item, index) => string` item header label.
 * @param {Function} props.createItem      - `() => Object` factory for a blank new item.
 * @param {Function} props.onChange        - `(items) => void` called on every mutation.
 * @param {string}   [props.addLabel]      - Label for the add button (default "Add item").
 * @returns {preact.VNode}
 *
 * @example
 * html`
 *   <${DynamicList}
 *     items=${extraInputs}
 *     renderItem=${(item, i) => html`<${ExtraInputForm} item=${item} index=${i} onChange=${handleChange} />`}
 *     getTitle=${(item) => item.label || 'Untitled'}
 *     createItem=${() => ({ id: '', type: 'text', label: '', default: '' })}
 *     onChange=${setExtraInputs}
 *     addLabel="Add Input"
 *   />
 * `
 */
export function DynamicList({
  items = [],
  renderItem,
  getTitle,
  createItem,
  onChange,
  addLabel = 'Add item',
}) {
  const theme = currentTheme.value;

  const handleAdd = useCallback(() => {
    onChange([...items, createItem()]);
  }, [items, createItem, onChange]);

  const handleDelete = useCallback((index) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  }, [items, onChange]);

  const handleMoveUp = useCallback((index) => {
    if (index === 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }, [items, onChange]);

  const handleMoveDown = useCallback((index) => {
    if (index === items.length - 1) return;
    const next = [...items];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }, [items, onChange]);

  return html`
    <${ListRoot} theme=${theme}>
      <${AddRow}>
        <${Button}
          variant="medium-icon-text"
          icon="plus"
          color="primary"
          onClick=${handleAdd}
        >
          ${addLabel}
        </${Button}>
      </${AddRow}>

      ${items.map((item, index) => html`
        <${DynamicListItem}
          key=${index}
          item=${item}
          index=${index}
          total=${items.length}
          title=${getTitle(item, index)}
          renderItem=${renderItem}
          onMoveUp=${() => handleMoveUp(index)}
          onMoveDown=${() => handleMoveDown(index)}
          onDelete=${() => handleDelete(index)}
          theme=${theme}
        />
      `)}
    </${ListRoot}>
  `;
}
