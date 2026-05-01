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
  flex: 1 1 50%;
  min-width: 0;
`;
LeftColumn.className = 'left-column';

const RightColumn = styled('div')`
  flex: 1 1 50%;
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

  const handleGenerate = useCallback(async (assembledPrompt) => {
    if (!workflow) {
      toast.error('Please select a workflow first');
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetchJson('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: workflow.name,
          description: assembledPrompt
        })
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
        <${HamburgerMenu} />
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
          <${Button}
            variant="medium-text"
            icon="image"
            onClick=${() => setIsGalleryOpen(true)}
            style=${{ marginTop: '8px' }}
          >
            Gallery
          <//>
        </${LeftColumn}>

        <${RightColumn}>
          <${DressUpForm}
            onGenerate=${handleGenerate}
            isGenerating=${isGenerating}
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
