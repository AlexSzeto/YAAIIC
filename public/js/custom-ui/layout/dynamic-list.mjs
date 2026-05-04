/**
 * dynamic-list.mjs – Reusable dynamic list with add/delete/reorder operations.
 *
 * Each item is rendered inside a collapsible panel with up/down/delete controls.
 * A caller-supplied render function generates the sub-form for each item.
 * An optional `title` prop renders a section header row with the add button
 * aligned to the right edge of that row.
 *
 * Drag-to-reorder: pressing the swap-vertical handle collapses the item into a
 * slim ghost that follows the mouse. Releasing drops it in the hovered position.
 *
 * @module custom-ui/layout/dynamic-list
 */
import { html } from 'htm/preact';
import { useState, useCallback, useRef } from 'preact/hooks';
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
  position: relative;
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
  gap: ${props => props.theme.spacing.small.gap};
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

const CondensedItemRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.small.gap};
`;
CondensedItemRow.className = 'dynamic-list-condensed-item-row';

const CondensedItemContent = styled('div')`
  flex: 1;
  min-width: 0;
`;
CondensedItemContent.className = 'dynamic-list-condensed-item-content';

// Ghost overlay that floats under the cursor while dragging
const DragGhost = styled('div')`
  position: fixed;
  pointer-events: none;
  z-index: 20000;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  width: ${props => props.width}px;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.small.gap};
  padding: ${props => props.theme.spacing.small.padding};
  min-height: 44px;
  border: ${props => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.accent || props.theme.colors.border.secondary}`};
  border-radius: ${props => props.theme.spacing.medium.borderRadius};
  background-color: ${props => props.theme.colors.background.secondary};
  box-shadow: ${props => props.theme.shadow.elevated};
  opacity: 0.92;
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  color: ${props => props.theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
DragGhost.className = 'dynamic-list-drag-ghost';

// Placeholder shown in the list while dragging
const DragPlaceholder = styled('div')`
  border: 2px dashed ${props => props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.spacing.medium.borderRadius};
  min-height: 44px;
  background: transparent;
`;
DragPlaceholder.className = 'dynamic-list-drag-placeholder';

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
  onDragStart,
  initialCollapsed = true,
  isDragTarget,
  showDragButton,
  showMoveUpDownButtons,
  headerActions,
  getEnabled,
  onToggleEnabled,
  theme,
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const stopProp = useCallback((e) => e.stopPropagation(), []);

  const handleDragMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onDragStart(e, index, title);
  }, [onDragStart, index, title]);

  const handleToggleEnabled = useCallback((e) => {
    e.stopPropagation();
    if (onToggleEnabled) onToggleEnabled(item, index);
  }, [item, index, onToggleEnabled]);

  return html`
    <${ItemShell} theme=${theme} style=${isDragTarget ? { opacity: 0.3 } : {}}>
      <${ItemHeader} theme=${theme} onClick=${() => setCollapsed(c => !c)}>
        <${Icon}
          name=${collapsed ? 'chevron-right' : 'chevron-down'}
          size="16px"
          color=${theme.colors.text.secondary}
        />
        ${getEnabled != null && html`
          <input
            type="checkbox"
            checked=${getEnabled(item, index)}
            onClick=${handleToggleEnabled}
            onChange=${() => {}}
            style=${{ margin: 0, cursor: 'pointer', flexShrink: 0 }}
          />
        `}
        <${ItemTitle} theme=${theme}>${title}</${ItemTitle}>
        <div onClick=${stopProp} style="display:flex;gap:4px;">
          ${headerActions && headerActions.map(action => html`
            <${Button}
              variant="small-icon"
              icon=${action.icon}
              onClick=${(e) => { e.stopPropagation(); action.onClick(item, index); }}
              tooltip=${action.title}
            />
          `)}
          ${showDragButton && html`
            <${Button}
              variant="small-icon"
              icon="swap-vertical"
              onMouseDown=${handleDragMouseDown}
              tooltip="Drag to reorder"
              style=${{ cursor: 'grab' }}
            />
          `}
          ${showMoveUpDownButtons && html`
            <${Button}
              variant="small-icon"
              icon="up-arrow"
              disabled=${index === 0}
              onClick=${onMoveUp}
              tooltip="Move up"
            />
            <${Button}
              variant="small-icon"
              icon="down-arrow"
              disabled=${index === total - 1}
              onClick=${onMoveDown}
              tooltip="Move down"
            />
          `}
          <${Button}
            variant="small-icon"
            icon="trash"
            color="danger"
            onClick=${onDelete}
            tooltip="Delete"
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
// CondensedDynamicListItem Component
// ============================================================================

