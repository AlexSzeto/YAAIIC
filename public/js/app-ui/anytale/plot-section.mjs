/**
 * plot-section.mjs – Plot block editor for the AnyTale page.
 *
 * Always visible below the parts list. Manages the active plot block in
 * localStorage and provides Save / Delete / Clear / page navigation actions.
 *
 * Props:
 *   @param {Array}    parts          – The current parts list (for part identifier suggestions)
 *   @param {number}   [activePage]   – Externally controlled active page index (0-based)
 *   @param {Function} [onPageChange] – Called with the new active page index
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { NavigatorControl } from '../../custom-ui/nav/navigator.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';
import { TagInput } from '../tags/tag-input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { H2, VerticalLayout, HorizontalLayout, HorizontalEdgesLayout } from '../../custom-ui/themed-base.mjs';
import { loadPlot, savePlotState, createBlankPlot } from './anytale-state.mjs';
import { fetchPlotList, savePlot, deletePlot } from './plot-api.mjs';
import { resolveSlotStatuses } from './slot-resolver.mjs';
import { PlotPagePills } from './plot-page-pills.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const SectionWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.large.gap};
  padding-top: ${() => currentTheme.value.spacing.medium.padding};
`;
SectionWrapper.className = 'plot-section-wrapper';

const ButtonRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
  align-items: center;
`;
ButtonRow.className = 'plot-button-row';

const NavRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
`;
NavRow.className = 'plot-nav-row';

const PlotReqPillRow = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${() => currentTheme.value.spacing.small.gap};
  align-items: center;
`;
PlotReqPillRow.className = 'plot-req-pill-row';

const PlotReqPill = styled('button')`
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 9999px;
  border: 1px solid ${() => currentTheme.value.colors.border.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  white-space: nowrap;
  cursor: pointer;
  color: ${() => currentTheme.value.colors.text.primary};
  &:hover {
    filter: brightness(0.92);
  }
`;
PlotReqPill.className = 'plot-req-pill';

const SLOT_REQ_STATUSES = ['covering', 'revealing', 'removed'];

const SLOT_REQ_BG = {
  covering: () => currentTheme.value.colors.primary.backgroundLight,
  revealing: () => currentTheme.value.colors.warning.backgroundLight,
  removed:   () => currentTheme.value.colors.danger.backgroundLight,
};

// ============================================================================
// Component
// ============================================================================

/**
 * @param {Object}   props
 * @param {Array}    [props.parts=[]]              – Current parts list (for identifier hints)
 * @param {number}   [props.activePage=0]          – Controlled active page index
 * @param {Function} [props.onPageChange]           – Called when the active page index changes
 * @param {boolean[]} [props.pageLocked=[]]         – Lock state per page index
 * @param {Function} [props.onPageLockedChange]     – Called with updated lock array
 * @param {Function} [props.onPlotReset]              – Called when the plot is loaded, cleared, or deleted
 * @param {Function} [props.onImportHandlerReady]   – Called with the async import handler on mount; null on unmount
 * @param {Function} [props.onPlotChange]            – Called with the updated plot whenever its content changes
 * @param {number}   [props.refreshKey=0]            – Increment to force reload from localStorage
 * @param {Function} [props.onPageTagsUpdateReady]     – Called with (fn) to overwrite a page's tags; null on unmount
 * @param {Function} [props.onReject]                  – Called with ({ plotUid, pageIndex }) after page is unlocked
 */
