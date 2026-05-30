/**
 * plot-requirements-editor.mjs – Plot-level entry requirements editor.
 *
 * Two regions in the pill list:
 *   1. Slot-type pills (always shown): all known non-character slot types.
 *   2. Library part pills (always shown): all parts from libraryParts.
 *   3. Orphan part pills (shown until cleared): UIDs present in slotRequirements
 *      but absent from libraryParts — persist until toggled back to ignore.
 *
 * Each pill cycles: ignore (outlined) → present (green) → absent (red) → ignore.
 * Orphan pills are removed from the data and the rendered list when they reach ignore.
 *
 * Props:
 *   @param {Object}   props.plot             – full plot object (reads slotRequirements)
 *   @param {Function} props.onChange         – called with updated plot
 *   @param {Array}    props.libraryParts     – active parts in the current editor session ({ config: { uid, name }, ... })
 *   @param {Array}    [props.allLibraryParts] – full global parts library; used as fallback for name resolution of removed parts
 *   @param {string[]} props.slotOptions      – all known non-character slot type strings
 */
import { html } from 'htm/preact';
import { useCallback, useMemo } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';

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

function resolveLabel(key, libraryParts, allLibraryParts) {
  // libraryParts are editor parts: { config: { uid, name }, data: { ... } }
  // allLibraryParts is the full global library used as a fallback for removed parts.
  const part = libraryParts.find(p => (p.config?.uid ?? p.uid) === key)
    ?? allLibraryParts.find(p => (p.config?.uid ?? p.uid) === key);
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

function pillLabel(key, reqValue, libraryParts, allLibraryParts) {
  const name = resolveLabel(key, libraryParts, allLibraryParts);
  if (reqValue === 'present') return `${name} → present`;
  if (reqValue === 'absent') return `${name} → absent`;
  return name;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlotRequirementsEditor({ plot, onChange, libraryParts = [], allLibraryParts = [], slotOptions = [] }) {
  const slotRequirements = plot.slotRequirements || {};
  const slotOptionSet = useMemo(() => new Set(slotOptions), [slotOptions]);
  const libraryPartUidSet = useMemo(() => new Set(libraryParts.map(p => p.config?.uid ?? p.uid)), [libraryParts]);

  // UIDs present in slotRequirements that are neither slot types nor library parts → orphans
  const orphanUids = useMemo(
    () => Object.keys(slotRequirements).filter(k => !slotOptionSet.has(k) && !libraryPartUidSet.has(k)),
    [slotRequirements, slotOptionSet, libraryPartUidSet]
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

  // Part pill: ignore → present → absent → ignore.
  // Library parts stay visible in ignore state; orphans disappear when reaching ignore.
  const cyclePartPill = useCallback((uid) => {
    const current = slotRequirements[uid];
    const updated = { ...slotRequirements };
    if (current === undefined) updated[uid] = 'present';
    else if (current === 'present') updated[uid] = 'absent';
    else delete updated[uid];
    updateRequirements(updated);
  }, [slotRequirements, updateRequirements]);

  const theme = currentTheme.value;

  return html`
    <div>
      <${PillRow}>
        ${slotOptions.map(slot => {
          const reqValue = slotRequirements[slot];
          return html`
            <${ReqPill}
              key=${slot}
              style=${pillStyle(reqValue, theme)}
              onClick=${() => cycleSlotType(slot)}
              title="Click to cycle: ignore → present → absent"
            >
              ${pillLabel(slot, reqValue, libraryParts, allLibraryParts)}
            </${ReqPill}>
          `;
        })}

        ${libraryParts.map(part => {
          const uid = part.config?.uid ?? part.uid;
          if (!uid) return null;
          const reqValue = slotRequirements[uid];
          return html`
            <${ReqPill}
              key=${uid}
              style=${pillStyle(reqValue, theme)}
              onClick=${() => cyclePartPill(uid)}
              title="Click to cycle: ignore → present → absent"
            >
              ${pillLabel(uid, reqValue, libraryParts, allLibraryParts)}
            </${ReqPill}>
          `;
        })}

        ${orphanUids.map(uid => {
          const reqValue = slotRequirements[uid];
          return html`
            <${ReqPill}
              key=${uid}
              style=${pillStyle(reqValue, theme)}
              onClick=${() => cyclePartPill(uid)}
              title="Click to cycle: present → absent → remove (part no longer in library)"
            >
              ${pillLabel(uid, reqValue, libraryParts, allLibraryParts)}
            </${ReqPill}>
          `;
        })}
      </${PillRow}>
    </div>
  `;
}
