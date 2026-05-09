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
import { useState, useEffect, useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Checkbox } from '../../custom-ui/io/checkbox.mjs';
import { NavigatorControl } from '../../custom-ui/nav/navigator.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { AutocompleteInput } from '../autocomplete-input.mjs';
import { H2, H3, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { loadPlot, savePlotState, createBlankPlot } from './anytale-state.mjs';
import { fetchPlotList, savePlot, deletePlot } from './plot-api.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const SectionWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.small.gap};
  padding-top: ${() => currentTheme.value.spacing.medium.padding};
`;
SectionWrapper.className = 'plot-section-wrapper';

const SectionTitle = styled('div')`
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  color: ${() => currentTheme.value.colors.text.primary};
`;
SectionTitle.className = 'plot-section-title';

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

const PartModifierRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
`;
PartModifierRow.className = 'plot-part-modifier-row';

const PartModifierList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
PartModifierList.className = 'plot-part-modifier-list';

const RemoveButton = styled('button')`
  background: none;
  border: none;
  cursor: pointer;
  color: ${() => currentTheme.value.colors.text.muted};
  padding: 2px 4px;
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  flex-shrink: 0;

  &:hover {
    color: ${() => currentTheme.value.colors.status.error};
  }
`;
RemoveButton.className = 'plot-remove-btn';

// ============================================================================
// Component
// ============================================================================

/**
 * @param {Object}   props
 * @param {Array}    [props.parts=[]]        – Current parts list (for identifier hints)
 * @param {number}   [props.activePage=0]    – Controlled active page index
 * @param {Function} [props.onPageChange]    – Called when the active page index changes
 */
export function PlotSection({ parts = [], activePage = 0, onPageChange }) {
  const toast = useToast();
  const [plot, setPlot] = useState(() => loadPlot());
  const [plotList, setPlotList] = useState([]);

  // Clamp activePage to valid range
  const pageCount = plot.pages.length;
  const currentPageIndex = Math.min(Math.max(activePage, 0), pageCount - 1);
  const currentPage = plot.pages[currentPageIndex] || { tags: '', parts: [] };

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

  // ── Load a plot by name from autocomplete ─────────────────────────────────
  const handleLoadPlot = useCallback(async (inputValue) => {
    const trimmed = (inputValue || '').trim();
    if (!trimmed) return;
    const match = plotList.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (!match) {
      toast.info(`No saved plot named '${trimmed}' found`);
      return;
    }
    try {
      const response = await fetch(`/anytale/plot/${encodeURIComponent(match.uid)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const fullPlot = await response.json();
      setPlot(fullPlot);
      onPageChange && onPageChange(0);
      toast.success(`Loaded plot '${fullPlot.name || match.uid}'`);
    } catch (err) {
      console.error('[PlotSection] Failed to load plot:', err);
      toast.error('Failed to load plot');
    }
  }, [plotList, toast, onPageChange]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const uid = plot.uid || plot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plot-' + Date.now();
    const plotToSave = { ...plot, uid };
    try {
      await savePlot(uid, plotToSave);
      setPlot(plotToSave);
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
      onPageChange && onPageChange(0);
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
    onPageChange && onPageChange(0);
  }, [onPageChange]);

  // ── Page management ───────────────────────────────────────────────────────
  const handleAddPage = useCallback(() => {
    setPlot(prev => ({
      ...prev,
      pages: [...prev.pages, { tags: '', parts: [] }],
    }));
    onPageChange && onPageChange(plot.pages.length); // navigate to new page
  }, [plot.pages.length, onPageChange]);

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
    onPageChange && onPageChange(Math.min(currentPageIndex, plot.pages.length - 2));
  }, [plot.pages.length, currentPageIndex, pageCount, onPageChange, toast]);

  // ── Part modifier helpers ─────────────────────────────────────────────────
  const updatePartModifier = useCallback((modIdx, field, value) => {
    const updatedParts = [...(currentPage.parts || [])];
    updatedParts[modIdx] = { ...updatedParts[modIdx], [field]: value };
    updatePage(currentPageIndex, { ...currentPage, parts: updatedParts });
  }, [currentPage, currentPageIndex, updatePage]);

  const addPartModifier = useCallback(() => {
    const updatedParts = [...(currentPage.parts || []), { identifier: '', forceDisable: false, templateTag: '' }];
    updatePage(currentPageIndex, { ...currentPage, parts: updatedParts });
  }, [currentPage, currentPageIndex, updatePage]);

  const removePartModifier = useCallback((modIdx) => {
    const updatedParts = (currentPage.parts || []).filter((_, i) => i !== modIdx);
    updatePage(currentPageIndex, { ...currentPage, parts: updatedParts });
  }, [currentPage, currentPageIndex, updatePage]);

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
        <${AutocompleteInput}
          label="Load Plot by Name"
          placeholder="Type to search saved plots..."
          suggestions=${plotList.map(p => p.name)}
          onSelect=${handleLoadPlot}
        />
      </${VerticalLayout}>

      <${ButtonRow}>
        <${Button} variant="medium-text" color="primary" icon="save" onClick=${handleSave}>
          Save
        <//>
        <${Button} variant="medium-text" color="danger" icon="trash" onClick=${handleDelete} disabled=${!plot.uid}>
          Delete
        <//>
        <${Button} variant="medium-text" color="secondary" icon="x" onClick=${handleClear}>
          Clear
        <//>
      </${ButtonRow}>

      <!-- Page navigation row -->
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
        <${Button} variant="small-icon" icon="plus" title="Add page" onClick=${handleAddPage} />
        <${Button} variant="small-icon" icon="trash" title="Delete page" onClick=${handleDeletePage} disabled=${pageCount <= 1} />
      </${NavRow}>

      <!-- Page editor -->
      <${VerticalLayout} gap="small">
        <${Input}
          label="Page Tags"
          value=${currentPage.tags}
          onInput=${(e) => updatePage(currentPageIndex, { ...currentPage, tags: e.target.value })}
          placeholder="Comma-separated tags for this page"
          widthScale="full"
        />

        <div>
          <div style="font-size: ${currentTheme.value.typography.fontSize.small}; color: ${currentTheme.value.colors.text.secondary}; margin-bottom: 4px;">
            Part Modifiers
          </div>
          <${PartModifierList}>
            ${(currentPage.parts || []).map((mod, modIdx) => html`
              <${PartModifierRow} key=${modIdx}>
                <${Input}
                  value=${mod.identifier}
                  onInput=${(e) => updatePartModifier(modIdx, 'identifier', e.target.value)}
                  placeholder="Part name or type"
                  widthScale="full"
                />
                <${Checkbox}
                  label="Disable"
                  checked=${mod.forceDisable}
                  onChange=${(e) => updatePartModifier(modIdx, 'forceDisable', e.target.checked)}
                />
                <${Input}
                  value=${mod.templateTag}
                  onInput=${(e) => updatePartModifier(modIdx, 'templateTag', e.target.value)}
                  placeholder="Tag template (use {{name}})"
                  widthScale="full"
                />
                <${RemoveButton} onClick=${() => removePartModifier(modIdx)} title="Remove modifier">✕</${RemoveButton}>
              </${PartModifierRow}>
            `)}
          </${PartModifierList}>
          <${Button} variant="small-text" icon="plus" onClick=${addPartModifier} style="margin-top: 4px;">
            Add Modifier
          <//>
        </div>
      </${VerticalLayout}>
    </${SectionWrapper}>
  `;
}
