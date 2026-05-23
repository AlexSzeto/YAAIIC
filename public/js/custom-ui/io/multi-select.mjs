/**
 * MultiSelect – button that opens an anchored popover checklist.
 *
 * The popover is rendered into a portal at document.body so it escapes any
 * overflow:hidden ancestors.  Anchor coordinates are captured from the
 * trigger button's getBoundingClientRect() on each click — no ref on a
 * styled component is needed.
 *
 * @module custom-ui/io/multi-select
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Icon } from '../layout/icon.mjs';
import { Checkbox } from './checkbox.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: ${props => props.width};
  flex: ${props => props.flex};
`;
Wrapper.className = 'multi-select-wrapper';

const LabelEl = styled('label')`
  margin-bottom: 0;
  color: ${props => props.theme.colors.text.secondary};
  font-size: ${props => props.theme.typography.fontSize.small};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  font-family: ${props => props.theme.typography.fontFamily};
`;
LabelEl.className = 'multi-select-label';

const TriggerButton = styled('button')`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 44px;
  padding: 0 12px;
  background-color: ${props => props.theme.colors.background.primary};
  border: 2px solid ${props => props.theme.colors.border.primary};
  border-radius: 6px;
  color: ${props => props.theme.colors.text.primary};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  cursor: pointer;
  text-align: left;

  &:hover {
    border-color: ${props => props.theme.colors.border.focus};
    background-color: ${props => props.theme.colors.background.hover};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.border.focus};
  }
`;
TriggerButton.className = 'multi-select-trigger';

const TriggerText = styled('span')`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${props => props.empty ? props.theme.colors.text.placeholder : props.theme.colors.text.primary};
`;
TriggerText.className = 'multi-select-trigger-text';

const Popover = styled('div')`
  position: fixed;
  z-index: 9999;
  background-color: ${props => props.theme.colors.background.card};
  border: 2px solid ${props => props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  box-shadow: ${props => props.theme.shadow.elevated};
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
`;
Popover.className = 'multi-select-popover';

const OptionRow = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background-color: ${props => props.theme.colors.background.hover};
  }
`;
OptionRow.className = 'multi-select-option-row';

const OptionLabel = styled('span')`
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  color: ${props => props.theme.colors.text.primary};
`;
OptionLabel.className = 'multi-select-option-label';

// ============================================================================
// Component
// ============================================================================

/**
 * MultiSelect – Button that opens a popover checklist below (or above, if near viewport bottom).
 *
 * @param {Object}   props
 * @param {string[]} props.options        - Available option strings.
 * @param {string[]} props.value          - Currently selected values.
 * @param {Function} props.onChange       - `(values: string[]) => void`
 * @param {string}   [props.label]        - Label displayed above the button.
 * @param {string}   [props.placeholder]  - Shown when nothing is selected (default: "Select…").
 * @param {string}   [props.widthScale]   - 'full' → flex:1 + 100% width; default → inline.
 *
 * @example
 * html`
 *   <${MultiSelect}
 *     label="Keys"
 *     options=${MUSICAL_KEYS}
 *     value=${genre.keys}
 *     onChange=${(keys) => setField('keys', keys)}
 *   />
 * `
 */
export function MultiSelect({ options = [], value = [], onChange, label, placeholder = 'Select…', widthScale }) {
  const theme = currentTheme.value;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null); // { top, left, width, triggerBottom, triggerTop }

  const handleTriggerClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width, triggerTop: rect.top });
    setOpen(prev => !prev);
  }, []);

  const handleToggle = useCallback((option, e) => {
    e.stopPropagation();
    const next = value.includes(option)
      ? value.filter(v => v !== option)
      : [...value, option];
    onChange(next);
  }, [value, onChange]);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleDown = (e) => {
      if (!e.target.closest('[data-multiselect-popover]') && !e.target.closest('[data-multiselect-trigger]')) {
        close();
      }
    };
    const handleKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, close]);

  const displayText = value.length === 0 ? placeholder : value.join(', ');

  const width = widthScale === 'full' ? '100%' : undefined;
  const flex = widthScale === 'full' ? '1' : undefined;

  // Determine popover position: show above trigger if not enough space below
  let popoverStyle = {};
  if (anchor) {
    const ESTIMATED_HEIGHT = Math.min(options.length * 34 + 16, 280);
    const spaceBelow = window.innerHeight - anchor.top;
    if (spaceBelow < ESTIMATED_HEIGHT && anchor.triggerTop > ESTIMATED_HEIGHT) {
      popoverStyle = { top: (anchor.triggerTop - ESTIMATED_HEIGHT - 4) + 'px', left: anchor.left + 'px', minWidth: anchor.width + 'px' };
    } else {
      popoverStyle = { top: anchor.top + 'px', left: anchor.left + 'px', minWidth: anchor.width + 'px' };
    }
  }

  const popover = open && anchor ? createPortal(
    html`
      <${Popover}
        theme=${theme}
        data-multiselect-popover
        style=${popoverStyle}
        onMouseDown=${(e) => e.stopPropagation()}
      >
        ${options.map(opt => html`
          <${OptionRow}
            key=${opt}
            theme=${theme}
            onClick=${(e) => handleToggle(opt, e)}
          >
            <${Checkbox}
              checked=${value.includes(opt)}
              onChange=${() => {}}
            />
            <${OptionLabel} theme=${theme}>${opt}</${OptionLabel}>
          </${OptionRow}>
        `)}
      </${Popover}>
    `,
    document.body
  ) : null;

  return html`
    <${Wrapper} width=${width} flex=${flex}>
      ${label && html`<${LabelEl} theme=${theme}>${label}</${LabelEl}>`}
      <${TriggerButton}
        theme=${theme}
        type="button"
        data-multiselect-trigger
        onClick=${handleTriggerClick}
      >
        <${TriggerText} theme=${theme} empty=${value.length === 0}>
          ${displayText}
        </${TriggerText}>
        <${Icon} name="chevron-down" size="16px" color=${theme.colors.text.secondary} />
      </${TriggerButton}>
      ${popover}
    </${Wrapper}>
  `;
}
