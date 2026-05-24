/**
 * plot-requirements-editor.mjs – Plot-level entry requirements editor.
 *
 * Two regions:
 *   Top: SearchSelectModal trigger to add a specific library part (by UID) to requirements.
 *   Bottom: Pill list — all known non-character slot types (always shown) plus any
 *           UID-keyed entries in slotRequirements. Each pill cycles through:
 *             ignore  → present → absent → ignore  (slot-type pills, always visible)
 *             present → absent  → <removed>         (part-UID pills, disappear on ignore)
 *
 * Props:
 *   @param {Object}   props.plot          – full plot object (reads slotRequirements)
 *   @param {Function} props.onChange      – called with updated plot
 *   @param {Array}    props.libraryParts  – for modal items and UID → name resolution
 *   @param {string[]} props.slotOptions   – all known non-character slot type strings
 */
import { html } from 'htm/preact';
import { useState, useCallback, useMemo } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';
import { HorizontalEdgesLayout, Label } from '../../custom-ui/themed-base.mjs';
import { H3 } from '../../custom-ui/themed-base.mjs';

// ── Styled components ─────────────────────────────────────────────────────────

const PillRow = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${() => currentTheme.value.spacing.small.gap};
  align-items: center;
`;
PillRow.className = 'plot-req-editor-pill-row';

const ReqPill = styled('button')`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  white-space: nowrap;
  cursor: pointer;
  border: none;
  &:hover {
    filter: brightness(0.88);
  }
`;
ReqPill.className = 'plot-req-editor-pill';

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveLabel(key, libraryParts) {
  const part = libraryParts.find(p => p.uid === key);
  return part?.config?.name || part?.name || key;
}

function pillStyle(reqValue, theme) {
  if (reqValue === 'present') {
    return {
      backgroundColor: theme.colors.secondary.background,
      color: theme.colors.text.primary,
    };
  }
  if (reqValue === 'absent') {
    return {
      backgroundColor: theme.colors.danger.background,
      color: theme.colors.text.primary,
    };
  }
  // ignore
  return {
    backgroundColor: 'transparent',
    border: '1px solid ' + theme.colors.secondary.background,
    color: theme.colors.text.primary,
  };
}

function pillLabel(key, reqValue, libraryParts) {
  const name = resolveLabel(key, libraryParts);
  if (reqValue === 'present') return `${name} → covering / revealing`;
  if (reqValue === 'absent') return `${name} → removed / missing`;
  return name;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlotRequirementsEditor({ plot, onChange, libraryParts = [], slotOptions = [] }) {
  const [addModalOpen, setAddModalOpen] = useState(false);

  const slotRequirements = plot.slotRequirements || {};
  const slotOptionSet = useMemo(() => new Set(slotOptions), [slotOptions]);

  // Keys present in slotRequirements that are NOT slot types → part UIDs
  const uidKeys = useMemo(
    () => Object.keys(slotRequirements).filter(k => !slotOptionSet.has(k)),
    [slotRequirements, slotOptionSet]
  );

  const updateRequirements = useCallback((updated) => {
    onChange({ ...plot, slotRequirements: updated });
  }, [plot, onChange]);

  // Slot-type pill: ignore → present → absent → ignore (always visible)
  const cycleSlotType = useCallback((slot) => {
    const current = slotRequirements[slot];
    const updated = { ...slotRequirements };
    if (current === undefined) updated[slot] = 'present';
    else if (current === 'present') updated[slot] = 'absent';
    else delete updated[slot];
    updateRequirements(updated);
  }, [slotRequirements, updateRequirements]);

  // Part-UID pill: present → absent → remove (pill disappears on remove)
  const cyclePartUid = useCallback((uid) => {
    const current = slotRequirements[uid];
    const updated = { ...slotRequirements };
    if (current === 'present') updated[uid] = 'absent';
    else delete updated[uid];
    updateRequirements(updated);
  }, [slotRequirements, updateRequirements]);

  const handleAddPart = useCallback((uid) => {
    if (!uid) return;
    updateRequirements({ ...slotRequirements, [uid]: 'present' });
    setAddModalOpen(false);
  }, [slotRequirements, updateRequirements]);

  const theme = currentTheme.value;

  return html`
    <div>
      <${HorizontalEdgesLayout}>
        <${Label}>Plot Requirements</${Label}>
        <${Button}
          variant="small-text"
          icon="plus"
          color="secondary"
          onClick=${() => setAddModalOpen(true)}
        >
          Add Part
        <//>
      </${HorizontalEdgesLayout}>

      <${PillRow} style=${{ marginTop: theme.spacing.small.gap }}>
        ${slotOptions.map(slot => {
          const reqValue = slotRequirements[slot];
          return html`
            <${ReqPill}
              key=${slot}
              style=${pillStyle(reqValue, theme)}
              onClick=${() => cycleSlotType(slot)}
              title="Click to cycle: ignore → present → absent"
            >
              ${pillLabel(slot, reqValue, libraryParts)}
            </${ReqPill}>
          `;
        })}

        ${uidKeys.map(uid => {
          const reqValue = slotRequirements[uid];
          return html`
            <${ReqPill}
              key=${uid}
              style=${pillStyle(reqValue, theme)}
              onClick=${() => cyclePartUid(uid)}
              title="Click to cycle: present → absent → remove"
            >
              ${pillLabel(uid, reqValue, libraryParts)}
            </${ReqPill}>
          `;
        })}
      </${PillRow}>

      <${SearchSelectModal}
        isOpen=${addModalOpen}
        title="Add Part Requirement"
        items=${libraryParts.map(p => ({
          label: p.config?.name || p.name || p.uid,
          value: p.uid,
          subtitle: Array.isArray(p.config?.type || p.type) ? (p.config?.type || p.type).join(', ') : '',
        }))}
        mode="single"
        onSelect=${handleAddPart}
        onClose=${() => setAddModalOpen(false)}
      />
    </div>
  `;
}