export function PlotSection({ parts = [], activePage = 0, onPageChange, pageLocked = [], onPageLockedChange, onPlotReset, onImportHandlerReady, onPlotChange, refreshKey = 0, onPageTagsUpdateReady, onReject }) {
  const toast = useToast();
  const [plot, setPlot] = useState(() => loadPlot());
  const [plotList, setPlotList] = useState([]);
  // Tracks the last version saved to / loaded from the server for change detection.
  const [savedPlot, setSavedPlot] = useState(null);

  const refreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === refreshKeyRef.current) return;
    refreshKeyRef.current = refreshKey;
    const loaded = loadPlot();
    setPlot(loaded);
    setSavedPlot(null);
    onPageChange && onPageChange(0);
    onPlotReset && onPlotReset();
  }, [refreshKey, onPageChange, onPlotReset]);
  // Load-plot modal state
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  // All library parts — used for slot action editor
  const [libraryParts, setLibraryParts] = useState([]);
  const [characterSlotTypes, setCharacterSlotTypes] = useState([]);

  // Clamp activePage to valid range
  const pageCount = plot.pages.length;
  const currentPageIndex = Math.min(Math.max(activePage, 0), pageCount - 1);
  const currentPage = plot.pages[currentPageIndex] || { tags: '', actions: [] };
  const isCurrentPageLocked = pageLocked[currentPageIndex] === true;

  // ── Load plot list; also sync savedPlot for the active uid on mount ─────
  useEffect(() => {
    fetchPlotList()
      .then(list => {
        if (Array.isArray(list)) {
          setPlotList(list);
          const uid = loadPlot().uid;
          if (uid && list.some(p => p.uid === uid)) {
            fetch(`/anytale/plot/${encodeURIComponent(uid)}`)
              .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
              .then(full => setSavedPlot(full))
              .catch(err => console.error('[PlotSection] Failed to sync savedPlot on mount:', err));
          }
        }
      })
      .catch(err => console.error('[PlotSection] Failed to fetch plot list:', err));
  }, []);

  // ── Load library parts and character slot types ───────────────────────────
  useEffect(() => {
    fetch('/anytale/parts')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => { if (Array.isArray(data)) setLibraryParts(data); })
      .catch(err => console.error('[PlotSection] Failed to fetch library parts:', err));
    fetch('/anytale/config')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        if (Array.isArray(data.recommendedCharacterPartTypes)) {
          setCharacterSlotTypes(data.recommendedCharacterPartTypes.map(t => t.toLowerCase()));
        }
      })
      .catch(err => console.error('[PlotSection] Failed to fetch anytale config:', err));
  }, []);

  // ── Persist on every change ───────────────────────────────────────────────
  useEffect(() => {
    savePlotState(plot);
    onPlotChange?.(plot);
  }, [plot]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const updatePage = useCallback((index, updatedPage) => {
    setPlot(prev => {
      const newPages = [...prev.pages];
      newPages[index] = updatedPage;
      return { ...prev, pages: newPages };
    });
  }, []);

  const applyPageTags = useCallback((pageIndex, tags) => {
    setPlot(prev => {
      const clamped = Math.min(Math.max(pageIndex, 0), prev.pages.length - 1);
      const newPages = [...prev.pages];
      newPages[clamped] = { ...newPages[clamped], tags: tags ?? '' };
      return { ...prev, pages: newPages };
    });
  }, []);

  useEffect(() => {
    if (onPageTagsUpdateReady) onPageTagsUpdateReady(applyPageTags);
    return () => { if (onPageTagsUpdateReady) onPageTagsUpdateReady(null); };
  }, [applyPageTags, onPageTagsUpdateReady]);

  const navigateTo = useCallback((index) => {
    const clamped = Math.min(Math.max(index, 0), plot.pages.length - 1);
    onPageChange && onPageChange(clamped);
  }, [plot.pages.length, onPageChange]);

  // ── Load a plot by uid from the search-select modal ──────────────────────
  const handleLoadPlot = useCallback(async (uid) => {
    if (!uid) return;
    const match = plotList.find(p => p.uid === uid);
    if (!match) {
      toast.info(`Plot not found`);
      return;
    }
    try {
      const response = await fetch(`/anytale/plot/${encodeURIComponent(match.uid)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const fullPlot = await response.json();
      setPlot(fullPlot);
      setSavedPlot(fullPlot);
      onPageChange && onPageChange(0);
      onPlotReset && onPlotReset();
      toast.success(`Loaded plot '${fullPlot.name || match.uid}'`);
    } catch (err) {
      console.error('[PlotSection] Failed to load plot:', err);
      toast.error('Failed to load plot');
    }
    setLoadModalOpen(false);
  }, [plotList, toast, onPageChange, onPlotReset]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const uid = plot.uid || plot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plot-' + Date.now();
    const plotToSave = { ...plot, uid };
    try {
      await savePlot(uid, plotToSave);
      setPlot(plotToSave);
      setSavedPlot(plotToSave);
      // Refresh autocomplete list
      const list = await fetchPlotList();
      if (Array.isArray(list)) setPlotList(list);
      toast.success(`Plot '${plotToSave.name || uid}' saved`);
    } catch (err) {
      console.error('[PlotSection] Save failed:', err);
      toast.error(err.message || 'Failed to save plot');
    }
  }, [plot, toast]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!plot.uid) {
      toast.info('This plot has not been saved yet');
      return;
    }
    const result = await showDialog(
      `Are you sure you want to delete the plot "${plot.name || plot.uid}"? This cannot be undone.`,
      'Delete Plot',
      ['Delete', 'Cancel']
    );
    if (result !== 'Delete') return;
    try {
      await deletePlot(plot.uid);
      const list = await fetchPlotList();
      if (Array.isArray(list)) setPlotList(list);
      const blank = createBlankPlot();
      setPlot(blank);
      setSavedPlot(null);
      onPageChange && onPageChange(0);
      onPlotReset && onPlotReset();
      toast.success('Plot deleted');
    } catch (err) {
      console.error('[PlotSection] Delete failed:', err);
      toast.error(err.message || 'Failed to delete plot');
    }
  }, [plot, toast, onPageChange]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = useCallback(async () => {
    const result = await showDialog(
      'Reset the active plot to a blank block? Unsaved changes will be lost.',
      'Clear Plot',
      ['Clear', 'Cancel']
    );
    if (result !== 'Clear') return;
    const blank = createBlankPlot();
    setPlot(blank);
    setSavedPlot(null);
    onPageChange && onPageChange(0);
    onPlotReset && onPlotReset();
  }, [onPageChange, onPlotReset]);

  // ── Page management ───────────────────────────────────────────────────────
  const handleAddPage = useCallback(() => {
    const insertAt = currentPageIndex + 1;
    const duplicate = { ...JSON.parse(JSON.stringify(currentPage)), actions: [] };
    setPlot(prev => {
      const newPages = [...prev.pages];
      newPages.splice(insertAt, 0, duplicate);
      return { ...prev, pages: newPages };
    });
    if (onPageLockedChange) {
      const next = [...pageLocked];
      next.splice(insertAt, 0, false);
      onPageLockedChange(next);
    }
    onPageChange && onPageChange(insertAt);
  }, [currentPageIndex, currentPage, onPageChange, pageLocked, onPageLockedChange]);

  const handleDeletePage = useCallback(async () => {
    if (plot.pages.length <= 1) {
      toast.info('A plot must have at least one page');
      return;
    }
    const result = await showDialog(
      `Delete page ${currentPageIndex + 1} of ${pageCount}?`,
      'Delete Page',
      ['Delete', 'Cancel']
    );
    if (result !== 'Delete') return;
    setPlot(prev => {
      const newPages = prev.pages.filter((_, i) => i !== currentPageIndex);
      return { ...prev, pages: newPages };
    });
    if (onPageLockedChange) {
      const next = pageLocked.filter((_, i) => i !== currentPageIndex);
      onPageLockedChange(next);
    }
    onPageChange && onPageChange(Math.min(currentPageIndex, plot.pages.length - 2));
  }, [plot.pages.length, currentPageIndex, pageCount, onPageChange, toast, pageLocked, onPageLockedChange]);

  // ── Slot options for the add-slot-requirement control ────────────────────
  const slotOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of libraryParts) {
      const types = Array.isArray(p.config?.type) ? p.config.type : Array.isArray(p.type) ? p.type : [];
      for (const t of types) {
        const lower = t?.trim().toLowerCase();
        if (lower && !seen.has(lower) && !characterSlotTypes.includes(lower)) {
          seen.add(lower);
          out.push(t.trim());
        }
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [libraryParts, characterSlotTypes]);

  const [addReqSlot, setAddReqSlot] = useState('');
  const [addReqStatus, setAddReqStatus] = useState('covering');

  // ── Pre-page slot statuses (before current page's actions) ────────────────
  const enabledParts = useMemo(() => parts.filter(p => p.data?.enabled !== false), [parts]);
  const priorSlotStatuses = useMemo(() => {
    return resolveSlotStatuses(enabledParts, plot.pages, currentPageIndex - 1);
  }, [enabledParts, plot.pages, currentPageIndex]);

  // ── Slot statuses visible in the pill list: exclude character slot types ───
  const filteredSlotStatuses = useMemo(() => {
    const filtered = new Map();
    for (const [slot, status] of priorSlotStatuses.entries()) {
      if (!characterSlotTypes.includes(slot)) filtered.set(slot, status);
    }
    return filtered;
  }, [priorSlotStatuses, characterSlotTypes]);

  // ── Import handler: load a plot from a media entry's stored plot data ──
  const importLoadPlot = useCallback(async ({ uid, name, page }) => {
    // 1. Same plot already loaded — skip reload, just navigate
    if (plot.uid && plot.uid === uid) {
      onPageChange && onPageChange(page);
      return;
    }

    // 2. Load by UID
    try {
      const response = await fetch(`/anytale/plot/${encodeURIComponent(uid)}`);
      if (response.ok) {
        const fullPlot = await response.json();
        setPlot(fullPlot);
        setSavedPlot(fullPlot);
        onPageChange && onPageChange(page);
        return;
      }
    } catch (_) {
      // fall through to name fallback
    }

    // 3. UID not found — name fallback
    const nameMatch = plotList.find(p => p.name === name);
    if (nameMatch) {
      try {
        const response = await fetch(`/anytale/plot/${encodeURIComponent(nameMatch.uid)}`);
        if (response.ok) {
          const fullPlot = await response.json();
          setPlot(fullPlot);
          setSavedPlot(fullPlot);
          onPageChange && onPageChange(page);
          return;
        }
      } catch (_) {
        // fall through to not-found
      }
    }

    // 4. Not found
    toast.info('Plot from image not found in library; parts were still restored.');
  }, [plot.uid, plotList, onPageChange, toast]);

  // Register / deregister the import handler with the parent
  useEffect(() => {
    if (onImportHandlerReady) onImportHandlerReady(importLoadPlot);
    return () => { if (onImportHandlerReady) onImportHandlerReady(null); };
  }, [importLoadPlot, onImportHandlerReady]);

  // ── Reject: unlock page and notify parent ────────────────────────────────
  const handleReject = useCallback(() => {
    if (!onPageLockedChange) return;
    const next = [...pageLocked];
    next[currentPageIndex] = false;
    onPageLockedChange(next);
    onReject?.({ plotUid: plot.uid, pageIndex: currentPageIndex });
  }, [onPageLockedChange, pageLocked, currentPageIndex, plot.uid, onReject]);

  const handleUnlock = useCallback(() => {
    if (!onPageLockedChange) return;
    const next = [...pageLocked];
    next[currentPageIndex] = false;
    onPageLockedChange(next);
  }, [onPageLockedChange, pageLocked, currentPageIndex, plot.uid, onReject]);  

  // ── Plot-level slot requirements handlers ────────────────────────────────
  const cycleSlotRequirement = useCallback((slot) => {
    const current = (plot.slotRequirements || {})[slot];
    const idx = SLOT_REQ_STATUSES.indexOf(current);
    const next = SLOT_REQ_STATUSES[idx + 1]; // undefined when at end → remove
    const updated = { ...(plot.slotRequirements || {}) };
    if (next === undefined) {
      delete updated[slot];
    } else {
      updated[slot] = next;
    }
    setPlot(prev => ({ ...prev, slotRequirements: updated }));
  }, [plot.slotRequirements]);

  const addSlotRequirement = useCallback(() => {
    const slot = addReqSlot || slotOptions[0] || '';
    if (!slot) return;
    setPlot(prev => ({
      ...prev,
      slotRequirements: { ...(prev.slotRequirements || {}), [slot]: addReqStatus }
    }));
  }, [addReqSlot, addReqStatus, slotOptions]);

  // ── Smart button state ────────────────────────────────────────────────────
  const isInLibrary = Boolean(plot.uid) && plotList.some(p => p.uid === plot.uid);
  const saveLabel = isInLibrary ? 'Update' : 'Save';
  const isSaveDisabled = isInLibrary && savedPlot !== null && JSON.stringify(plot) === JSON.stringify(savedPlot);
  const isDeleteDisabled = !isInLibrary;
  const isRevertDisabled = !isInLibrary || savedPlot === null || isSaveDisabled;

  const handleRevert = useCallback(async () => {
    if (!savedPlot) return;
    const result = await showDialog('Revert this plot to the saved library version? Unsaved changes will be lost.', 'Revert Plot', ['Revert', 'Cancel']);
    if (result !== 'Revert') return;
    setPlot(savedPlot);
  }, [savedPlot]);

  // ============================================================================
  // Render
  // ============================================================================

  return html`
    <${SectionWrapper}>
      <${HorizontalEdgesLayout}>
        <${H2}>Plot</${H2}>
        <${Button} variant="small-text" color="secondary" icon="folder-open" onClick=${() => setLoadModalOpen(true)}>Load<//>
      </${HorizontalEdgesLayout}>

      <${VerticalLayout} gap="small">
        <${Input}
          label="Plot Name"
          value=${plot.name}
          onInput=${(e) => setPlot(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Plot name"
          widthScale="full"
        />
        <${Input}
          label="Section"
          value=${plot.section}
          onInput=${(e) => setPlot(prev => ({ ...prev, section: e.target.value }))}
          placeholder="e.g. prelude"
          widthScale="full"
        />
        <${Input}
          label="Description"
          value=${plot.description || ''}
          onInput=${(e) => setPlot(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of this plot..."
          widthScale="full"
          multiline
          rows=${2}
        />
      </${VerticalLayout}>

      <!-- Page section -->
      <${VerticalLayout} gap="medium">
        <${H2}>Page</${H2}>

        <!-- Plot-level slot requirements -->
        <${VerticalLayout} gap="small">
          <${PlotReqPillRow}>
            ${Object.entries(plot.slotRequirements || {}).map(([slot, status]) => html`
              <${PlotReqPill}
                key=${slot}
                style=${{ backgroundColor: (SLOT_REQ_BG[status] || SLOT_REQ_BG.covering)() }}
                onClick=${() => cycleSlotRequirement(slot)}
                title="Click to cycle status; cycles off to remove"
              >
                ${slot}: ${status}
              </${PlotReqPill}>
            `)}
            ${slotOptions.length > 0 && html`
              <${HorizontalLayout} gap="small" style="align-items: flex-end; flex-wrap: wrap;">
                <${Select}
                  heightScale="compact"
                  value=${addReqSlot || slotOptions[0] || ''}
                  options=${slotOptions.map(s => ({ label: s, value: s }))}
                  onChange=${(e) => setAddReqSlot(e.target.value)}
                />
                <${Select}
                  heightScale="compact"
                  value=${addReqStatus}
                  options=${SLOT_REQ_STATUSES.map(s => ({ label: s, value: s }))}
                  onChange=${(e) => setAddReqStatus(e.target.value)}
                />
                <${Button}
                  variant="medium-icon"
                  icon="plus"
                  title="Add slot requirement"
                  onClick=${addSlotRequirement}
                />
              </${HorizontalLayout}>
            `}
          </${PlotReqPillRow}>
        </${VerticalLayout}>

        <!-- Unified slot/part pill list -->
        <${PlotPagePills}
          slotStatuses=${filteredSlotStatuses}
          activeParts=${enabledParts}
          page=${currentPage}
          onChange=${(updatedPage) => updatePage(currentPageIndex, updatedPage)}
          disabled=${isCurrentPageLocked}
        />

        <!-- Action Description -->
        <${Input}
          label="Action Description for Dialog Prompt"
          value=${currentPage.dialogPrompt || ''}
          onInput=${(e) => updatePage(currentPageIndex, { ...currentPage, dialogPrompt: e.target.value })}
          placeholder="Describe the action for the dialog prompt"
          widthScale="full"
          disabled=${isCurrentPageLocked}
        />

        <!-- Page Tags -->
        <${TagInput}
          label="Page Tags"
          value=${currentPage.tags}
          onInput=${(text) => updatePage(currentPageIndex, { ...currentPage, tags: text })}
          rows=${2}
          placeholder="Comma-separated tags for this page"
          disabled=${isCurrentPageLocked}
        />

        <!-- Navigation row -->
        <${HorizontalEdgesLayout}>
          <${HorizontalLayout} gap="small" style="align-items: center;">
            <${NavigatorControl}
              currentPage=${currentPageIndex}
              totalPages=${pageCount}
              onPrev=${() => navigateTo(currentPageIndex - 1)}
              onNext=${() => navigateTo(currentPageIndex + 1)}
              onFirst=${() => navigateTo(0)}
              onLast=${() => navigateTo(pageCount - 1)}
              showFirstLast=${true}
            />
            <${Button} variant="medium-icon" icon="plus" color="secondary" onClick=${handleAddPage}></${Button}>
            <${Button}
              variant="medium-icon"
              icon="unlock"
              disabled=${!isCurrentPageLocked}
              onClick=${handleUnlock}
            >Reject<//>
            <${Button}
            <${Button} 
              variant="medium-icon"
              icon="trash" color="danger"
              style=${{ marginLeft: 'auto' }}
              onClick=${handleDeletePage}
              disabled=${pageCount <= 1}></${Button}>
          </${HorizontalLayout}>
          <${HorizontalLayout} gap="small" style="align-items: center;">
            <${Button}
              variant="small-text"
              icon="trash"
              disabled=${!isCurrentPageLocked}
              onClick=${handleReject}
            >Reject<//>
            <${Button}
              disabled=${!isCurrentPageLocked}
            variant="small-text" icon="plus" color="secondary" onClick=${handleAddPage}>Extend</${Button}>
          </${HorizontalLayout}>
        </${HorizontalEdgesLayout}>
      </${VerticalLayout}>

      <${ButtonRow}>
        <${Button} variant="small-text" color="primary" icon="save" onClick=${handleSave} disabled=${isSaveDisabled}>
          ${saveLabel}
        <//>
        <${Button} variant="small-text" color="secondary" icon="undo" onClick=${handleRevert} disabled=${isRevertDisabled}>
          Revert
        <//>
        <${Button} variant="small-text" color="danger" icon="trash" onClick=${handleDelete} disabled=${isDeleteDisabled}>
          Delete
        <//>
        <${Button} variant="small-text" color="danger" icon="x" onClick=${handleClear}>
          Clear Plot
        <//>
      </${ButtonRow}>

      <${SearchSelectModal}
        isOpen=${loadModalOpen}
        title="Load Plot"
        items=${plotList.map(p => {
          const suffix = p.section?.trim() ? ` (${p.section.trim()})` : '';
          return { label: (p.name || p.uid) + suffix, value: p.uid };
        })}
        mode="single"
        onSelect=${handleLoadPlot}
        onClose=${() => setLoadModalOpen(false)}
      />
    </${SectionWrapper}>
  `;
}
