/**
 * anytale.mjs – Top-level page component for the AnyTale generation mode.
 *
 * Layout:
 *   - Two-column main area: left = image viewer, right = generation parameters
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { Page } from '../../custom-ui/layout/page.mjs';
import { H1, HorizontalLayout, HorizontalEdgesLayout, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { useProgress } from '../../custom-ui/msg/progress-context.mjs';
import { Gallery } from '../main/gallery.mjs';
import { useItemNavigation } from '../../custom-ui/nav/use-item-navigation.mjs';
import { fetchJson } from '../../custom-ui/util.mjs';
import { backfillMissingProperties } from '../../util.mjs';
import { loadPlot, loadCharacter, loadState } from './anytale-state.mjs';
import { HamburgerMenu } from '../hamburger-menu.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { openFolderSelect } from '../use-folder-select.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { TooltipProvider } from '../../custom-ui/overlays/tooltip.mjs';
import { AnyTaleViewer } from './anytale-viewer.mjs';
import { AnyTaleForm } from './anytale-form.mjs';
import { createGalleryPreview } from '../main/gallery-preview.mjs';
import { queueSSEManager } from '../queue-sse-manager.mjs';
import { QueueStatusBanner } from '../queue-status-banner.mjs';
import { getClientId } from '../client-id.mjs';

// ── Client-side plot sort ─────────────────────────────────────────────────────
// Groups items by plot UID (oldest plot first), sorts within each group by page
// index ascending, then appends non-anytale items by timestamp descending.
// Applied to viewer history — never to the gallery modal's own display order.
function sortItemsByPlot(items) {
  const withPlot = items.filter(i => i.plot?.uid);
  const withoutPlot = items.filter(i => !i.plot?.uid);

  const groups = new Map();
  for (const item of withPlot) {
    const uid = item.plot.uid;
    if (!groups.has(uid)) groups.set(uid, []);
    groups.get(uid).push(item);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => (a.plot.page ?? 0) - (b.plot.page ?? 0));
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  withoutPlot.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return [...sortedGroups.flatMap(([, g]) => g), ...withoutPlot];
}

const TwoColumn = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.medium.gap};
  align-items: flex-start;
  width: 100%;

  @media (max-width: 900px) {
    flex-direction: column;
  }
`;
TwoColumn.className = 'two-column';

const LeftColumn = styled('div')`
  flex: 6 6;
  min-width: 0;
  max-height: calc(100vh - 160px); /* Account for header and workflow selector */

  @media (max-width: 900px) {
    max-width: 100%;
    max-height: none;
  }

`;
LeftColumn.className = 'left-column';

const RightColumn = styled('div')`
  flex: 4 4;
  min-width: 0;

  @media (max-width: 900px) {
    width: 100%;
  }
