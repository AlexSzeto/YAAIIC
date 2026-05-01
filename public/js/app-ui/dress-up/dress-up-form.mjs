/**
 * dress-up-form.mjs – Right-column generation parameters panel for the Dress-Up page.
 *
 * Contains: Name, Additional Prompts, Clothing item list (via DynamicList), Generate / Clear buttons.
 * Persists state to localStorage and restores on mount.
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
import { VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Checkbox } from '../../custom-ui/io/checkbox.mjs';
import { TagInput } from '../tags/tag-input.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { ClothingItem } from './clothing-item.mjs';
import { loadState, saveState, clearState, createDefaultItem, createDefaultPromptItem } from './dress-up-state.mjs';
import { assemblePrompt } from './prompt-assembler.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';

// Outfit rules loaded once at module level
let outfitRules = [];
fetch('/js/app-ui/dress-up/outfit-rules.json')
  .then(r => r.json())
  .then(data => { outfitRules = data; })
  .catch(err => console.error('Failed to load outfit rules:', err));

const ButtonRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
`;
ButtonRow.className = 'button-row';

const ScrollableContent = styled('div')`
  padding-right: ${() => currentTheme.value.spacing.small.padding};
  overflow-y: auto;
  flex: 1 1 auto;
`;
ScrollableContent.className = 'scrollable-content';

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

/**
 * @param {Object}   props
 * @param {Function} props.onGenerate    – Called with (prompt, name) when Generate is clicked
 * @param {boolean}  props.isGenerating  – True while a generation is in-flight
 * @param {Function} [props.onStateLoaded] – Called with the restored name after localStorage is read
 * @param {Function} [props.onDelete]      – Called when Delete is clicked (handles confirmation externally)
 * @param {boolean}  [props.canDelete]     – Whether the delete button is enabled
 */
export function DressUpForm({ onGenerate, isGenerating, onStateLoaded, onDelete, canDelete }) {
  const [name, setName] = useState('');
  const [additionalPrompts, setAdditionalPrompts] = useState([]);
  const [clothingItems, setClothingItems] = useState([]);

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadState();
    setName(saved.name);
    setAdditionalPrompts(saved.additionalPrompts);
    setClothingItems(saved.clothingItems);
    if (onStateLoaded) onStateLoaded(saved.name);
  }, []);

  // Persist on every change
  useEffect(() => {
    saveState({ name, additionalPrompts, clothingItems });
  }, [name, additionalPrompts, clothingItems]);

  const handleClear = useCallback(async () => {
    const result = await showDialog('This will erase all clothing items, prompts, and the name. Are you sure?', 'Clear Settings', ['Clear', 'Cancel']);
    if (result !== 'Clear') return;
    setName('');
    setAdditionalPrompts([]);
    setClothingItems([]);
    clearState();
  }, []);

  const handleGenerate = useCallback(() => {
    const prompt = assemblePrompt(clothingItems, additionalPrompts, outfitRules);
    onGenerate(prompt, name);
  }, [clothingItems, additionalPrompts, name, onGenerate]);

  // Build preview
  const previewPrompt = assemblePrompt(clothingItems, additionalPrompts, outfitRules);

  return html`
    <${Panel} variant="outlined" style=${{ height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <${ScrollableContent}>
      <${VerticalLayout}>
        <${Input}
          label="Character Name"
          value=${name}
          onInput=${(e) => setName(e.target.value)}
          placeholder="Character name"
          widthScale="full"
        />

        <${DynamicList}
          title="Prompt Groups"
          items=${additionalPrompts}
          renderItem=${(item, i) => html`
            <${VerticalLayout} gap="small">
              <${Checkbox}
                label="Use"
                checked=${item.enabled}
                onChange=${(e) => {
                  const next = [...additionalPrompts];
                  next[i] = { ...item, enabled: e.target.checked };
                  setAdditionalPrompts(next);
                }}
              />
              <${Input}
                label="Label"
                value=${item.name}
                onInput=${(e) => {
                  const next = [...additionalPrompts];
                  next[i] = { ...item, name: e.target.value };
                  setAdditionalPrompts(next);
                }}
                placeholder="Label (display only)"
                widthScale="full"
                heightScale="compact"
              />
              <${TagInput}
                label="Prompt Tags"
                value=${item.text}
                onInput=${(text) => {
                  const next = [...additionalPrompts];
                  next[i] = { ...item, text };
                  setAdditionalPrompts(next);
                }}
                rows=${2}
                placeholder="Extra tags (character, pose, background, etc.)"
              />
            </${VerticalLayout}>
          `}
          getTitle=${(item) => item.name || item.text.slice(0, 40) || '(empty)'}
          createItem=${createDefaultPromptItem}
          onChange=${setAdditionalPrompts}
          addLabel="Add Prompt"
        />

        <${DynamicList}
          title="Clothing Items"
          items=${clothingItems}
          renderItem=${(item, i) => html`
            <${ClothingItem}
              item=${item}
              onChange=${(updated) => {
                const next = [...clothingItems];
                next[i] = updated;
                setClothingItems(next);
              }}
            />
          `}
          getTitle=${(item) => item.name || '(unnamed)'}
          createItem=${createDefaultItem}
          onChange=${setClothingItems}
          addLabel="Add Clothing Item"
        />

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
      </${VerticalLayout}>
      </${ScrollableContent}>
    </${Panel}>
  `;
}

