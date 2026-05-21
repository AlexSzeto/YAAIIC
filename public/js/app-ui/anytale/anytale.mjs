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

  // Workflow config loaded from /anytale/config + /workflows on mount
  const [workflowConfig, setWorkflowConfig] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/anytale/config').then(r => r.json()),
      fetch('/workflows').then(r => r.json()),
    ])
      .then(([config, workflows]) => {
        const name = config.generationWorkflow;
        const found = Array.isArray(workflows) ? workflows.find(w => w.name === name) : null;
        setWorkflowConfig(found || null);
      })
      .catch(err => console.error('[AnyTalePage] Failed to load workflow config:', err));
  }, []);

  // Import handlers forwarded from AnyTaleForm
  const [importControls, setImportControls] = useState(null);

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
    setTaskId(null);
    if (data.result && data.result.uid) {
      try {
        const media = backfillMissingProperties([await fetchJson(`/media-data/${data.result.uid}`)])[0];
        setHistory(prev => [media, ...prev]);
        nav.selectByIndex(0);
        toast.success(`Generated: ${media.name || 'Image'}`);
      } catch (err) {
        console.error('Failed to load result image:', err);
        toast.error('Failed to load generated image');
      }
    }
  }, []);

  const handleGenerationError = useCallback((data) => {
    setIsGenerating(false);
    setTaskId(null);
    toast.error(data.error?.message || 'Generation failed');
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
        onCancelled: () => { setIsGenerating(false); setTaskId(null); },
      });
    }
  }, [activeTasks]);

  // Persistent subscription: pick up story image task-started events (subLabel null = story image)
  useEffect(() => {
    return queueSSEManager.subscribe({
      'queue:task-started': ({ taskId, source, subLabel }) => {
        if (source !== 'anytale' || subLabel !== null) return;
        setTaskId(taskId);
        progressShow(taskId, {
          onComplete: handleGenerationComplete,
          onError: handleGenerationError,
          onCancelled: () => { setIsGenerating(false); setTaskId(null); },
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

  const handleGenerate = useCallback(async (assembledPrompt, name, partsData, plotData) => {
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
        body: JSON.stringify(payload)
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
          />
        </${LeftColumn}>

        <${RightColumn}>
          <${AnyTaleForm}
            onGenerate=${handleGenerate}
            onImportReady=${handleImportReady}
            currentItem=${nav.currentItem}
            onReject=${handleReject}
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
            setHistory(items);
            nav.selectByIndex(items.length - 1);
          }
        }}
        onDelete=${handleGalleryDelete}
        fileTypeFilter=${['image']}
      />
    </${VerticalLayout}>
    </${TooltipProvider}>

    <${QueueStatusBanner} progressVisible=${!!taskId} />
  `;
}
