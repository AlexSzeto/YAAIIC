/**
 * search-select.mjs – Generic search-and-select modal for large datasets.
 *
 * Supports single-select and multi-select modes. Items can be strings or
 * `{ label, value }` objects. Filters are applied in real-time, sorted
 * alphabetically. A `displayLimit` caps the number of rendered items.
 *
 * @example
 * // Single-select
 * <${SearchSelectModal}
 *   isOpen=${true}
 *   title="Select a Plot"
 *   items=${['Alpha', 'Beta', 'Gamma']}
 *   mode="single"
 *   onSelect=${(value) => console.log('Selected:', value)}
 *   onClose=${() => setOpen(false)}
 * />
 *
 * @example
 * // Multi-select with initial selection
 * <${SearchSelectModal}
 *   isOpen=${true}
 *   title="Select Parts"
 *   items=${[{ label: 'Hair', value: 'hair-uid' }, { label: 'Eyes', value: 'eyes-uid' }]}
 *   mode="multi"
 *   initialSelected=${['hair-uid']}
 *   onSelect=${(values) => console.log('Selection:', values)}
 *   onClose=${() => setOpen(false)}
 * />
 */
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';
import { Checkbox } from '../io/checkbox.mjs';
import { BaseOverlay, BaseContainer, BaseHeader, BaseTitle, BaseFooter } from './modal-base.mjs';
import { Icon } from '../layout/icon.mjs';
import { H2, HorizontalLayout } from '../themed-base.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const ModalWrapper = styled('div')`
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
`;
ModalWrapper.className = 'search-select-wrapper';

const SearchBar = styled('div')`
  margin-bottom: 16px;
`;
SearchBar.className = 'search-select-search-bar';

const SearchInput = styled('input')`
  width: 100%;
  padding: ${props => props.padding};
  border-radius: 6px;
  border: ${props => props.border};
  background-color: ${props => props.bgColor};
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-family: ${props => props.fontFamily};
  box-sizing: border-box;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.focusColor};
  }
`;
SearchInput.className = 'search-select-input';

const ItemList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
  min-height: 150px;
  max-height: 380px;
`;
ItemList.className = 'search-select-item-list';

const EmptyMessage = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-style: italic;
`;
EmptyMessage.className = 'search-select-empty';

// Single-select item: rectangular clickable button row
const SingleItem = styled('button')`
  width: calc(100% - 8px);
  text-align: left;
  background: none;
  border: none;
  padding: 10px 12px 10px 20px;
  margin-right: 8px;
  cursor: pointer;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-family: ${props => props.fontFamily};
  transition: background-color ${props => props.transition};
  box-sizing: border-box;

  &:hover {
    background-color: ${props => props.hoverBg};
    border-radius: ${props => props.hoverBorderRadius};
  }

  &:focus {
    outline: none;
    background-color: ${props => props.hoverBg};
  }
`;
SingleItem.className = 'search-select-single-item';


// Multi-select item row
const MultiItem = styled('div')`
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 10px 12px 10px 16px;
  margin-right: 8px;
  cursor: pointer;
  gap: 10px;
  transition: background-color ${props => props.transition};

  &:hover {
    background-color: ${props => props.hoverBg};
    border-radius: ${props => props.hoverBorderRadius};
  }
`;
MultiItem.className = 'search-select-multi-item';

// Stacks label + subtitle for multi-select items
const MultiItemContent = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 2px;
`;
MultiItemContent.className = 'search-select-multi-item-content';

const MultiItemLabel = styled('span')`
  font-family: ${props => props.fontFamily};
  font-size: ${props => props.fontSize};
  color: ${props => props.color};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
MultiItemLabel.className = 'search-select-multi-item-label';

const MultiItemSubtitle = styled('span')`
  font-family: ${props => props.fontFamily};
  font-size: ${props => props.fontSize};
  color: ${props => props.color};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
