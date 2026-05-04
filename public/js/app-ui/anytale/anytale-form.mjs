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
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { TabPanels } from '../../custom-ui/nav/tab-panels.mjs';
import { PartItem } from './part-item.mjs';
import { loadState, saveState, clearState, createDefaultPart } from './anytale-state.mjs';
import { assemblePrompt, assemblePartPreviewPrompt } from './prompt-assembler.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { AutocompleteInput } from '../autocomplete-input.mjs';
import { VerticalLayout } from '../../custom-ui/themed-base.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const ButtonRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
  flex: none;
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
  display: flex;
  flex-direction: column;
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
  flex: none;
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
  const toast = useToast();
  const [name, setName] = useState('');
  const [parts, setParts] = useState([]);
  const [activeTab, setActiveTab] = useState('edit');
  const [isReprompting, setIsReprompting] = useState(false);

  // ── Library lookup state ─────────────────────────────────────────────────
  const [libraryParts, setLibraryParts] = useState([]);

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadState();
    setName(saved.name);
    setParts(saved.parts);
    if (onStateLoaded) onStateLoaded(saved.name);
  }, []);

  // Fetch library parts on mount
  useEffect(() => {
    fetch('/anytale/parts')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLibraryParts(data); })
      .catch(err => console.error('[AnyTaleForm] Failed to fetch library parts:', err));
  }, []);

  // Persist on every change
  useEffect(() => {
    saveState({ name, parts });
  }, [name, parts]);

  // ── Library lookup: add part from library ────────────────────────────────
  const handleLibrarySelect = useCallback((inputValue) => {
    const trimmed = (inputValue || '').trim();
    if (!trimmed) return;
    const match = libraryParts.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (!match) {
      toast.info(`No saved part named '${trimmed}' found`);
      return;
    }
    const newPart = createDefaultPart();
    newPart.config = { ...newPart.config, ...match };
    setParts(prev => [...prev, newPart]);
  }, [libraryParts, toast]);

  const handleClear = useCallback(async () => {
    const result = await showDialog('This will erase all parts and the name. Are you sure?', 'Clear Settings', ['Clear', 'Cancel']);
    if (result !== 'Clear') return;
    setName('');
    setParts([]);
    clearState();
  }, []);

  const handleGenerate = useCallback(() => {
    const prompt = assemblePrompt(parts);
    // Build parts data: keyed by part name, only parts with non-empty names
    const partsData = {};
    for (const part of parts) {
      if (part.config?.name?.trim()) {
        partsData[part.config.name] = {
          enabled: part.data.enabled,
          categoryAttributeValues: part.data.categoryAttributeValues,
          customAttributeValues: part.data.customAttributeValues,
          previewImageUrl: part.data.previewImageUrl,
        };
      }
    }
    onGenerate(prompt, name, partsData);
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

  // ── Reprompt: reload configs from library ────────────────────────────────
  const handleReprompt = useCallback(async () => {
    setIsReprompting(true);
    try {
      let latestLibrary = libraryParts;
      try {
        const response = await fetch('/anytale/parts');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            latestLibrary = data;
            setLibraryParts(data);
          }
        }
      } catch (err) {
        console.error('[AnyTaleForm] Reprompt: failed to fetch library parts:', err);
      }

      // Compute updated parts and count actual changes
      let changedCount = 0;
      const updatedParts = parts.map(part => {
        const libraryConfig = latestLibrary.find(p => p.uid === part.config.uid)
          ?? latestLibrary.find(p => p.name === part.config.name);
        if (!libraryConfig) return part;

        const newCategoryValues = {};
        for (const attr of (libraryConfig.categoryAttributes || [])) {
          newCategoryValues[attr.name] = part.data.categoryAttributeValues?.[attr.name] ?? '';
        }
        const newCustomValues = {};
        for (const attr of (libraryConfig.customAttributes || [])) {
          newCustomValues[attr.name] = part.data.customAttributeValues?.[attr.name] ?? '';
        }

        const configChanged = JSON.stringify(libraryConfig) !== JSON.stringify(part.config);
        const catChanged = JSON.stringify(newCategoryValues) !== JSON.stringify(part.data.categoryAttributeValues ?? {});
        const customChanged = JSON.stringify(newCustomValues) !== JSON.stringify(part.data.customAttributeValues ?? {});
        if (configChanged || catChanged || customChanged) changedCount++;

        return {
          ...part,
          config: libraryConfig,
          data: { ...part.data, categoryAttributeValues: newCategoryValues, customAttributeValues: newCustomValues },
        };
      });

      setParts(updatedParts);

      if (changedCount > 0) {
        toast.success(`Reprompted: ${changedCount} part(s) updated from library`);
      } else {
        toast.info('No library changes found');
      }
    } finally {
      setIsReprompting(false);
    }
  }, [libraryParts, parts, toast]);

  // Build preview prompt
  const previewPrompt = assemblePrompt(parts);

  // ── Tab content ─────────────────────────────────────────────────────────
  const editContent = html`
    <${EditLayout}>
      <div style="flex: none">
        <${VerticalLayout} gap="small">
          <${Input}
            label="Character Name"
            value=${name}
            onInput=${(e) => setName(e.target.value)}
            placeholder="Character name"
            widthScale="full"
          />
          <${AutocompleteInput}
            label="Add Part from Library"
            placeholder="Type to search saved parts..."
            suggestions=${libraryParts.map(p => p.name)}
            onSelect=${handleLibrarySelect}
          />
        </${VerticalLayout}>
      </div>

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
          color="secondary"
          icon="refresh"
          onClick=${handleReprompt}
          disabled=${isGenerating || isReprompting}
        >
          ${isReprompting ? 'Reprompting...' : 'Reprompt'}
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
