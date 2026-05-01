/**
 * dress-up-form.mjs – Right-column generation parameters panel for the Dress-Up page.
 *
 * Contains: Additional Prompts, Clothing item list, Add / Generate / Clear buttons.
 * Persists state to localStorage and restores on mount.
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
import { VerticalLayout, HorizontalLayout } from '../../custom-ui/themed-base.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { TagInput } from '../../custom-ui/io/tag-input.mjs';
import { ClothingItem } from './clothing-item.mjs';
import { loadState, saveState, clearState, createDefaultItem } from './dress-up-state.mjs';
import { assemblePrompt } from './prompt-assembler.mjs';

// Outfit rules loaded once at module level
let outfitRules = [];
fetch('/js/app-ui/dress-up/outfit-rules.json')
  .then(r => r.json())
  .then(data => { outfitRules = data; })
  .catch(err => console.error('Failed to load outfit rules:', err));

const ItemList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
ItemList.className = 'item-list';

const ButtonRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
`;
ButtonRow.className = 'button-row';

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
 * @param {Function} props.onGenerate    – Called with the assembled prompt string
 * @param {boolean}  props.isGenerating  – True while a generation is in-flight
 */
export function DressUpForm({ onGenerate, isGenerating }) {
  const [additionalPrompts, setAdditionalPrompts] = useState('');
  const [clothingItems, setClothingItems] = useState([]);

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadState();
    setAdditionalPrompts(saved.additionalPrompts);
    setClothingItems(saved.clothingItems);
  }, []);

  // Persist on every change
  useEffect(() => {
    saveState({ additionalPrompts, clothingItems });
  }, [additionalPrompts, clothingItems]);

  // Item handlers
  const handleItemChange = useCallback((updatedItem) => {
    setClothingItems(prev =>
      prev.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
  }, []);

  const handleItemDelete = useCallback((id) => {
    setClothingItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleAddItem = useCallback(() => {
    setClothingItems(prev => [...prev, createDefaultItem()]);
  }, []);

  const handleClear = useCallback(() => {
    setAdditionalPrompts('');
    setClothingItems([]);
    clearState();
  }, []);

  const handleGenerate = useCallback(() => {
    const prompt = assemblePrompt(clothingItems, additionalPrompts, outfitRules);
    onGenerate(prompt);
  }, [clothingItems, additionalPrompts, onGenerate]);

  // Build preview
  const previewPrompt = assemblePrompt(clothingItems, additionalPrompts, outfitRules);

  return html`
    <${Panel} variant="outlined">
      <${VerticalLayout}>
        <${TagInput}
          label="Additional Prompts"
          value=${additionalPrompts}
          onInput=${setAdditionalPrompts}
          rows=${2}
          placeholder="Extra tags (character, pose, background, etc.)"
        />

        <${ItemList}>
          ${clothingItems.map(item => html`
            <${ClothingItem}
              key=${item.id}
              item=${item}
              onChange=${handleItemChange}
              onDelete=${handleItemDelete}
            />
          `)}
        </${ItemList}>

        <${ButtonRow}>
          <${Button}
            variant="medium-text"
            icon="plus"
            onClick=${handleAddItem}
          >
            Add Clothing Item
          <//>
          <${Button}
            variant="medium-text"
            color="danger"
            icon="trash"
            onClick=${handleClear}
          >
            Clear
          <//>
        </${ButtonRow}>

        ${previewPrompt ? html`
          <${PromptPreview}>
            <strong>Prompt preview:</strong> ${previewPrompt}
          </${PromptPreview}>
        ` : null}

        <${Button}
          variant="large-text"
          color="primary"
          icon="play"
          onClick=${handleGenerate}
          disabled=${isGenerating}
        >
          ${isGenerating ? 'Generating...' : 'Generate'}
        <//>
      </${VerticalLayout}>
    </${Panel}>
  `;
}
