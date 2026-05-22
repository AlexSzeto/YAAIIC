/**
 * plot-page-pills.mjs – Unified slot/part pill list for a plot page.
 *
 * Slot pills encode the slot's current status as a background colour and let
 * the user (a) lock the slot into page.requirements and (b) set a transition
 * action that fires when the page is reached.
 *
 * Name pills do the same lock/unlock for active part names but have no
 * transition controls.
 *
 * Props:
 *   @param {Map<string, 'covering'|'revealing'|'removed'>} props.slotStatuses
 *   @param {Array}    props.activeParts  – enabled parts ({ config: { name } })
 *   @param {Object}   props.page         – current PlotPage { requirements, actions }
 *   @param {Function} props.onChange     – called with updated page object
 *   @param {boolean}  [props.disabled]
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Icon } from '../../custom-ui/layout/icon.mjs';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_STATUSES = ['covering', 'revealing', 'removed'];

const STATUS_BG = {
  covering: () => currentTheme.value.colors.secondary.background,
  revealing: () => currentTheme.value.colors.warning.background,
  removed:   () => currentTheme.value.colors.danger.background,
};

// ── Styled components ─────────────────────────────────────────────────────────

const PillRow = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${() => currentTheme.value.spacing.small.gap};
  align-items: center;
`;
PillRow.className = 'plot-page-pill-row';

const Pill = styled('div')`
  display: inline-flex;
  align-items: stretch;
  border-radius: 9999px;
  overflow: hidden;
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  white-space: nowrap;
`;
Pill.className = 'plot-page-pill';

const LockZone = styled('button')`
  display: flex;
  align-items: center;
  padding: 4px 6px 4px 8px;
  border: none;
  border-radius: 9999px;
  background: transparent;
  cursor: pointer;
  opacity: ${({ disabled }) => disabled ? '0.4' : '1'};
  &:hover {
    background: rgba(0, 0, 0, 0.08);
  }
`;
LockZone.className = 'plot-page-pill-lock';

const SlotText = styled('span')`
  padding: 2px 0;
`;
SlotText.className = 'plot-page-slot-text';

const PillBody = styled('div')`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px 2px 4px;
  color: ${() => currentTheme.value.colors.text.primary};
`;
PillBody.className = 'plot-page-pill-body';

const TransitionLabel = styled('span')`
  border-radius: 9999px;
  padding: 2px 6px 2px 8px;
  margin-left: 2px;
  background: red;
`;
TransitionLabel.className = 'pill-transition-label';

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextTransition(currentStatus, currentTransition) {
  // Available targets are all statuses except the slot's current status, plus null (no transition).
  const available = [...ALL_STATUSES.filter(s => s !== currentStatus), null];
  const idx = available.indexOf(currentTransition);
  return available[(idx + 1) % available.length];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlotPagePills({ slotStatuses, activeParts = [], page = {}, onChange, disabled = false }) {
  const requirements = page.requirements || [];
  const actions = page.actions || [];

  const toggleRequirement = useCallback((label) => {
    if (disabled) return;
    const next = requirements.includes(label)
      ? requirements.filter(r => r !== label)
      : [...requirements, label];
    onChange({ ...page, requirements: next });
  }, [disabled, requirements, page, onChange]);

  const cycleSlotTransition = useCallback((slot, currentStatus) => {
    if (disabled) return;
    const currentAction = actions.find(a => a.slot === slot);
    const currentTransition = currentAction ? currentAction.status : null;
    const next = nextTransition(currentStatus, currentTransition);
    const newActions = actions.filter(a => a.slot !== slot);
    if (next !== null) newActions.push({ slot, status: next });
    onChange({ ...page, actions: newActions });
  }, [disabled, actions, page, onChange]);

  const slotEntries = slotStatuses instanceof Map
    ? [...slotStatuses.entries()]
    : Object.entries(slotStatuses || {});

  const activePartNames = [...new Set(
    activeParts.map(p => (p.config?.name || '').trim()).filter(Boolean)
  )];

  const iconColor = disabled
    ? currentTheme.value.colors.warning.background
    : currentTheme.value.colors.text.secondary;

  return html`
    <${PillRow}>
      ${slotEntries.map(([slot, status]) => {
        const bg = (STATUS_BG[status] || STATUS_BG.covering)();
        const isLocked = requirements.includes(slot);
        const action = actions.find(a => a.slot === slot);
        const transition = action ? action.status : null;

        return html`
          <${Pill} key=${slot} style=${{ backgroundColor: bg }}>
            <${LockZone}
              disabled=${disabled}
              title=${isLocked ? 'Remove from requirements' : 'Add to requirements'}
              onClick=${() => toggleRequirement(slot)}
            >
              <${Icon} name=${isLocked ? 'check' : 'radio-circle'} size="14px" color=${iconColor} />
            </${LockZone}>
            <${PillBody}
              style=${{ cursor: disabled ? 'default' : 'pointer' }}
              onClick=${() => !disabled && cycleSlotTransition(slot, status)}
              title="Click to cycle transition"
            >
              <${SlotText}>${slot}</${SlotText}>
              ${transition && html` → <${TransitionLabel}>${transition}</${TransitionLabel}>`}
            </${PillBody}>
          </${Pill}>
        `;
      })}

      ${activePartNames.map(name => {
        const isLocked = requirements.includes(name);
        const bg = currentTheme.value.colors.secondary.background;

        return html`
          <${Pill} key=${name} style=${{ backgroundColor: bg }}>
            <${LockZone}
              disabled=${disabled}
              title=${isLocked ? 'Remove from requirements' : 'Add to requirements'}
              onClick=${() => toggleRequirement(name)}
            >
              <${Icon} name=${isLocked ? 'check' : 'radio-circle'} size="14px" color=${iconColor} />
            </${LockZone}>
            <${PillBody}>
              ${name}
            </${PillBody}>
          </${Pill}>
        `;
      })}
    </${PillRow}>
  `;
}
