/**
 * anytale-form.mjs – Right-column form for the AnyTale page.
 *
 * Contains two tabs:
 *   Edit:  Character Name, Parts DynamicList, Prompt Preview, Generate/Delete/Clear buttons.
 *   Play:  "Coming Soon" placeholder.
 *
 * Persists state to localStorage via anytale-state.mjs.
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { TabPanels } from '../../custom-ui/nav/tab-panels.mjs';
import { PartItem } from './part-item.mjs';
import { loadState, saveState, clearState, createDefaultPart } from './anytale-state.mjs';
import { assemblePrompt, assemblePartPreviewPrompt } from './prompt-assembler.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const ButtonRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
`;
ButtonRow.className = 'button-row';

const EditLayout = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
  gap: ${() => currentTheme.value.spacing.small.gap};
  padding-top: ${() => currentTheme.value.spacing.small.padding};
`;
EditLayout.className = 'edit-layout';

const PartsScrollArea = styled('div')`
  overflow-y: auto;
  flex: 1 1 auto;
  padding-right: ${() => currentTheme.value.spacing.small.padding};
`;
PartsScrollArea.className = 'parts-scroll-area';

const PromptPreview = styled('div')`
  padding: ${() => currentTheme.value.spacing.small.padding};
  background-color: ${() => currentTheme.value.colors.background.card};
  border-radius: ${() => currentTheme.value.spacing.small.borderRadius};
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  color: ${() => currentTheme.value.colors.text.secondary};
  word-break: break-word;
  max-height: 80px;
  overflow-y: auto;
`;
PromptPreview.className = 'prompt-preview';

const PlayPlaceholder = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: ${() => currentTheme.value.colors.text.muted};
  font-size: ${() => currentTheme.value.typography.fontSize.large};
`;
PlayPlaceholder.className = 'play-placeholder';

// ============================================================================
// Component
// ============================================================================

/**
 * @param {Object}   props
 * @param {Function} props.onGenerate    – Called with (prompt, name) when Generate is clicked
 * @param {boolean}  props.isGenerating  – True while a generation is in-flight
 * @param {Function} [props.onStateLoaded] – Called with the restored name after localStorage is read
 * @param {Function} [props.onDelete]      – Called when Delete is clicked
 * @param {boolean}  [props.canDelete]     – Whether the delete button is enabled
 */
export function AnyTaleForm({ onGenerate, isGenerating, onStateLoaded, onDelete, canDelete }) {
  const [name, setName] = useState('');
  const [parts, setParts] = useState([]);
  const [activeTab, setActiveTab] = useState('edit');

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadState();
    setName(saved.name);
    setParts(saved.parts);
    if (onStateLoaded) onStateLoaded(saved.name);
  }, []);

  // Persist on every change
  useEffect(() => {
    saveState({ name, parts });
  }, [name, parts]);

  const handleClear = useCallback(async () => {
    const result = await showDialog('This will erase all parts and the name. Are you sure?', 'Clear Settings', ['Clear', 'Cancel']);
    if (result !== 'Clear') return;
    setName('');
    setParts([]);
    clearState();
  }, []);

  const handleGenerate = useCallback(() => {
    const prompt = assemblePrompt(parts);
    onGenerate(prompt, name);
  }, [parts, name, onGenerate]);

  // Update a single part by index
  const handlePartChange = useCallback((index, updatedPart) => {
    setParts(prev => {
      const next = [...prev];
      next[index] = updatedPart;
      return next;
    });
  }, []);

  // Preview generation
  const [generatingPreviews, setGeneratingPreviews] = useState({});

  const handlePreviewGenerate = useCallback(async (item, index) => {
    // Prevent double-click
    if (generatingPreviews[index]) return;

    setGeneratingPreviews(prev => ({ ...prev, [index]: true }));

    try {
      const prompt = assemblePartPreviewPrompt(item);
      if (!prompt) {
        console.warn('[AnyTaleForm] No tags to generate preview for part', index);
        return;
      }

      const response = await fetch('/generate/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: 'Text to Image (Illustrious Portrait)',
          name: item.config?.name || 'preview',
          prompt,
          seed: Math.floor(Math.random() * 4294967295),
          orientation: 'square',
          // extraInputs defaults for 'Text to Image (Illustrious Portrait)'
          imageFormat: 'png',
          usePostPrompts: false,
          removeBackground: false,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.imageUrl) {
        handlePartChange(index, {
          ...item,
          data: { ...item.data, previewImageUrl: result.imageUrl },
        });
      }
    } catch (err) {
      console.error('[AnyTaleForm] Preview generation failed:', err);
    } finally {
      setGeneratingPreviews(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  }, [generatingPreviews, handlePartChange]);

  // Header actions for DynamicList items
  const headerActions = [
    { icon: 'refresh', title: 'Generate preview', onClick: handlePreviewGenerate },
  ];

  // Build preview prompt
  const previewPrompt = assemblePrompt(parts);

  // ── Tab content ─────────────────────────────────────────────────────────
  const editContent = html`
    <${EditLayout}>
      <${Input}
        label="Character Name"
        value=${name}
        onInput=${(e) => setName(e.target.value)}
        placeholder="Character name"
        widthScale="full"
      />

      <${PartsScrollArea}>
        <${DynamicList}
          title="Parts"
          items=${parts}
          renderItem=${(item, i) => html`
            <${PartItem}
              part=${item}
              onChange=${(updated) => handlePartChange(i, updated)}
            />
          `}
          getTitle=${(item) => item.config?.name || '(unnamed)'}
          getEnabled=${(item) => item.data?.enabled ?? true}
          onToggleEnabled=${(item, i) => handlePartChange(i, { ...item, data: { ...item.data, enabled: !(item.data?.enabled ?? true) } })}
          createItem=${createDefaultPart}
          onChange=${setParts}
          addLabel="Add Part"
          headerActions=${headerActions}
        />
      </${PartsScrollArea}>

      ${previewPrompt ? html`
        <${PromptPreview}>
          <strong>Prompt preview:</strong> ${previewPrompt}
        </${PromptPreview}>
      ` : null}

      <${ButtonRow}>
        <${Button}
          variant="large-text"
          color="primary"
          icon="play"
          onClick=${handleGenerate}
          disabled=${isGenerating}
        >
          ${isGenerating ? 'Generating...' : 'Generate'}
        <//>
        <${Button}
          variant="medium-text"
          color="danger"
          icon="trash"
          onClick=${onDelete}
          disabled=${!canDelete}
        >
          Delete
        <//>
        <${Button}
          variant="medium-text"
          color="danger"
          icon="x"
          onClick=${handleClear}
        >
          Clear
        <//>
      </${ButtonRow}>
    </${EditLayout}>
  `;

  const playContent = html`
    <${PlayPlaceholder}>Coming Soon</${PlayPlaceholder}>
  `;

  const tabs = [
    { id: 'edit', label: 'Edit', content: editContent },
    { id: 'play', label: 'Play', content: playContent },
  ];

  return html`
    <${TabPanels}
      tabs=${tabs}
      activeTab=${activeTab}
      onTabChange=${setActiveTab}
      variant="outlined"
      style=${{ height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    />
  `;
}
