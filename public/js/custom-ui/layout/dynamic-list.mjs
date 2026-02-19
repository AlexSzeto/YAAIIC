/**
 * dynamic-list.mjs – Reusable dynamic list with add/delete/reorder operations.
 *
 * Each item is rendered inside a collapsible panel with up/down/delete controls.
 * A caller-supplied render function generates the sub-form for each item.
 * An optional `title` prop renders a section header row with the add button
 * aligned to the right edge of that row.
 *
 * @module custom-ui/layout/dynamic-list
 */
import { html } from 'htm/preact';
import { useState, useCallback } from 'preact/hooks';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';
import { Icon } from '../layout/icon.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const ListRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.small.gap};
`;
ListRoot.className = 'dynamic-list-root';

const ListHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0;
`;
ListHeader.className = 'dynamic-list-header';

const ListTitle = styled('span')`
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.large};
  font-weight: ${props => props.theme.typography.fontWeight.bold};
  color: ${props => props.theme.colors.text.primary};
`;
ListTitle.className = 'dynamic-list-title';

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
  padding: ${props => props.theme.spacing.small.padding};
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
  const [collapsed, setCollapsed] = useState(true);

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
 * When `title` is provided, it renders a header row with the title on the left
 * and the add button on the right (`small-icon-text`). Without a title, the
 * add button renders inline above the items.
 *
 * @param {Object}   props
 * @param {string}   [props.title]          - Optional section title rendered in the header row.
 * @param {Array}    props.items            - Array of item data objects.
 * @param {Function} props.renderItem       - `(item, index) => VNode` sub-form renderer.
 * @param {Function} props.getTitle         - `(item, index) => string` item header label.
 * @param {Function} props.createItem       - `() => Object` factory for a blank new item.
 * @param {Function} props.onChange         - `(items) => void` called on every mutation.
 * @param {string}   [props.addLabel]       - Label for the add button (default "Add item").
 * @returns {preact.VNode}
 *
 * @example
 * html`
 *   <${DynamicList}
 *     title="Extra Inputs"
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
  title,
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

  const addButton = html`
    <${Button}
      variant="small-icon-text"
      icon="plus"
      color="primary"
      onClick=${handleAdd}
    >
      ${addLabel}
    </${Button}>
  `;

  return html`
    <${ListRoot} theme=${theme}>
      ${title
        ? html`
          <${ListHeader}>
            <${ListTitle} theme=${theme}>${title}</${ListTitle}>
            ${addButton}
          </${ListHeader}>
        `
        : addButton
      }

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