/**
 * Condensed variant: no panel/shell, no collapse toggle.
 * Content sits directly to the left of the action buttons in a single row.
 */
function CondensedDynamicListItem({
  item,
  index,
  total,
  renderItem,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragStart,
  isDragTarget,
  showDragButton,
  showMoveUpDownButtons,
  headerActions,
  getEnabled,
  onToggleEnabled,
  theme,
}) {
  const handleDragMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    // For condensed mode, pass generic label
    onDragStart(e, index, `Item ${index + 1}`);
  }, [onDragStart, index]);

  return html`
    <${CondensedItemRow} theme=${theme} style=${isDragTarget ? { opacity: 0.3 } : {}}>
      ${getEnabled != null && html`
        <input
          type="checkbox"
          checked=${getEnabled(item, index)}
          onChange=${() => { if (onToggleEnabled) onToggleEnabled(item, index); }}
          style=${{ margin: 0, cursor: 'pointer', flexShrink: 0, alignSelf: 'center' }}
        />
      `}
      <${CondensedItemContent}>
        ${renderItem(item, index)}
      </${CondensedItemContent}>
      <div style="display:flex;gap:4px;flex-shrink:0;align-self:flex-end;">
        ${headerActions && headerActions.map(action => html`
          <${Button}
            variant="small-icon"
            icon=${action.icon}
            onClick=${(e) => { e.stopPropagation(); action.onClick(item, index); }}
            tooltip=${action.title}
          />
        `)}
        ${showDragButton && html`
          <${Button}
            variant="small-icon"
            icon="swap-vertical"
            onMouseDown=${handleDragMouseDown}
            tooltip="Drag to reorder"
            style=${{ cursor: 'grab' }}
          />
        `}
        ${showMoveUpDownButtons && html`
          <${Button}
            variant="small-icon"
            icon="up-arrow"
            disabled=${index === 0}
            onClick=${onMoveUp}
            tooltip="Move up"
          />
          <${Button}
            variant="small-icon"
            icon="down-arrow"
            disabled=${index === total - 1}
            onClick=${onMoveDown}
            tooltip="Move down"
          />
        `}
        <${Button}
          variant="small-icon"
          icon="trash"
          color="danger"
          onClick=${onDelete}
          tooltip="Delete"
        />
      </div>
    </${CondensedItemRow}>
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
 * When `condensed` is true, items are rendered without a panel container or
 * collapse toggle. Content sits directly to the left of the action buttons.
 * This mode is suited for compact sub-lists (e.g. string arrays, simple mappings).
 *
 * Drag-to-reorder: clicking the swap-vertical button collapses the item into a
 * slim ghost that follows the mouse. Moving over other items reorders the list
 * live. Releasing the mouse commits the final position.
 *
 * @param {Object}   props
 * @param {string}   [props.title]               - Optional section title rendered in the header row.
 * @param {Array}    props.items                 - Array of item data objects.
 * @param {Function} props.renderItem            - `(item, index) => VNode` sub-form renderer.
 * @param {Function} [props.getTitle]            - `(item, index) => string` item header label (unused in condensed mode).
 * @param {Function} props.createItem            - `() => Object` factory for a blank new item.
 * @param {Function} props.onChange              - `(items) => void` called on every mutation.
 * @param {string}   [props.addLabel]            - Label for the add button (default "Add item").
 * @param {boolean}  [props.condensed=false]     - Use condensed inline layout (no panel, no collapse).
 * @param {boolean}  [props.showDragButton=true] - Show the drag-to-reorder handle button.
 * @param {boolean}  [props.showMoveUpDownButtons=false] - Show the move-up / move-down buttons.
 * @param {Array}    [props.headerActions]       - Custom header action buttons: `[{ icon, title, onClick(item, index) }]`.
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
  condensed = false,
  onAdd,                      // optional: () => void – replaces default handleAdd when provided
  showDragButton = true,      // show the swap-vertical drag handle
  showMoveUpDownButtons = false, // show the up/down arrow buttons
  headerActions,               // custom header action buttons
  getEnabled,                  // optional: (item, index) => boolean – enables per-item toggle checkbox
  onToggleEnabled,             // optional: (item, index) => void – called when enabled checkbox changes
}) {
  const theme = currentTheme.value;

  // Track which index was just added so that item mounts uncollapsed.
  const newlyAddedIndexRef = useRef(null);

  // Keep a ref to items so drag handlers always see the latest array.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Stable id so we can find the list DOM node via document.getElementById.
  const listIdRef = useRef('dynamic-list-' + Math.random().toString(36).slice(2));
  const listId = listIdRef.current;

  // ── Drag state ────────────────────────────────────────────────────────────
  // All kept in refs so mouse-move handlers don't cause re-renders.
  const dragRef = useRef({
    active: false,
    fromIndex: -1,
    toIndex: -1,
    title: '',
    ghostX: 0,
    ghostY: 0,
    offsetX: 0,      // cursor offset from item's left edge
    offsetY: 0,      // cursor offset from item's top edge
    listWidth: 0,
  });

  // The only state needed for rendering: ghost position + which indices are involved.
  const [dragState, setDragState] = useState(null); // null = not dragging
  // dragState shape: { fromIndex, toIndex, ghostX, ghostY, width, title }

  // ── Standard mutations ────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    newlyAddedIndexRef.current = items.length;
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

  // ── Drag helpers ──────────────────────────────────────────────────────────

  /**
   * Compute which virtual drop index the cursor is hovering over.
   *
   * We query only the non-source [data-dli] wrappers (i.e. the N-1 items that
   * are NOT being dragged). This gives us a clean "virtual array" of slots 0..N-1
   * where N-1 means "after all items".
   *
   * The physical position where the placeholder is inserted is then:
   *   toIndex < fromIndex  → before physical item at toIndex
   *   toIndex >= fromIndex → before physical item at toIndex+1 (or at end)
   */
  const computeDropIndex = useCallback((clientY) => {
    const root = document.getElementById(listId);
    if (!root) return 0;
    // All [data-dli] children are the N-1 non-source items (source is not rendered during drag).
    const children = Array.from(root.querySelectorAll(':scope > [data-dli]'));
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) return i;
    }
    // Cursor is past every item → "append at end" slot
    return children.length;
  }, [listId]);

  const handleDragStart = useCallback((e, index, itemTitle) => {
    const root = document.getElementById(listId);
    if (!root) return;
    
    // Find the item shell element for this index
    const itemElements = Array.from(root.querySelectorAll(':scope > [data-dli]'));
    console.log('🐛 Found items:', itemElements.length, 'dragging index:', index);
    const itemElement = itemElements[index];
    if (!itemElement) {
      console.error('🐛 Item element not found for index:', index);
      return;
    }
    
    const itemRect = itemElement.getBoundingClientRect();
    const listRect = root.getBoundingClientRect();
    
    console.log('🐛 Drag Debug:', {
      clickX: e.clientX,
      clickY: e.clientY,
      itemLeft: itemRect.left,
      itemTop: itemRect.top,
      itemWidth: itemRect.width,
      itemHeight: itemRect.height,
    });
    
    // Calculate offset from mouse position to item's top-left corner
    const offsetX = e.clientX - itemRect.left;
    const offsetY = e.clientY - itemRect.top;

    // Initial ghost position: item's position
    const ghostX = itemRect.left;
    const ghostY = itemRect.top;
    
    console.log('🐛 Ghost Initial:', { ghostX, ghostY, offsetX, offsetY });

    dragRef.current = {
      active: true,
      fromIndex: index,
      toIndex: index,
      title: itemTitle,
      ghostX,
      ghostY,
      offsetX,
      offsetY,
      listWidth: listRect.width,
    };

    setDragState({
      fromIndex: index,
      toIndex: index,
      ghostX,
      ghostY,
      width: listRect.width,
      title: itemTitle,
    });

    const onMouseMove = (ev) => {
      const dr = dragRef.current;
      if (!dr.active) return;

      // Ghost position = mouse position - offset to maintain pickup point
      const gx = ev.clientX - dr.offsetX;
      const gy = ev.clientY - dr.offsetY;
      dr.ghostX = gx;
      dr.ghostY = gy;

      const newTo = computeDropIndex(ev.clientY);
      if (newTo !== dr.toIndex) {
        dr.toIndex = newTo;
      }

      setDragState(prev => prev ? {
        ...prev,
        toIndex: newTo,
        ghostX: gx,
        ghostY: gy,
      } : null);
    };

    const onMouseUp = () => {
      const dr = dragRef.current;
      if (!dr.active) return;
      dr.active = false;

      const from = dr.fromIndex;
      const to = dr.toIndex;

      setDragState(null);

      if (from !== to) {
        // Use itemsRef.current so we never capture a stale items array.
        const next = [...itemsRef.current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onChange(next);
      }

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [items, onChange, computeDropIndex]);

  // ── Add button ────────────────────────────────────────────────────────────

  const addButton = html`
    <${Button}
      variant="small-icon"
      icon="plus"
      color="secondary"
      onClick=${onAdd ?? handleAdd}
    >
    </${Button}>
  `;

  // ── Drag ghost overlay ────────────────────────────────────────────────────

  const ghostOverlay = dragState ? html`
    <${DragGhost}
      theme=${theme}
      x=${dragState.ghostX}
      y=${dragState.ghostY}
      width=${dragState.width}
    >
      <${Icon} name="swap-vertical" size="16px" color=${theme.colors.text.secondary} />
      ${dragState.title}
    </${DragGhost}>
  ` : null;

  // ── Render ────────────────────────────────────────────────────────────────

  /**
   * Build the ordered item list, inserting a placeholder at the drop target.
   * When dragging, the source item is rendered faded in its original slot
   * and a placeholder appears at the toIndex position showing where it will land.
   * Each item is wrapped in a plain div with data-dli so computeDropIndex can
   * find them without counting the header/add-button row.
   */
  const renderItems = () => {
    if (!dragState) {
      // Normal (non-drag) render
      return items.map((item, index) => {
        const isNew = newlyAddedIndexRef.current === index;
        if (isNew) newlyAddedIndexRef.current = null;

        return html`<div key=${index} data-dli>
          ${condensed
            ? html`
              <${CondensedDynamicListItem}
                item=${item}
                index=${index}
                total=${items.length}
                renderItem=${renderItem}
                onMoveUp=${() => handleMoveUp(index)}
                onMoveDown=${() => handleMoveDown(index)}
                onDelete=${() => handleDelete(index)}
                onDragStart=${handleDragStart}
                isDragTarget=${false}
                showDragButton=${showDragButton}
                showMoveUpDownButtons=${showMoveUpDownButtons}
                headerActions=${headerActions}
                getEnabled=${getEnabled}
                onToggleEnabled=${onToggleEnabled}
                theme=${theme}
              />
            `
            : html`
              <${DynamicListItem}
                item=${item}
                index=${index}
                total=${items.length}
                title=${getTitle(item, index)}
                renderItem=${renderItem}
                onMoveUp=${() => handleMoveUp(index)}
                onMoveDown=${() => handleMoveDown(index)}
                onDelete=${() => handleDelete(index)}
                onDragStart=${handleDragStart}
                isDragTarget=${false}
                initialCollapsed=${!isNew}
                showDragButton=${showDragButton}
                showMoveUpDownButtons=${showMoveUpDownButtons}
                headerActions=${headerActions}
                getEnabled=${getEnabled}
                onToggleEnabled=${onToggleEnabled}
                theme=${theme}
              />
            `
          }
        </div>`;
      });
    }

    // During drag: source item is shown faded; a standalone placeholder appears
    // at the computed drop position as an independent flex child (so the ListRoot
    // gap applies uniformly).
    const { fromIndex, toIndex } = dragState;

    // Physical slot where the placeholder is inserted as a standalone child:
    //   • Dragging up  (toIndex < fromIndex): placeholder goes BEFORE physical toIndex
    //   • Dragging down (toIndex ≥ fromIndex): placeholder goes BEFORE physical toIndex+1
    //     (i.e. AFTER the last item the cursor passed, which visually matches expectation)
    const physicalSlot = toIndex < fromIndex ? toIndex : toIndex + 1;

    const result = [];

    for (let index = 0; index < items.length; index++) {
      // Skip the source item entirely – the placeholder takes its visual slot.
      if (index === fromIndex) continue;

      const item = items[index];
      const isNew = newlyAddedIndexRef.current === index;
      if (isNew) newlyAddedIndexRef.current = null;

      // Emit the placeholder as a standalone sibling BEFORE this physical slot.
      if (index === physicalSlot) {
        result.push(html`<${DragPlaceholder} key="placeholder" theme=${theme} />`);
      }

      const innerNode = condensed
        ? html`
          <${CondensedDynamicListItem}
            item=${item}
            index=${index}
            total=${items.length}
            renderItem=${renderItem}
            onMoveUp=${() => handleMoveUp(index)}
            onMoveDown=${() => handleMoveDown(index)}
            onDelete=${() => handleDelete(index)}
            onDragStart=${handleDragStart}
            isDragTarget=${false}
            showDragButton=${showDragButton}
            showMoveUpDownButtons=${showMoveUpDownButtons}
            headerActions=${headerActions}
            getEnabled=${getEnabled}
            onToggleEnabled=${onToggleEnabled}
            theme=${theme}
          />
        `
        : html`
          <${DynamicListItem}
            item=${item}
            index=${index}
            total=${items.length}
            title=${getTitle(item, index)}
            renderItem=${renderItem}
            onMoveUp=${() => handleMoveUp(index)}
            onMoveDown=${() => handleMoveDown(index)}
            onDelete=${() => handleDelete(index)}
            onDragStart=${handleDragStart}
            isDragTarget=${false}
            initialCollapsed=${!isNew}
            showDragButton=${showDragButton}
            showMoveUpDownButtons=${showMoveUpDownButtons}
            headerActions=${headerActions}
            getEnabled=${getEnabled}
            onToggleEnabled=${onToggleEnabled}
            theme=${theme}
          />
        `;

      result.push(html`<div key=${'item-' + index} data-dli>${innerNode}</div>`);
    }

    // Placeholder at the very end (cursor past all items).
    if (physicalSlot >= items.length) {
      result.push(html`<${DragPlaceholder} key="placeholder" theme=${theme} />`);
    }

    return result;
  };

  return html`
    <${ListRoot} theme=${theme} id=${listId}>
      ${title
        ? html`
          <${ListHeader}>
            <${ListTitle} theme=${theme}>${title}</${ListTitle}>
            ${addButton}
          </${ListHeader}>
        `
        : addButton
      }

      ${renderItems()}
    </${ListRoot}>

    ${ghostOverlay}
  `;
}
