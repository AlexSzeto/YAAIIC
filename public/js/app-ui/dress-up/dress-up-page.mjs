/**
 * dress-up-page.mjs – Top-level page component for the Dress-Up generation mode.
 *
 * Layout:
 *   - Top strip: WorkflowSelector filtered to Image workflows
 *   - Two-column main area: left = image viewer, right = generation parameters
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { Page } from '../../custom-ui/layout/page.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
import { H1, HorizontalLayout, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { AppHeader } from '../themed-base.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { WorkflowSelector } from '../workflow-selector.mjs';
import { ProgressBanner } from '../../custom-ui/msg/progress-banner.mjs';
import { Gallery } from '../main/gallery.mjs';
import { useItemNavigation } from '../../custom-ui/nav/use-item-navigation.mjs';
import { sseManager } from '../sse-manager.mjs';
import { fetchJson } from '../../custom-ui/util.mjs';
import { backfillMissingProperties } from '../../util.mjs';
import { HamburgerMenu } from '../hamburger-menu.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { openFolderSelect } from '../use-folder-select.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { DressUpViewer } from './dress-up-viewer.mjs';
import { DressUpForm } from './dress-up-form.mjs';
import { createGalleryPreview } from '../main/gallery-preview.mjs';

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
  max-height: calc(100vh - 240px); /* Account for header and workflow selector */
`;
LeftColumn.className = 'left-column';

const RightColumn = styled('div')`
  flex: 4 4;
  min-width: 0;
`;
RightColumn.className = 'right-column';

export function DressUpPage() {
  const toast = useToast();

  // Theme re-render trigger
  const [, setTheme] = useState(currentTheme.value);
  useEffect(() => currentTheme.subscribe(setTheme), []);

  // Workflow
  const [workflow, setWorkflow] = useState(null);

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

  // Auto-load images matching the restored name on page load
  const handleStateLoaded = useCallback(async (restoredName) => {
    if (!restoredName) return;
    try {
      const url = new URL('/media-data', window.location.origin);
      url.searchParams.set('query', restoredName);
      url.searchParams.set('limit', '50');
      url.searchParams.set('fileType', 'image');
      const data = backfillMissingProperties(await fetchJson(url.pathname + url.search));
      if (Array.isArray(data) && data.length > 0) {
        setHistory(data);
        nav.selectByIndex(0);
      }
    } catch (err) {
      console.error('Failed to auto-load images:', err);
    }
  }, []);

  const handleGenerate = useCallback(async (assembledPrompt, name) => {
    if (!workflow) {
      toast.error('Please select a workflow first');
      return;
    }
    setIsGenerating(true);
    try {
      const seed = Math.floor(Math.random() * 4294967295);
      const payload = {
        workflow: workflow.name,
        name: name || '',
        description: assembledPrompt,
        prompt: assembledPrompt,
        seed,
        orientation: workflow.orientation,
      };

      // Add extraInputs with their declared defaults
      if (Array.isArray(workflow.extraInputs)) {
        workflow.extraInputs.forEach(input => {
          if (input.default !== undefined) {
            payload[input.id] = input.default;
          }
        });
      }

      const response = await fetchJson('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.taskId) {
        setTaskId(response.taskId);
        toast.show('Generation started...', 'info');
      } else {
        throw new Error('No taskId returned');
      }
    } catch (err) {
      console.error('Generation failed:', err);
      toast.error(err.message || 'Failed to start generation');
      setIsGenerating(false);
    }
  }, [workflow]);

  return html`
    <${VerticalLayout}>
      <${AppHeader}>
        <${H1}>Dress Up<//>
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
      </${AppHeader}>

      <${Panel} variant="outlined">
        <${WorkflowSelector}
          value=${workflow}
          onChange=${setWorkflow}
          disabled=${isGenerating}
          typeOptions=${[{ label: 'Image', value: 'image' }]}
        />
      </${Panel}>

      <${TwoColumn}>
        <${LeftColumn}>
          <${DressUpViewer}
            items=${history}
            currentIndex=${nav.currentIndex}
            onNavigate=${nav.selectByIndex}
            onPrev=${nav.selectPrev}
            onNext=${nav.selectNext}
            currentItem=${nav.currentItem}
          />
        </${LeftColumn}>

        <${RightColumn}>
          <${DressUpForm}
            onGenerate=${handleGenerate}
            isGenerating=${isGenerating}
            onStateLoaded=${handleStateLoaded}
            onDelete=${() => handleDeleteImage(nav.currentItem)}
            canDelete=${!!nav.currentItem}
          />
        </${RightColumn}>
      </${TwoColumn}>

      ${taskId ? html`
        <${ProgressBanner}
          key=${taskId}
          taskId=${taskId}
          sseManager=${sseManager}
          onComplete=${handleGenerationComplete}
          onError=${handleGenerationError}
        />
      ` : null}

      <${Gallery}
        isOpen=${isGalleryOpen}
        onClose=${() => setIsGalleryOpen(false)}
        queryPath="/media-data"
        previewFactory=${createGalleryPreview}
        onLoad=${(items) => {
          if (items && items.length > 0) {
            setHistory(items);
            nav.selectByIndex(0);
          }
        }}
        fileTypeFilter=${['image']}
      />
    </${VerticalLayout}>
  `;
}
