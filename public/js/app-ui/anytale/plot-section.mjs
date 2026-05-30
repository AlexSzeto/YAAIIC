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
import { Textarea } from '../../custom-ui/io/textarea.mjs';
import { NavigatorControl } from '../../custom-ui/nav/navigator.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';
import { TagInput } from '../tags/tag-input.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
import { H2, Label, VerticalLayout, HorizontalLayout, HorizontalEdgesLayout } from '../../custom-ui/themed-base.mjs';
import { loadPlot, savePlotState, createBlankPlot, getPartsCoverage } from './anytale-state.mjs';
import { assemblePrompt, expandDialogPrompt } from './prompt-assembler.mjs';
import { formButtonStates } from '../forms.mjs';
import { fetchPlotList, savePlot, deletePlot } from './plot-api.mjs';
import { resolveSlotStatuses, checkPageRequirements } from './slot-resolver.mjs';
import { PlotPagePills } from './plot-page-pills.mjs';
import { PlotRequirementsEditor } from './plot-requirements-editor.mjs';
import { CollapsiblePanel } from '../../custom-ui/layout/collapsible-panel.mjs';
import { Icon } from '../../custom-ui/layout/icon.mjs';
import { ChipAutocompleteInput } from '../chip-autocomplete-input.mjs';
import { generateDialog } from '../anytale-play/play-dialog.mjs';
import { filterDialogText, findAllMatchingSfx } from '../anytale-play/play-utils.mjs';
import { SfxMatchPill } from './sfx-match-pill.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const SectionWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.large.gap};
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

const SfxPillRow = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${() => currentTheme.value.spacing.small.gap};
  align-items: center;
