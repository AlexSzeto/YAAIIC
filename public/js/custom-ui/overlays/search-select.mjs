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
  margin-bottom: 12px;
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
  flex: 1;
  overflow-y: auto;
  margin: 0 -16px;
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
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-family: ${props => props.fontFamily};
  transition: background-color ${props => props.transition};

  &:hover {
    background-color: ${props => props.hoverBg};
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
  padding: 8px 20px;
  cursor: pointer;
  transition: background-color ${props => props.transition};

  &:hover {
    background-color: ${props => props.hoverBg};
  }
`;
MultiItem.className = 'search-select-multi-item';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalise items: always returns an array of { label: string, value: any }.
 * Accepts string arrays or { label, value } object arrays.
 *
 * @param {Array<string|{label:string, value:any}>} items
 * @returns {{ label: string, value: any }[]}
 */
function normaliseItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item =>
    typeof item === 'string'
      ? { label: item, value: item }
      : { label: String(item.label ?? item.value ?? ''), value: item.value }
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
 * @param {Array<string|{label,value}>} props.items – Data source
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
    .filter(item => item.label.toLowerCase().includes(lowerFilter))
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
          <${BaseHeader} marginBottom="12px">
            <${BaseTitle}
              color=${theme.colors.text.primary}
              fontFamily=${theme.typography.fontFamily}
              fontWeight=${theme.typography.fontWeight.bold}
            >
              ${title}
            </${BaseTitle}>
          </${BaseHeader}>

          <!-- Search bar -->
          <${SearchBar}>
            <${SearchInput}
              id=${inputIdRef.current}
              type="text"
              placeholder="Search…"
              value=${filter}
              onInput=${(e) => setFilter(e.target.value)}
              padding=${theme.spacing.small.padding}
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
                    transition=${theme.transitions.fast}
                    onClick=${() => handleMultiToggle(item.value)}
                  >
                    <${Checkbox}
                      checked=${isChecked}
                      label=${item.label}
                      interactive=${false}
                    />
                  </${MultiItem}>
                `;
              }
              // Single-select mode
              return html`
                <${SingleItem}
                  key=${String(item.value)}
                  color=${theme.colors.text.primary}
                  fontSize=${theme.typography.fontSize.medium}
                  fontFamily=${theme.typography.fontFamily}
                  hoverBg=${theme.colors.background.hover}
                  transition=${theme.transitions.fast}
                  onClick=${() => handleSingleSelect(item.value)}
                >
                  ${item.label}
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
