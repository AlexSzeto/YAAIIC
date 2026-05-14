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
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { NavigatorControl } from '../../custom-ui/nav/navigator.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';
import { ChipAutocompleteInput } from '../chip-autocomplete-input.mjs';
import { TagInput } from '../tags/tag-input.mjs';
import { H2, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { loadPlot, savePlotState, createBlankPlot } from './anytale-state.mjs';
import { fetchPlotList, savePlot, deletePlot } from './plot-api.mjs';

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
 */
export function PlotSection({ parts = [], activePage = 0, onPageChange, pageLocked = [], onPageLockedChange, onPlotReset, onImportHandlerReady }) {
  const toast = useToast();
  const [plot, setPlot] = useState(() => loadPlot());
  const [plotList, setPlotList] = useState([]);
  // Tracks the last version saved to / loaded from the server for change detection.
  const [savedPlot, setSavedPlot] = useState(null);
  // Load-plot modal state
  const [loadModalOpen, setLoadModalOpen] = useState(false);

  // Clamp activePage to valid range
  const pageCount = plot.pages.length;
  const currentPageIndex = Math.min(Math.max(activePage, 0), pageCount - 1);
  const currentPage = plot.pages[currentPageIndex] || { tags: '', hiddenParts: [] };
  const isCurrentPageLocked = pageLocked[currentPageIndex] === true;

  // ── Load plot list for autocomplete ──────────────────────────────────────
  useEffect(() => {
    fetchPlotList()
      .then(list => { if (Array.isArray(list)) setPlotList(list); })
      .catch(err => console.error('[PlotSection] Failed to fetch plot list:', err));
  }, []);

  // ── Persist on every change ───────────────────────────────────────────────
  useEffect(() => {
    savePlotState(plot);
  }, [plot]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const updatePage = useCallback((index, updatedPage) => {
    setPlot(prev => {
      const newPages = [...prev.pages];
      newPages[index] = updatedPage;
      return { ...prev, pages: newPages };
    });
  }, []);

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
    const duplicate = JSON.parse(JSON.stringify(currentPage));
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

  // ── Part modifier helpers are handled inline by DynamicList ─────────────

  // Build autocomplete suggestions from all part names and types
  const hiddenPartsSuggestions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of parts) {
      const types = Array.isArray(p.config?.type) ? p.config.type : [];
      for (const val of [p.config?.name, ...types]) {
        if (val && val.trim() && !seen.has(val.toLowerCase())) {
          seen.add(val.toLowerCase());
          out.push(val.trim());
        }
      }
    }
    return out;
  }, [parts]);

  const progressionSectionsSuggestions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of plotList) {
      const s = (p.section || '').trim();
      if (s && !seen.has(s.toLowerCase())) {
        seen.add(s.toLowerCase());
        out.push(s);
      }
    }
    return out;
  }, [plotList]);

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

  // ── Smart button state ────────────────────────────────────────────────────
  const isInLibrary = Boolean(plot.uid) && plotList.some(p => p.uid === plot.uid);
  const saveLabel = isInLibrary ? 'Update' : 'Save';
  const isSaveDisabled = isInLibrary && savedPlot !== null && JSON.stringify(plot) === JSON.stringify(savedPlot);
  const isDeleteDisabled = !isInLibrary;

  // ============================================================================
  // Render
  // ============================================================================

  return html`
    <${SectionWrapper}>
      <${H2}>Plot</${H2}>

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

      <!-- Page section: tags, hidden parts, navigation (no outline wrapper) -->
      <${VerticalLayout} gap="medium">
        <${H2}>Page</${H2}>
        <${TagInput}
          label="Page Tags"
          value=${currentPage.tags}
          onInput=${(text) => updatePage(currentPageIndex, { ...currentPage, tags: text })}
          rows=${2}
          placeholder="Comma-separated tags for this page"
          disabled=${isCurrentPageLocked}
        />

        <${Input}
          label="Action Description for Dialog Prompt"
          value=${currentPage.dialogPrompt || ''}
          onInput=${(e) => updatePage(currentPageIndex, { ...currentPage, dialogPrompt: e.target.value })}
          placeholder="Describe the action for the dialog prompt"
          widthScale="full"
          disabled=${isCurrentPageLocked}
        />

        <${ChipAutocompleteInput}
          label="Hidden Parts"
          placeholder="Type a part name or type to hide..."
          suggestions=${hiddenPartsSuggestions}
          disabled=${isCurrentPageLocked}
          values=${currentPage.hiddenParts || []}
          onValuesChange=${(newValues) => updatePage(currentPageIndex, { ...currentPage, hiddenParts: newValues })}
        />

        <!-- Navigation row -->
        <${NavRow}>
          <${NavigatorControl}
            currentPage=${currentPageIndex}
            totalPages=${pageCount}
            onPrev=${() => navigateTo(currentPageIndex - 1)}
            onNext=${() => navigateTo(currentPageIndex + 1)}
            onFirst=${() => navigateTo(0)}
            onLast=${() => navigateTo(pageCount - 1)}
            showFirstLast=${true}
          />
          <${Button} variant="medium-icon" icon="plus" title="Add page" onClick=${handleAddPage} />
          <${Button} variant="medium-icon" icon="trash" title="Delete page" onClick=${handleDeletePage} disabled=${pageCount <= 1} />
          <${Button}
            variant="small-text"
            icon="unlock"
            style=${{ marginLeft: 'auto' }}
            disabled=${!isCurrentPageLocked}
            onClick=${() => {
              if (!onPageLockedChange) return;
              const next = [...pageLocked];
              next[currentPageIndex] = false;
              onPageLockedChange(next);
            }}
          >Unlock<//>
        </${NavRow}>
      </${VerticalLayout}>

      <!-- Progression section: progression types and disabled parts -->
      <${VerticalLayout} gap="medium">
        <${H2}>Progression</${H2}>
        <${ChipAutocompleteInput}
          label="Progression Sections"
          placeholder="Add a section name..."
          suggestions=${progressionSectionsSuggestions}
          values=${plot.progressionSections || []}
          onValuesChange=${(newValues) => setPlot(prev => ({ ...prev, progressionSections: newValues }))}
        />
        <${ChipAutocompleteInput}
          label="Disabled Parts"
          placeholder="Type a part name or type to disable..."
          suggestions=${hiddenPartsSuggestions}
          values=${plot.progressionDisabledParts || []}
          onValuesChange=${(newValues) => setPlot(prev => ({ ...prev, progressionDisabledParts: newValues }))}
        />
      </${VerticalLayout}>

      <${ButtonRow}>
        <${Button} variant="medium-text" color="secondary" icon="folder-open" onClick=${() => setLoadModalOpen(true)}>
          Load
        <//>
        <${Button} variant="medium-text" color="primary" icon="save" onClick=${handleSave} disabled=${isSaveDisabled}>
          ${saveLabel}
        <//>
        <${Button} variant="medium-text" color="secondary" icon="trash" onClick=${handleDelete} disabled=${isDeleteDisabled}>
          Delete
        <//>
        <${Button} variant="medium-text" color="secondary" icon="x" onClick=${handleClear}>
          Clear Plot
        <//>
      </${ButtonRow}>

      <${SearchSelectModal}
        isOpen=${loadModalOpen}
        title="Load Plot"
        items=${plotList.map(p => ({ label: p.name || p.uid, value: p.uid }))}
        mode="single"
        onSelect=${handleLoadPlot}
        onClose=${() => setLoadModalOpen(false)}
      />
    </${SectionWrapper}>
  `;
}