`;
SfxPillRow.className = 'sfx-pill-row';

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
 * @param {Function} [props.onRejectOthers]            – Called with ({ plotUid, pageIndex }) to delete all renders except the current viewer image
 * @param {Function} [props.onBulkDialogReady]         – Called with (fn) when bulkDialogGenerate is ready; null on unmount
 * @param {Array}    [props.libraryParts=[]]           – Up-to-date library parts from the parent; used to build slot type options
 */
export function PlotSection({ parts = [], activePage = 0, onPageChange, pageLocked = [], onPageLockedChange, onPlotReset, onImportHandlerReady, onPlotChange, refreshKey = 0, onPageTagsUpdateReady, onReject, onRejectOthers, onViewPageImage, onBulkDialogReady, onCurrentDialogReady, libraryParts = [], history = [] }) {
  const toast = useToast();
  const [plot, setPlot] = useState(() => loadPlot());
  const [plotList, setPlotList] = useState([]);
  // Tracks the last version saved to / loaded from the server for change detection.
  const [savedPlot, setSavedPlot] = useState(null);
  const [recoveryPlot, setRecoveryPlot] = useState(null);
  const [recoveryPage, setRecoveryPage] = useState(null); // { page, index }
  const [plotReqExpanded, setPlotReqExpanded] = useState(true);
  const [dialogExpanded, setDialogExpanded] = useState(true);
  const [sfxExpanded, setSfxExpanded] = useState(true);

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
  // libraryParts is received as a prop from anytale-form.mjs (always up-to-date)
  const [characterSlotTypes, setCharacterSlotTypes] = useState([]);
  const [outfitSlotTypes, setOutfitSlotTypes] = useState([]);
  const [dialogConfig, setDialogConfig] = useState(null);
  const [dialogPreview, setDialogPreview] = useState(null);
  const [dialogPreviews, setDialogPreviews] = useState({});
  const [isPreviewingDialog, setIsPreviewingDialog] = useState(false);
  const [sfxList, setSfxList] = useState([]);

  // Clamp activePage to valid range
  const pageCount = plot.pages.length;
  const currentPageIndex = Math.min(Math.max(activePage, 0), pageCount - 1);
  const currentPage = plot.pages[currentPageIndex] || { tags: '', actions: [] };
  const isCurrentPageLocked = pageLocked[currentPageIndex] === true;
  const hasMediaForCurrentPage = history.some(
    item => item.plot?.uid === plot.uid && item.plot?.page === currentPageIndex
  );

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

  // ── Load character slot types and dialog config ───────────────────────────
  useEffect(() => {
    fetch('/anytale/config')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        if (Array.isArray(data.recommendedCharacterPartTypes)) {
          setCharacterSlotTypes(data.recommendedCharacterPartTypes.map(t => t.toLowerCase()));
        }
        if (Array.isArray(data.recommendedOutfitPartTypes)) {
          setOutfitSlotTypes(data.recommendedOutfitPartTypes.map(t => t.toLowerCase()));
        }
        if (data.dialog) setDialogConfig(data.dialog);
        if (data.dialogPreview) setDialogPreview(data.dialogPreview);
      })
      .catch(err => console.error('[PlotSection] Failed to fetch anytale config:', err));
  }, []);

  // ── Load SFX library for match indicator ──────────────────────────────────
  useEffect(() => {
    fetch('/anytale/sfx')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => { if (Array.isArray(data)) setSfxList(data); })
      .catch(err => console.error('[PlotSection] Failed to fetch SFX list:', err));
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
    setRecoveryPage(null);
    onPageChange && onPageChange(clamped);
    if (plot.uid && onViewPageImage) {
      onViewPageImage({ plotUid: plot.uid, pageIndex: clamped });
    }
  }, [plot.pages.length, plot.uid, onPageChange, onViewPageImage]);

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
      setDialogPreviews({});
      setRecoveryPlot(null);
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
      setRecoveryPlot(null);
      toast.success(`Plot '${plotToSave.name || uid}' saved`);
    } catch (err) {
      console.error('[PlotSection] Save failed:', err);
      toast.error(err.message || 'Failed to save plot');
    }
  }, [plot, toast]);

  // ── Delete (confirmation kept; recovery slot added after confirm) ─────────
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
    const snapshot = { ...plot };
    const snapshotUid = plot.uid;
    const blank = createBlankPlot();
    setPlot(blank);
    setSavedPlot(null);
    setRecoveryPlot(snapshot);
    setRecoveryPage(null);
    onPageChange && onPageChange(0);
    onPlotReset && onPlotReset();
    try {
      await deletePlot(snapshotUid);
      const list = await fetchPlotList();
      if (Array.isArray(list)) setPlotList(list);
      toast.success('Plot deleted');
    } catch (err) {
      console.error('[PlotSection] Delete failed:', err);
      toast.error(err.message || 'Failed to delete plot');
    }
  }, [plot, toast, onPageChange, onPlotReset]);

  const handleRecoverPlot = useCallback(async () => {
    if (!recoveryPlot) return;
    const result = await showDialog(
      `Recover the plot "${recoveryPlot.name || recoveryPlot.uid}"?`,
      'Recover Plot',
      ['Recover', 'Cancel']
    );
    if (result !== 'Recover') return;
    try {
      await savePlot(recoveryPlot.uid, recoveryPlot);
      const list = await fetchPlotList();
      if (Array.isArray(list)) setPlotList(list);
      setPlot(recoveryPlot);
      setSavedPlot(recoveryPlot);
      setRecoveryPlot(null);
      onPageChange && onPageChange(0);
      onPlotReset && onPlotReset();
      toast.success(`Plot '${recoveryPlot.name || recoveryPlot.uid}' recovered`);
    } catch (err) {
      console.error('[PlotSection] Recovery failed:', err);
      toast.error(err.message || 'Failed to recover plot');
    }
  }, [recoveryPlot, toast, onPageChange, onPlotReset]);

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
    setDialogPreviews({});
    onPageChange && onPageChange(0);
    onPlotReset && onPlotReset();
  }, [onPageChange, onPlotReset]);

  // ── Page management ───────────────────────────────────────────────────────
  const handleAddPage = useCallback(() => {
    const insertAt = currentPageIndex + 1;
    const duplicate = { ...JSON.parse(JSON.stringify(currentPage)), actions: [] };
    setRecoveryPage(null);
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

  const handleDeletePage = useCallback(() => {
    if (plot.pages.length <= 1) {
      toast.info('A plot must have at least one page');
      return;
    }
    const deletedPage = plot.pages[currentPageIndex];
    setRecoveryPage({ page: deletedPage, index: currentPageIndex });
    setPlot(prev => {
      const newPages = prev.pages.filter((_, i) => i !== currentPageIndex);
      return { ...prev, pages: newPages };
    });
    if (onPageLockedChange) {
      const next = pageLocked.filter((_, i) => i !== currentPageIndex);
      onPageLockedChange(next);
    }
    onPageChange && onPageChange(Math.min(currentPageIndex, plot.pages.length - 2));
  }, [plot.pages, currentPageIndex, onPageChange, toast, pageLocked, onPageLockedChange]);

  const handleRecoverPage = useCallback(() => {
    if (!recoveryPage) return;
    const { page, index } = recoveryPage;
    setRecoveryPage(null);
    setPlot(prev => {
      const newPages = [...prev.pages];
      newPages.splice(index, 0, page);
      return { ...prev, pages: newPages };
    });
    if (onPageLockedChange) {
      const next = [...pageLocked];
      next.splice(index, 0, false);
      onPageLockedChange(next);
    }
    onPageChange && onPageChange(index);
  }, [recoveryPage, pageLocked, onPageLockedChange, onPageChange]);

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

  // ── Section name suggestions from the plot library ───────────────────────
  const progressionSectionSuggestions = useMemo(() => {
    const seen = new Set();
    return plotList
      .map(p => p.section?.trim())
      .filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  }, [plotList]);

  // ── SFX matches for current page ─────────────────────────────────────────
  const sfxMatches = useMemo(
    () => findAllMatchingSfx(currentPage.tags, sfxList),
    [currentPage.tags, sfxList]
  );

  // ── Pre-page slot statuses (before current page's actions) ────────────────
  const enabledParts = useMemo(() => parts.filter(p => p.data?.enabled !== false), [parts]);

  // Parts whose every type is a character slot type are excluded from name pills.
  const nonCharacterParts = useMemo(() => enabledParts.filter(p => {
    const types = Array.isArray(p.config?.type) ? p.config.type.map(t => t.trim().toLowerCase()) : [];
    return types.length === 0 || !types.every(t => characterSlotTypes.includes(t));
  }), [enabledParts, characterSlotTypes]);

  // Parts with at least one recommended outfit type — used to assemble the {{outfit}} dialog slot.
  const outfitPartsForDialog = useMemo(() => enabledParts.filter(p => {
    const types = Array.isArray(p.config?.type) ? p.config.type.map(t => t.trim().toLowerCase()) : [];
    return types.some(t => outfitSlotTypes.includes(t));
  }), [enabledParts, outfitSlotTypes]);
  const priorSlotStatuses = useMemo(() => {
    const coverage = getPartsCoverage();
    const partsWithCoverage = enabledParts.map(p => ({
      ...p, config: { ...p.config, isRevealing: coverage[p.config?.uid || p.id] ?? false }
    }));
    return resolveSlotStatuses(partsWithCoverage, plot.pages, currentPageIndex - 1);
  }, [enabledParts, plot.pages, currentPageIndex]);

  // Initial slot statuses (no page actions applied) — used for requirement checks.
  // Requirements are based on what parts are present at the start of the plot,
  // so a part removed mid-plot can still satisfy requirements on later pages.
  const initialSlotStatuses = useMemo(() => {
    const coverage = getPartsCoverage();
    const partsWithCoverage = enabledParts.map(p => ({
      ...p, config: { ...p.config, isRevealing: coverage[p.config?.uid || p.id] ?? false }
    }));
    return resolveSlotStatuses(partsWithCoverage, [], -1);
  }, [enabledParts]);

  // ── Whether current page's requirements are all satisfied ─────────────────
  const requirementsMet = useMemo(
    () => checkPageRequirements(currentPage, initialSlotStatuses, enabledParts),
    [currentPage, initialSlotStatuses, enabledParts]
  );

  // ── Whether the plot's entry requirements are satisfied by active parts ────
  const plotRequirementsMet = useMemo(() => {
    const reqs = plot.slotRequirements;
    if (!reqs || Object.keys(reqs).length === 0) return true;
    const libraryPartUidSet = new Set(libraryParts.map(p => p.uid).filter(Boolean));
    for (const [key, req] of Object.entries(reqs)) {
      if (libraryPartUidSet.has(key)) {
        // Part UID key — check whether the part is active
        const isActive = enabledParts.some(p => p.config?.uid === key);
        if (req === 'present' && !isActive) return false;
        if (req === 'absent' && isActive) return false;
      } else {
        // Slot type key — check slot status
        const status = initialSlotStatuses.get(key.trim().toLowerCase());
        if (req === 'present' && (!status || status === 'removed')) return false;
        if (req === 'absent' && status && status !== 'removed') return false;
      }
    }
    return true;
  }, [plot.slotRequirements, enabledParts, initialSlotStatuses, libraryParts]);


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

  const handleRejectOthers = useCallback(() => {
    onRejectOthers?.({ plotUid: plot.uid, pageIndex: currentPageIndex });
  }, [onRejectOthers, plot.uid, currentPageIndex]);


  // ── Dialog preview ───────────────────────────────────────────────────────
  const handlePreviewDialog = useCallback(async () => {
    if (!dialogConfig || !dialogPreview) return;
    if (isPreviewingDialog) return;
    setIsPreviewingDialog(true);
    try {
      const character = {
        name: dialogPreview.name || '',
        profile: dialogPreview.profile || '',
      };
      const locationAttributeValue = dialogPreview.location || '';
      const outfitText = assemblePrompt(outfitPartsForDialog, null, null);
      const pages = plot.pages.slice(0, currentPageIndex + 1);
      const history = [];
      for (let i = 0; i < pages.length; i++) {
        if (!pages[i].dialogPrompt?.trim()) continue;
        // Expand {{slot type}} tokens in the dialog prompt using enabled parts' display names
        const expandedPrompt = expandDialogPrompt(pages[i].dialogPrompt, enabledParts);
        const expandedPage = { ...pages[i], dialogPrompt: expandedPrompt };
        const result = filterDialogText(await generateDialog({
          character,
          locationAttributeValue,
          outfitText,
          page: expandedPage,
          dialogConfig,
          history,
        }));
        history.push({ role: 'user', content: expandedPrompt });
        history.push({ role: 'assistant', content: result });
        setDialogPreviews(prev => ({ ...prev, [i]: result }));
      }
    } catch (err) {
      toast.error(`Dialog preview failed: ${err.message}`);
    } finally {
      setIsPreviewingDialog(false);
    }
  }, [dialogConfig, dialogPreview, isPreviewingDialog, plot.pages, currentPageIndex, enabledParts, toast]);

  const previewDialogDisabled = !currentPage.dialogPrompt?.trim() || !dialogConfig || !dialogPreview
    || !(dialogPreview.name?.trim() && dialogPreview.profile?.trim());

  // ── Bulk dialog generation (triggered by Queue Plot) ─────────────────────
  // Returns a pageIndex → dialogText map so callers can attach dialog to each generation payload.
  const bulkDialogGenerate = useCallback(async (queuedPageIndices) => {
    const results = {};
    if (!dialogConfig || !dialogPreview) return results;
    if (isPreviewingDialog) return results;
    const queuedSet = new Set(queuedPageIndices);
    // Clear all existing dialog previews before regenerating
    setDialogPreviews({});
    setIsPreviewingDialog(true);
    try {
      const character = {
        name: dialogPreview.name || '',
        profile: dialogPreview.profile || '',
      };
      const locationAttributeValue = dialogPreview.location || '';
      const outfitText = assemblePrompt(outfitPartsForDialog, null, null);
      const history = [];
      for (let i = 0; i < plot.pages.length; i++) {
        if (!queuedSet.has(i)) continue;
        if (!plot.pages[i].dialogPrompt?.trim()) continue;
        const expandedPrompt = expandDialogPrompt(plot.pages[i].dialogPrompt, enabledParts);
        const expandedPage = { ...plot.pages[i], dialogPrompt: expandedPrompt };
        const result = filterDialogText(await generateDialog({
          character,
          locationAttributeValue,
          outfitText,
          page: expandedPage,
          dialogConfig,
          history,
        }));
        history.push({ role: 'user', content: expandedPrompt });
        history.push({ role: 'assistant', content: result });
        results[i] = result;
        setDialogPreviews(prev => ({ ...prev, [i]: result }));
      }
    } catch (err) {
      toast.error(`Bulk dialog generation failed: ${err.message}`);
    } finally {
      setIsPreviewingDialog(false);
    }
    return results;
  }, [dialogConfig, dialogPreview, isPreviewingDialog, plot.pages, enabledParts, toast]);

  useEffect(() => {
    if (onBulkDialogReady) onBulkDialogReady(bulkDialogGenerate);
    return () => { if (onBulkDialogReady) onBulkDialogReady(null); };
  }, [bulkDialogGenerate, onBulkDialogReady]);

  // Expose a getter so the parent can read the dialog preview for any page index
  const getCurrentDialogPreview = useCallback((pageIndex) => dialogPreviews[pageIndex] || '', [dialogPreviews]);
  useEffect(() => {
    if (onCurrentDialogReady) onCurrentDialogReady(getCurrentDialogPreview);
    return () => { if (onCurrentDialogReady) onCurrentDialogReady(null); };
  }, [getCurrentDialogPreview, onCurrentDialogReady]);

  // ── Smart button state ────────────────────────────────────────────────────
  const isInLibrary = Boolean(plot.uid) && plotList.some(p => p.uid === plot.uid);
  const plotDirty = !(isInLibrary && savedPlot !== null && JSON.stringify(plot) === JSON.stringify(savedPlot));
  const { saveLabel, saveEnabled, deleteEnabled, revertEnabled } = formButtonStates(isInLibrary, plotDirty);

  const handleRevert = useCallback(async () => {
    if (!savedPlot) return;
    const result = await showDialog('Revert this plot to the saved library version? Unsaved changes will be lost.', 'Revert Plot', ['Revert', 'Cancel']);
    if (result !== 'Revert') return;
    setPlot(savedPlot);
    setRecoveryPage(null);
  }, [savedPlot]);

  // ============================================================================
  // Render
  // ============================================================================

  return html`
    <${Panel} variant="outlined">
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
        <${Input}
          label="Notes"
          value=${plot.notes || ''}
          onInput=${(e) => setPlot(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Internal notes (not used functionally)..."
          widthScale="full"
          multiline
          rows=${3}
        />
      </${VerticalLayout}>

      <!-- Plot-level requirements editor -->
      <${CollapsiblePanel}
        expanded=${plotReqExpanded}
        onExpand=${() => setPlotReqExpanded(p => !p)}
        header=${html`
          <${HorizontalLayout} gap="small" style="align-items: center;">
            <${Label}>Plot Requirements</${Label}>
            <span style=${{
              display: 'inline-flex',
              gap: '8px',
              alignItems: 'center',
              padding: '2px 10px',
              borderRadius: '9999px',
              fontSize: currentTheme.value.typography.fontSize.small,
              backgroundColor: plotRequirementsMet
                ? currentTheme.value.colors.secondary.backgroundLight
                : currentTheme.value.colors.danger.backgroundLight,
            }}>
              <${Icon} name=${plotRequirementsMet ? 'radio-circle-marked' : 'radio-circle'} size="14px" ></${Icon}>
              ${plotRequirementsMet ? 'requirements met' : 'requirements failed'}
            </span>
          </${HorizontalLayout}>
        `}
        content=${html`
          <div style=${{ marginTop: '8px' }}>
            <${PlotRequirementsEditor}
              plot=${plot}
              onChange=${setPlot}
              libraryParts=${parts}
              allLibraryParts=${libraryParts}
              slotOptions=${slotOptions}
            />
          </div>
        `}
      />

      <!-- Page section -->
      <${VerticalLayout} gap="medium">
        <${HorizontalLayout} gap="small" style="align-items: center;">
          <${H2}>Page</${H2}>
          <span style=${{
            display: 'inline-flex',
            gap: '8px',
            alignItems: 'center',
            padding: '2px 10px',
            borderRadius: '9999px',
            fontSize: currentTheme.value.typography.fontSize.small,
            backgroundColor: requirementsMet
              ? currentTheme.value.colors.secondary.backgroundLight
              : currentTheme.value.colors.danger.backgroundLight,
          }}>
            <${Icon} name=${requirementsMet ? 'radio-circle-marked' : 'radio-circle'} size="14px" ></${Icon}>
            ${requirementsMet ? 'requirements met - rendering' : 'requirements failed - skipping'}
          </span>
        </${HorizontalLayout}>

        <!-- Slot and part pill editors -->
        <${PlotPagePills}
          slotStatuses=${priorSlotStatuses}
          allSlots=${[...slotOptions, ...characterSlotTypes]}
          allLibraryParts=${parts}
          libraryParts=${libraryParts}
          page=${currentPage}
          onChange=${(updatedPage) => updatePage(currentPageIndex, updatedPage)}

        />

        <!-- Action Description -->
        <${CollapsiblePanel}
          expanded=${dialogExpanded}
          onExpand=${() => setDialogExpanded(p => !p)}
          header=${html`<${Label}>Action Description for Dialog Prompt</${Label}>`}
          content=${html`
            <${VerticalLayout} gap="small" style=${{ marginTop: '8px' }}>
              <${Textarea}
                label="Prompt"
                value=${currentPage.dialogPrompt || ''}
                onInput=${(e) => updatePage(currentPageIndex, { ...currentPage, dialogPrompt: e.target.value })}
                placeholder="Describe the action for the dialog prompt"
                widthScale="full"
                rows=${3}
              />
              <div>
                <${Button}
                  variant="small-text"
                  widthScale="normal"
                  icon="message-detail"
                  onClick=${handlePreviewDialog}
                  disabled=${previewDialogDisabled || isPreviewingDialog}
                  loading=${isPreviewingDialog}
                >${isPreviewingDialog ? 'Generating...' : 'Preview Dialog'}</${Button}>
              </div>
              ${dialogPreviews[currentPageIndex] ? html`
                <${Panel} variant="outlined" padding="small">
                  <${Label}>${dialogPreviews[currentPageIndex]}</${Label}>
                </${Panel}>
              ` : null}
            </${VerticalLayout}>
          `}
        />

        <!-- Page Tags -->
        <${TagInput}
          label="Page Tags"
          value=${currentPage.tags}
          onInput=${(text) => updatePage(currentPageIndex, { ...currentPage, tags: text })}
          fixedHeight=${200}
          placeholder="Comma-separated tags for this page"
        />

        <${HorizontalEdgesLayout}>
          <${Button}
            variant="small-text"
            widthScale="normal"
            icon="image-alt"
            onClick=${() => onViewPageImage?.({ plotUid: plot.uid, pageIndex: currentPageIndex })}
            disabled=${!plot.uid || !onViewPageImage}
          >View Image<//>
          <${HorizontalLayout} gap="small">
            <${Button}
              variant="small-text"
              icon="trash"
              disabled=${!hasMediaForCurrentPage}
              onClick=${handleReject}
            >Reject Render<//>
            <${Button}
              variant="small-text"
              icon="trash"
              disabled=${!hasMediaForCurrentPage}
              onClick=${handleRejectOthers}
            >Reject Others<//>
            <${Button}
              variant="small-text"
              color="secondary"
              icon="plus"
              disabled=${!hasMediaForCurrentPage}
              onClick=${handleAddPage}
            >Extend Page<//>
          </${HorizontalLayout}>
        </${HorizontalEdgesLayout}>

        <!-- SFX match indicator -->
        <${CollapsiblePanel}
          expanded=${sfxExpanded}
          onExpand=${() => setSfxExpanded(p => !p)}
          header=${html`<${Label}>SFX Played</${Label}>`}
          content=${html`
            <${SfxPillRow} style=${{ marginTop: '8px' }}>
              ${sfxMatches.map(({ sfx, matchingTag }, i) => html`
                <${SfxMatchPill}
                  key=${sfx.uid}
                  sfx=${sfx}
                  matchingTag=${matchingTag}
                  primary=${i === 0}
                />
              `)}
            </${SfxPillRow}>
          `}
        />

        <${HorizontalLayout} gap="small">
          <${NavigatorControl}
            currentPage=${currentPageIndex}
            totalPages=${pageCount}
            onPrev=${() => navigateTo(currentPageIndex - 1)}
            onNext=${() => navigateTo(currentPageIndex + 1)}
            onFirst=${() => navigateTo(0)}
            onLast=${() => navigateTo(pageCount - 1)}
            showFirstLast=${true}
          />
          <${Button} variant="medium-icon" icon="plus" color="secondary" onClick=${handleAddPage} />
          ${recoveryPage ? html`
            <${Button}
              variant="medium-icon"
              icon="recycle"
              color="primary"
              onClick=${handleRecoverPage}
            />
          ` : html`
            <${Button}
              variant="medium-icon"
              icon="trash"
              color="danger"
              onClick=${handleDeletePage}
              disabled=${pageCount <= 1}
            />
          `}
        </${HorizontalLayout}>
      </${VerticalLayout}>

      <!-- Progression Sections -->
      <${ChipAutocompleteInput}
        label="Progression Sections"
        placeholder="Add a section name..."
        suggestions=${progressionSectionSuggestions}
        values=${plot.progressionSections || []}
        onValuesChange=${(v) => setPlot(prev => ({ ...prev, progressionSections: v }))}
      />

      <!-- Row 3: Create/Save, Revert, Delete, Clear (right aligned) -->
      <${HorizontalEdgesLayout}>
        <${Button} variant="small-text" color="danger" icon="x" onClick=${handleClear}>
          New Plot
        <//>
        <${HorizontalLayout} gap="small" justifyContent="flex-end">
          <${Button} variant="small-text" color="primary" icon="save" onClick=${handleSave} disabled=${!saveEnabled}>
            ${saveLabel}
          <//>
          <${Button} variant="small-text" color="secondary" icon="undo" onClick=${handleRevert} disabled=${!revertEnabled}>
            Revert
          <//>
          ${recoveryPlot ? html`
            <${Button} variant="small-text" color="primary" icon="recycle" onClick=${handleRecoverPlot}>
              Recover
            <//>
          ` : html`
            <${Button} variant="small-text" color="danger" icon="trash" onClick=${handleDelete} disabled=${!plot.uid}>
              Delete
            <//>
          `}
        </${HorizontalLayout}>
      </${HorizontalEdgesLayout}>
      
      <${SearchSelectModal}
        isOpen=${loadModalOpen}
        title="Load Plot"
        items=${plotList.map(p => ({
          label: p.name || p.uid,
          value: p.uid,
          subtitle: p.section?.trim() || '',
        }))}
        mode="single"
        onSelect=${handleLoadPlot}
        onClose=${() => setLoadModalOpen(false)}
      />
    </${SectionWrapper}>
    </${Panel}>
  `;
}
