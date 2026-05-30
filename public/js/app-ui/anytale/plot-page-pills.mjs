/**
 * plot-page-pills.mjs – Slot and part pill editors for a plot page.
 *
 * Rendered as two labeled sections:
 *
 *   "Page Requirements and Changes (Parts)"
 *     Part pills from the full library. Each pill toggles between blank
 *     (part renders normally) and hidden (part excluded from prompt assembly).
 *     Stored as page.hiddenParts: string[] of part UIDs.
 *
 *   "Page Requirements and Changes (Slots)"
 *     Slot pills encode the slot's current status as a background colour and
 *     let the user (a) lock the slot into page.requirements and (b) set a
 *     transition action that fires when the page is reached.
 *
 * Props:
 *   @param {Map<string, 'covering'|'revealing'|'removed'>} props.slotStatuses – currently active slots and their resolved status
 *   @param {string[]} [props.allSlots=[]] – all known slot types; inactive ones render as outline-only pills
 *   @param {Array}    [props.allLibraryParts=[]] – all library parts ({ config: { uid, name } }); shown in Parts section
 *   @param {Array}    [props.libraryParts=[]] – full flat library ({ uid, name }) for resolving orphaned hidden-part names
 *   @param {Object}   props.page         – current PlotPage { requirements, actions, hiddenParts }
 *   @param {Function} props.onChange     – called with updated page object
 *   @param {boolean}  [props.disabled]
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Icon } from '../../custom-ui/layout/icon.mjs';
import { Label, VerticalLayout } from '../../custom-ui/themed-base.mjs';

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
  user-select: none;

  &:hover {
    filter: ${({ disabled }) => disabled ? 'none' : 'brightness(0.8)'};
  }
`;
PillBody.className = 'plot-page-pill-body';

const TransitionLabel = styled('span')`
  border-radius: 9999px;
  padding: 2px 6px 2px 8px;
  margin-left: 2px;
  background: ${({ status }) => (STATUS_BG[status] || STATUS_BG.covering)()};
`;
TransitionLabel.className = 'pill-transition-label';

const HiddenLabel = styled('span')`
  border-radius: 9999px;
  padding: 2px 6px 2px 8px;
  margin-left: 2px;
  background: ${() => currentTheme.value.colors.danger.backgroundLight};
`;
HiddenLabel.className = 'pill-hidden-label';

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextTransition(currentStatus, currentTransition) {
  // Inactive slots (no currentStatus) can transition to any status.
  const available = currentStatus
    ? [...ALL_STATUSES.filter(s => s !== currentStatus), null]
    : [...ALL_STATUSES, null];
  const idx = available.indexOf(currentTransition);
  return available[(idx + 1) % available.length];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlotPagePills({ slotStatuses, allSlots = [], allLibraryParts = [], libraryParts = [], page = {}, onChange, disabled = false }) {
  const requirements = page.requirements || [];
  const actions = page.actions || [];
  const hiddenParts = page.hiddenParts || [];

  const statusMap = slotStatuses instanceof Map
    ? slotStatuses
    : new Map(Object.entries(slotStatuses || {}));

  // Merged slot list: all known slots (preserves allSlots order), plus any active
  // slots not in allSlots (edge case: part types not represented in the library list).
  const seenSlots = new Set(allSlots);
  const extraActiveSlots = [...statusMap.keys()].filter(s => !seenSlots.has(s));
  const mergedSlots = [...allSlots, ...extraActiveSlots];

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

  const toggleHiddenPart = useCallback((uid) => {
    if (disabled || !uid) return;
    const next = hiddenParts.includes(uid)
      ? hiddenParts.filter(id => id !== uid)
      : [...hiddenParts, uid];
    onChange({ ...page, hiddenParts: next });
  }, [disabled, hiddenParts, page, onChange]);

  return html`
    <${VerticalLayout} gap="medium">

      <!-- ── Parts section ─────────────────────────────────────────────────── -->
      <${VerticalLayout} gap="small">
        <${Label}>Page Requirements and Changes (Parts)</${Label}>
        <${PillRow}>
          ${allLibraryParts.map(part => {
            // parts from the editor state are wrapped: { config: { uid, name, ... }, data: { ... } }
            const uid = part.config?.uid;
            const name = (part.config?.name || uid || '').trim();
            if (!name) return null;
            const isHidden = uid ? hiddenParts.includes(uid) : false;
            const isLocked = requirements.includes(name);
            const pillStyle = isHidden
              ? { backgroundColor: currentTheme.value.colors.danger.backgroundLight, border: '1px solid ' + currentTheme.value.colors.danger.background }
              : { backgroundColor: 'transparent', border: '1px solid ' + currentTheme.value.colors.border.primary };
            const iconColor = disabled ? currentTheme.value.colors.text.secondary
              : isLocked ? currentTheme.value.colors.danger.background
              : currentTheme.value.colors.text.secondary;
            return html`
              <${Pill} key=${uid || name} style=${pillStyle}>
                <${LockZone}
                  disabled=${disabled}
                  title=${isLocked ? 'Remove from requirements' : 'Add to requirements'}
                  onClick=${() => toggleRequirement(name)}
                >
                  <${Icon} name=${isLocked ? 'radio-circle-marked' : 'radio-circle'} size="14px" color=${iconColor} />
                </${LockZone}>
                <${PillBody}
                  style=${{ cursor: disabled ? 'default' : 'pointer' }}
                  onClick=${() => toggleHiddenPart(uid)}
                  title=${isHidden ? 'Click to unhide (part will render normally)' : 'Click to hide (part excluded from prompt)'}
                >
                  <${SlotText}>${name}</${SlotText}>
                  ${isHidden && html` → <${HiddenLabel}>hidden</${HiddenLabel}>`}
                </${PillBody}>
              </${Pill}>
            `;
          })}
          ${(() => {
            // Orphaned hidden parts: UIDs in hiddenParts that are no longer in the active
            // parts list. Always shown as "hidden"; clicking removes them from hiddenParts
            // (after which they disappear since they're not in allLibraryParts either).
            const activeUids = new Set(allLibraryParts.map(p => p.config?.uid).filter(Boolean));
            return hiddenParts
              .filter(uid => !activeUids.has(uid))
              .map(uid => {
                const libMatch = libraryParts.find(p => p.uid === uid);
                const name = (libMatch?.name || uid || '').trim();
                const pillStyle = { backgroundColor: currentTheme.value.colors.danger.backgroundLight, border: '1px solid ' + currentTheme.value.colors.danger.background, opacity: '0.6' };
                return html`
                  <${Pill} key=${'orphan-' + uid} style=${pillStyle}>
                    <${PillBody}
                      style=${{ cursor: disabled ? 'default' : 'pointer', paddingLeft: '10px' }}
                      onClick=${() => toggleHiddenPart(uid)}
                      title="Part no longer in parts list — click to remove from hidden list"
                    >
                      <${SlotText}>${name}</${SlotText}>
                      ${html` → <${HiddenLabel}>hidden</${HiddenLabel}>`}
                    </${PillBody}>
                  </${Pill}>
                `;
              });
          })()}
        </${PillRow}>
      </${VerticalLayout}>

      <!-- ── Slots section ─────────────────────────────────────────────────── -->
      <${VerticalLayout} gap="small">
        <${Label}>Page Requirements and Changes (Slots)</${Label}>
        <${PillRow}>
          ${mergedSlots.map(slot => {
            const status = statusMap.get(slot) || null;
            const isActive = statusMap.has(slot);
            const isLocked = requirements.includes(slot);
            const action = actions.find(a => a.slot === slot);
            const transition = action ? action.status : null;
            // To support per-slot lock disabling (e.g. character slot types that can
            // have transitions but never become requirements), add a
            // `requirementsDisabledSlots` Set<string> prop and replace `disabled` below
            // with `disabled || requirementsDisabledSlots?.has(slot.toLowerCase())`.
            const iconColor = disabled ? currentTheme.value.colors.text.secondary
              : isLocked ? currentTheme.value.colors.danger.background
              : currentTheme.value.colors.text.secondary;

            const pillStyle = isActive
              ? { backgroundColor: (STATUS_BG[status] || STATUS_BG.covering)() }
              : { backgroundColor: 'transparent', border: '1px solid ' + currentTheme.value.colors.border.primary };

            return html`
              <${Pill} key=${slot} style=${pillStyle}>
                <${LockZone}
                  disabled=${disabled}
                  title=${isLocked ? 'Remove from requirements' : 'Add to requirements'}
                  onClick=${() => toggleRequirement(slot)}
                >
                  <${Icon} name=${isLocked ? 'radio-circle-marked' : 'radio-circle'} size="14px" color=${iconColor} />
                </${LockZone}>
                <${PillBody}
                  style=${{ cursor: disabled ? 'default' : 'pointer' }}
                  onClick=${() => !disabled && cycleSlotTransition(slot, status)}
                  title="Click to cycle transition"
                >
                  <${SlotText}>${slot}</${SlotText}>
                  ${transition && html` → <${TransitionLabel} status=${transition}>${transition}</${TransitionLabel}>`}
                </${PillBody}>
              </${Pill}>
            `;
          })}
        </${PillRow}>
      </${VerticalLayout}>

    </${VerticalLayout}>
  `;
}