MultiItemSubtitle.className = 'search-select-multi-item-subtitle';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalise items: always returns an array of { label: string, value: any, subtitle: string }.
 * Accepts string arrays or { label, value, subtitle? } object arrays.
 *
 * @param {Array<string|{label:string, value:any, subtitle?:string}>} items
 * @returns {{ label: string, value: any, subtitle: string }[]}
 */
function normaliseItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item =>
    typeof item === 'string'
      ? { label: item, value: item, subtitle: '' }
      : { label: String(item.label ?? item.value ?? ''), value: item.value, subtitle: item.subtitle ? String(item.subtitle) : '' }
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * SearchSelectModal – Modal for browsing, filtering, and selecting items.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen           – Whether modal is visible
 * @param {string}   props.title            – Modal title
 * @param {Array<string|{label,value,subtitle?}>} props.items – Data source; subtitle is rendered right-aligned in secondary color
 * @param {'single'|'multi'} [props.mode='single'] – Selection mode
 * @param {number}   [props.displayLimit=100]       – Max items to render
 * @param {string|string[]} [props.initialSelected] – Initially selected value(s)
 * @param {Function} props.onSelect          – Callback on item selection
 * @param {Function} props.onClose           – Callback to close modal
 */
export function SearchSelectModal({
  isOpen,
  title = 'Select',
  items = [],
  mode = 'single',
  displayLimit = 100,
  initialSelected,
  onSelect,
  onClose,
}) {
  const theme = currentTheme.value;

  // ── Filter state ────────────────────────────────────────────────────────
  const [filter, setFilter] = useState('');

  // ── Multi-select state ──────────────────────────────────────────────────
  const [selected, setSelected] = useState(() => {
    if (mode !== 'multi') return new Set();
    if (Array.isArray(initialSelected)) return new Set(initialSelected);
    if (initialSelected != null) return new Set([initialSelected]);
    return new Set();
  });

  // Sync selected with initialSelected when modal opens or initialSelected changes
  useEffect(() => {
    if (!isOpen || mode !== 'multi') return;
    if (Array.isArray(initialSelected)) {
      setSelected(new Set(initialSelected));
    } else if (initialSelected != null) {
      setSelected(new Set([initialSelected]));
    } else {
      setSelected(new Set());
    }
  }, [isOpen, initialSelected, mode]);

  // Reset filter on open
  useEffect(() => {
    if (isOpen) setFilter('');
  }, [isOpen]);

  // ── Keyboard: Escape to close ───────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // ── Auto-focus search input (goober-styled-ref rule: use id + getElementById) ─
  const inputIdRef = useRef('search-select-input-' + Math.random().toString(36).slice(2));
  useEffect(() => {
    if (!isOpen) return;
    // Defer slightly to let the DOM settle
    const id = setTimeout(() => {
      const el = document.getElementById(inputIdRef.current);
      if (el) el.focus();
    }, 30);
    return () => clearTimeout(id);
  }, [isOpen]);

  // ── Compute filtered + sorted list ─────────────────────────────────────
  const normalisedItems = normaliseItems(items);
  const lowerFilter = filter.toLowerCase();
  const filtered = normalisedItems
    .filter(item => item.label.toLowerCase().includes(lowerFilter) || item.subtitle.toLowerCase().includes(lowerFilter))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, displayLimit);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose?.();
  }, [onClose]);

  const handleSingleSelect = useCallback((value) => {
    onSelect?.(value);
    onClose?.();
  }, [onSelect, onClose]);

  const handleMultiToggle = useCallback((value) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      onSelect?.([...next]);
      return next;
    });
  }, [onSelect]);

  if (!isOpen) return null;

  const isEmpty = filtered.length === 0;

  const modalContent = html`
    <${BaseOverlay}
      bgColor=${theme.colors.overlay.background}
      onClick=${handleOverlayClick}
    >
      <${BaseContainer}
        bgColor=${theme.colors.background.card}
        textColor=${theme.colors.text.primary}
        borderRadius=${theme.spacing.medium.borderRadius}
        maxWidth="90vw"
        maxHeight="80vh"
        shadowColor=${theme.shadow.colorStrong}
      >
        <${ModalWrapper}>
          <!-- Header -->
          <${BaseHeader} marginBottom="16px">
            <${H2}>${title}</${H2}>
          </${BaseHeader}>

          <!-- Search bar -->
          <${SearchBar}>
            <${SearchInput}
              id=${inputIdRef.current}
              type="text"
              placeholder="Search…"
              value=${filter}
              onInput=${(e) => setFilter(e.target.value)}
              padding=${theme.spacing.medium.padding}
              border=${`2px ${theme.border.style} ${theme.colors.border.primary}`}
              bgColor=${theme.colors.background.tertiary}
              color=${theme.colors.text.primary}
              fontSize=${theme.typography.fontSize.medium}
              fontFamily=${theme.typography.fontFamily}
              focusColor=${theme.colors.primary.border}
            />
          </${SearchBar}>

          <!-- Item list -->
          <${ItemList}>
            ${isEmpty ? html`
              <${EmptyMessage}
                color=${theme.colors.text.secondary}
                fontSize=${theme.typography.fontSize.medium}
              >
                No matches
              </${EmptyMessage}>
            ` : filtered.map(item => {
              if (mode === 'multi') {
                const isChecked = selected.has(item.value);
                return html`
                  <${MultiItem}
                    key=${String(item.value)}
                    hoverBg=${theme.colors.background.hover}
                    hoverBorderRadius=${theme.spacing.small.borderRadius}
                    transition=${theme.transitions.fast}
                    onClick=${() => handleMultiToggle(item.value)}
                  >
                    <${Checkbox}
                      checked=${isChecked}
                      interactive=${false}
                    />
                    <${MultiItemContent}>
                      <${MultiItemLabel}
                        fontFamily=${theme.typography.fontFamily}
                        fontSize=${theme.typography.fontSize.medium}
                        color=${theme.colors.text.primary}
                      >${item.label}</${MultiItemLabel}>
                      ${item.subtitle ? html`
                        <${MultiItemSubtitle}
                          fontFamily=${theme.typography.fontFamily}
                          fontSize=${theme.typography.fontSize.small}
                          color=${theme.colors.text.secondary}
                        >${item.subtitle}</${MultiItemSubtitle}>
                      ` : null}
                    </${MultiItemContent}>
                  </${MultiItem}>
                `;
              }
              // Single-select mode
              return html`
                <${SingleItem}
                  key=${String(item.value)}
                  hoverBg=${theme.colors.background.hover}
                  hoverBorderRadius=${theme.spacing.small.borderRadius}
                  transition=${theme.transitions.fast}
                  onClick=${() => handleSingleSelect(item.value)}
                >
                  <${MultiItemContent}>
                    <${MultiItemLabel}
                      fontFamily=${theme.typography.fontFamily}
                      fontSize=${theme.typography.fontSize.medium}
                      color=${theme.colors.text.primary}
                    >${item.label}</${MultiItemLabel}>
                    ${item.subtitle ? html`
                      <${MultiItemSubtitle}
                        fontFamily=${theme.typography.fontFamily}
                        fontSize=${theme.typography.fontSize.small}
                        color=${theme.colors.text.secondary}
                      >${item.subtitle}</${MultiItemSubtitle}>
                    ` : null}
                  </${MultiItemContent}>
                </${SingleItem}>
              `;
            })}
          </${ItemList}>

          <!-- Footer -->
          <${BaseFooter}
            marginTop="16px"
            gap=${theme.spacing.small.gap}
          >
            <${Button}
              variant="medium-text"
              color="secondary"
              onClick=${onClose}
            >
              Close
            <//>
          </${BaseFooter}>
        </${ModalWrapper}>
      </${BaseContainer}>
    </${BaseOverlay}>
  `;

  return createPortal(modalContent, document.body);
}

export default SearchSelectModal;