`;
RightColumn.className = 'right-column';

export function AnyTalePage() {
  const toast = useToast();
  const { show: progressShow, activeTasks } = useProgress();

  // Theme re-render trigger
  const [, setTheme] = useState(currentTheme.value);
  useEffect(() => currentTheme.subscribe(setTheme), []);

  // Workflow config loaded from /anytale/config + /api/workflows/:name on mount.
  // Using /api/workflows/:name (not the public /workflows list) so hidden workflows work.
  const [workflowConfig, setWorkflowConfig] = useState(null);

  useEffect(() => {
    fetch('/anytale/config')
      .then(r => r.json())
      .then(config => {
        const name = config.generationWorkflow;
        if (!name) { setWorkflowConfig(null); return; }
        return fetch(`/api/workflows/${encodeURIComponent(name)}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const wf = data?.workflow;
            setWorkflowConfig(wf ? { name: wf.name, ...wf.options } : null);
          });
      })
      .catch(err => console.error('[AnyTalePage] Failed to load workflow config:', err));
  }, []);

  // Import handlers forwarded from AnyTaleForm
  const [importControls, setImportControls] = useState(null);

  // Track the editor's active plot/page so we can dim images that don't match
  const [editorPlotUid, setEditorPlotUid] = useState(() => loadPlot().uid || null);
  const [editorPageIndex, setEditorPageIndex] = useState(() => loadState().activePlotPage ?? 0);
  const handleEditorContextChange = useCallback(({ plotUid, pageIndex }) => {
    setEditorPlotUid(plotUid);
    setEditorPageIndex(pageIndex);
  }, []);

  const [imageWidth, setImageWidth] = useState(null);

  const handleImportReady = useCallback((controls) => {
    setImportControls(controls);
  }, []);


  // Generation state
  const [taskId, setTaskId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Image history / viewer
  const [history, setHistory] = useState([]);
  const nav = useItemNavigation(history);
  // Set to true after appending a new image so the post-render effect can navigate to last
  const navigateToLastRef = useRef(false);
  // Set to { plotUid, pageIndex } to jump to a specific plot page after history updates
  const initialJumpRef = useRef(null);

  useEffect(() => {
    if (history.length === 0) return;
    if (initialJumpRef.current) {
      const { plotUid, pageIndex } = initialJumpRef.current;
      initialJumpRef.current = null;
      const idx = history.findIndex(
        item => item.plot?.uid === plotUid && item.plot?.page === pageIndex
      );
      nav.selectByIndex(idx !== -1 ? idx : history.length - 1);
    } else if (navigateToLastRef.current) {
      nav.selectLast();
      navigateToLastRef.current = false;
    }
  }, [history]);

  // Preload images on mount based on the active tab's current name
  useEffect(() => {
    const tab = localStorage.getItem('anytale-active-tab') || 'parts-plot';
    const isPlotTab = tab !== 'character-outfits';
    const name = isPlotTab
      ? loadPlot().name?.trim() || ''
      : loadCharacter().name?.trim() || '';
    if (!name) return;
    fetchJson(`/media-data?${new URLSearchParams({ query: name, sort: 'ascending', limit: '1000' })}`)
      .then(items => {
        const exact = sortItemsByPlot(items.filter(item => item.name === name));
        if (exact.length > 0) {
          setHistory(exact);
          if (isPlotTab) {
            // Jump to the current plot page; falls back to last item silently if not found
            const currentPlot = loadPlot();
            const activePageIndex = loadState().activePlotPage ?? 0;
            if (currentPlot.uid) {
              initialJumpRef.current = { plotUid: currentPlot.uid, pageIndex: activePageIndex };
            } else {
              navigateToLastRef.current = true;
            }
          } else {
            navigateToLastRef.current = true;
          }
        }
      })
      .catch(err => console.error('[AnyTalePage] Preload failed:', err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Gallery
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Folder
  const [currentFolder, setCurrentFolder] = useState({ uid: '', label: 'Unsorted' });

  // Restore the server-persisted folder on mount
  useEffect(() => {
    fetchJson('/folder')
      .then(folderData => {
        const folder = folderData.list.find(f => f.uid === folderData.current) || { uid: '', label: 'Unsorted' };
        setCurrentFolder(folder);
      })
      .catch(err => console.error('[AnyTalePage] Failed to load current folder:', err));
  }, []);

  const handleOpenFolderSelect = useCallback(() => {
    openFolderSelect({
      currentFolder,
      toast,
      onFolderChanged: async (selectedFolder) => {
        setCurrentFolder(selectedFolder);
      },
    });
  }, [currentFolder, toast]);

  // Favicon spinner
  useEffect(() => {
    if (!window.favloader) return;
    if (!window.favloaderInitialized) {
      window.favloader.init({ size: 16, radius: 6, thickness: 2, color: '#FFFFFF', duration: 5000 });
      window.favloaderInitialized = true;
    }
    if (taskId) window.favloader.start();
    else window.favloader.stop();
  }, [taskId]);

  // Generation callbacks
  const handleGenerationComplete = useCallback(async (data) => {
    setIsGenerating(false);
    setTaskId(prev => (!data || !data.taskId || prev === data.taskId) ? null : prev);
    if (data.result && data.result.uid) {
      try {
        const media = backfillMissingProperties([await fetchJson(`/media-data/${data.result.uid}`)])[0];
        setHistory(prev => [...prev, media]);
        const activeTab = localStorage.getItem('anytale-active-tab') || 'parts-plot';
        if (activeTab !== 'parts-plot') {
          // Non-plot tab: always jump to the newest image.
          navigateToLastRef.current = true;
        } else {
          // Parts & Plot tab: only jump if the completed image matches the page
          // currently being edited — avoids disrupting the view for other pages.
          const currentPlot = loadPlot();
          const activePageIndex = loadState().activePlotPage ?? 0;
          if (
            currentPlot.uid &&
            media.plot?.uid === currentPlot.uid &&
            media.plot?.page === activePageIndex
          ) {
            navigateToLastRef.current = true;
          }
        }
        toast.success(`Generated: ${media.name || 'Image'}`);
      } catch (err) {
        console.error('Failed to load result image:', err);
        toast.error('Failed to load generated image');
      }
    }
  }, []);

  const handleGenerationError = useCallback((data) => {
    setIsGenerating(false);
    setTaskId(prev => (!data || !data.taskId || prev === data.taskId) ? null : prev);
    toast.error(data?.error?.message || 'Generation failed');
  }, []);

  // Reconnect-resume: restore in-progress anytale image generation tasks on page load
  useEffect(() => {
    if (activeTasks.length === 0) return;
    const task = activeTasks.find(t => t.requestOrigin === 'anytale' && !t.entityType);
    if (task && !taskId) {
      setIsGenerating(true);
      setTaskId(task.taskId);
      progressShow(task.taskId, {
        onComplete: handleGenerationComplete,
        onError: handleGenerationError,
        onCancelled: (data) => { setIsGenerating(false); setTaskId(prev => (!data || !data.taskId || prev === data.taskId) ? null : prev); },
      });
    }
  }, [activeTasks]);

  // Persistent subscription: pick up story image task-started events (subLabel null = story image)
  useEffect(() => {
    return queueSSEManager.subscribe({
      'queue:task-started': ({ taskId, source, subLabel, clientId }) => {
        if (source !== 'anytale' || subLabel !== null) return;
        if (clientId !== getClientId()) return;
        setTaskId(taskId);
        progressShow(taskId, {
          onComplete: handleGenerationComplete,
          onError: handleGenerationError,
          onCancelled: (data) => { setIsGenerating(false); setTaskId(prev => (!data || !data.taskId || prev === data.taskId) ? null : prev); },
        });
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteImage = useCallback(async (image) => {
    if (!image) return;
    const result = await showDialog(
      `Are you sure you want to delete "${image.name || 'this image'}"? This action cannot be undone.`,
      'Confirm Deletion',
      ['Delete', 'Cancel']
    );
    if (result !== 'Delete') return;
    try {
      await fetchJson('/media-data/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: [image.uid] })
      });
      const newHistory = history.filter(item => item.uid !== image.uid);
      setHistory(newHistory);
      const deletedIndex = history.findIndex(item => item.uid === image.uid);
      nav.selectByIndex(Math.min(deletedIndex, newHistory.length - 1));
      toast.success('Image deleted');
    } catch (err) {
      console.error('Failed to delete image:', err);
      toast.error('Failed to delete image');
    }
  }, [history, nav, toast]);

  const handleGalleryDelete = useCallback((deletedUids) => {
    if (!deletedUids || deletedUids.length === 0) return;
    const newHistory = history.filter(item => !deletedUids.includes(item.uid));
    setHistory(newHistory);
    // If the currently viewed image was deleted, navigate to best available neighbour
    if (nav.currentItem && deletedUids.includes(nav.currentItem.uid)) {
      const deletedIndex = history.findIndex(item => item.uid === nav.currentItem.uid);
      nav.selectByIndex(Math.min(deletedIndex, newHistory.length - 1));
    }
  }, [history, nav]);

  const handleViewPageImage = useCallback(({ plotUid, pageIndex }) => {
    const idx = history.findIndex(
      item => item.plot?.uid === plotUid && item.plot?.page === pageIndex
    );
    if (idx === -1) { toast.show('Page image not found', 'warning'); return; }
    nav.selectByIndex(idx);
  }, [history, nav, toast]);

  const handleReject = useCallback(async ({ plotUid, pageIndex }) => {
    if (!plotUid) return;
    const matching = history.filter(item => item.plot?.uid === plotUid && item.plot?.page === pageIndex);
    if (matching.length === 0) return;
    try {
      await fetchJson('/media-data/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: matching.map(item => item.uid) }),
      });
      const deletedSet = new Set(matching.map(item => item.uid));
      const newHistory = history.filter(item => !deletedSet.has(item.uid));
      setHistory(newHistory);
      if (nav.currentItem && deletedSet.has(nav.currentItem.uid)) {
        const deletedIndex = history.findIndex(item => item.uid === nav.currentItem.uid);
        nav.selectByIndex(Math.min(deletedIndex, newHistory.length - 1));
      }
      toast.success(`Rejected: deleted ${matching.length} image(s)`);
    } catch (err) {
      console.error('[AnyTalePage] Reject delete failed:', err);
      toast.error('Failed to delete images');
    }
  }, [history, nav, toast]);

  const handleRejectOthers = useCallback(async ({ plotUid, pageIndex }) => {
    if (!plotUid) return;
    const excludeUid = nav.currentItem?.uid;
    const matching = history.filter(
      item => item.plot?.uid === plotUid && item.plot?.page === pageIndex && item.uid !== excludeUid
    );
    if (matching.length === 0) return;
    try {
      await fetchJson('/media-data/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: matching.map(item => item.uid) }),
      });
      const deletedSet = new Set(matching.map(item => item.uid));
      setHistory(prev => prev.filter(item => !deletedSet.has(item.uid)));
      toast.success(`Rejected: deleted ${matching.length} image(s)`);
    } catch (err) {
      console.error('[AnyTalePage] Reject others failed:', err);
      toast.error('Failed to delete images');
    }
  }, [history, nav, toast]);

  const handleGenerate = useCallback(async (assembledPrompt, name, partsData, plotData, dialogText = '') => {
    if (!workflowConfig) {
      toast.error('Generation workflow not configured');
      return;
    }
    setIsGenerating(true);
    try {
      const seed = Math.floor(Math.random() * 4294967295);
      const payload = {
        workflow: workflowConfig.name,
        name: name || '',
        description: assembledPrompt,
        prompt: assembledPrompt,
        seed,
        orientation: workflowConfig.orientation,
        parts: partsData && Object.keys(partsData).length > 0 ? partsData : null,
        plot: plotData ?? null,
        dialog: dialogText || '',
        requestOrigin: 'anytale',
      };

      if (Array.isArray(workflowConfig.extraInputs)) {
        workflowConfig.extraInputs.forEach(input => {
          if (input.default !== undefined) {
            payload[input.id] = input.default;
          }
        });
      }

      const response = await fetchJson('/generate?queueOnly=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, clientId: getClientId() })
      });
      toast.show('Generation queued...', 'info');
    } catch (err) {
      console.error('Generation failed:', err);
      toast.error(err.message || 'Failed to start generation');
      setIsGenerating(false);
    }
  }, [workflowConfig]);

  return html`
    <${TooltipProvider}>
    <${VerticalLayout}>
      <${HorizontalEdgesLayout}>
        <${H1}>AnyTale Editor<//>
        <${HorizontalLayout} gap="small">
          <${Button}
            id="gallery-btn"
            onClick=${() => setIsGalleryOpen(true)}
            variant="medium-icon-text"
            icon="images"
          >
            Gallery
          <//>
          <${Button}
            id="folder-btn"
            onClick=${handleOpenFolderSelect}
            variant="medium-icon-text"
            icon="folder"
          >
            ${currentFolder.label}
          <//>
          <${HamburgerMenu} />
        <//>
      </${HorizontalEdgesLayout}>

      <${TwoColumn}>
        <${LeftColumn} style=${{ maxWidth: imageWidth ? `${imageWidth}px` : undefined }}>
          <${AnyTaleViewer}
            items=${history}
            currentIndex=${nav.currentIndex}
            onNavigate=${nav.selectByIndex}
            onPrev=${nav.selectPrev}
            onNext=${nav.selectNext}
            onFirst=${nav.selectFirst}
            onLast=${nav.selectLast}
            currentItem=${nav.currentItem}
            activeTab=${importControls?.activeTab || 'parts-plot'}
            canImport=${!!importControls?.canImport}
            onImportPartsPlot=${importControls?.importPartsPlot}
            onImportPlot=${importControls?.importPlot}
            onImportCharacter=${importControls?.importCharacter}
            onImportOutfit=${importControls?.importOutfit}
            onDelete=${() => handleDeleteImage(nav.currentItem)}
            canDelete=${!!nav.currentItem}
            onImageWidthChange=${setImageWidth}
            dimmed=${!!(nav.currentItem?.plot?.uid && editorPlotUid && (nav.currentItem.plot.uid !== editorPlotUid || nav.currentItem.plot.page !== editorPageIndex))}
          />
        </${LeftColumn}>

        <${RightColumn}>
          <${AnyTaleForm}
            onGenerate=${handleGenerate}
            onImportReady=${handleImportReady}
            currentItem=${nav.currentItem}
            onReject=${handleReject}
            onRejectOthers=${handleRejectOthers}
            onViewPageImage=${handleViewPageImage}
            onEditorContextChange=${handleEditorContextChange}
            history=${history}
          />
        </${RightColumn}>
      </${TwoColumn}>

      <${Gallery}
        isOpen=${isGalleryOpen}
        onClose=${() => setIsGalleryOpen(false)}
        queryPath="/media-data"
        previewFactory=${createGalleryPreview}
        onLoad=${(items) => {
          if (items && items.length > 0) {
            const sorted = sortItemsByPlot(items);
            setHistory(sorted);
            // Jump to the current plot page; fall back to last item if not on a saved plot
            const tab = localStorage.getItem('anytale-active-tab') || 'parts-plot';
            if (tab !== 'character-outfits') {
              const currentPlot = loadPlot();
              const activePageIndex = loadState().activePlotPage ?? 0;
              if (currentPlot.uid) {
                initialJumpRef.current = { plotUid: currentPlot.uid, pageIndex: activePageIndex };
                return;
              }
            }
            nav.selectByIndex(sorted.length - 1);
          }
        }}
        onDelete=${handleGalleryDelete}
        fileTypeFilter=${['image']}
      />
    </${VerticalLayout}>
    </${TooltipProvider}>

    <${QueueStatusBanner} progressVisible=${activeTasks.length > 0} />
  `;
}
