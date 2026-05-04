/**
 * part-item.mjs – Single part form for the AnyTale DynamicList.
 *
 * Renders the inner form content only — the outer shell (header, delete,
 * collapse, drag) is provided by DynamicList.
 *
 * Layout:
 *   Top row: 128×128 preview image (left) | Enabled + Name (right)
 *   Below:   Type, Preview Baseline, Baseline, Category Attributes, Custom Attributes
 */
import { html } from 'htm/preact';
import { useState, useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { TagInput } from '../tags/tag-input.mjs';
import { VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { createDefaultCategoryAttribute, createDefaultCustomAttribute } from './anytale-state.mjs';
import { createImageModal } from '../../custom-ui/overlays/modal.mjs';
import { getCategoryTree, getTagDefinition } from '../tags/tag-data.mjs';
import { TagSelectorPanel } from '../tags/tag-selector-panel.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const TopRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.medium.gap};
  align-items: flex-start;
`;
TopRow.className = 'part-item-top-row';

const PreviewArea = styled('div')`
  flex: 0 0 128px;
  width: 128px;
  height: 128px;
  border-radius: ${() => currentTheme.value.spacing.small.borderRadius};
  background-color: ${() => currentTheme.value.colors.background.tertiary};
  border: ${() => `${currentTheme.value.border.width} ${currentTheme.value.border.style} ${currentTheme.value.colors.border.secondary}`};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
`;
PreviewArea.className = 'part-item-preview-area';

const PreviewImage = styled('img')`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: ${() => currentTheme.value.spacing.small.borderRadius};
`;
PreviewImage.className = 'part-item-preview-image';

const PreviewPlaceholder = styled('div')`
  color: ${() => currentTheme.value.colors.text.muted};
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  text-align: center;
  padding: ${() => currentTheme.value.spacing.small.padding};
`;
PreviewPlaceholder.className = 'part-item-preview-placeholder';

const RightFields = styled('div')`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
RightFields.className = 'part-item-right-fields';

const AttrRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  align-items: end;
  flex-wrap: wrap;
`;
AttrRow.className = 'part-item-attr-row';

// ============================================================================
// Helper: uid derivation
// ============================================================================

function toPartUid(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ============================================================================
// Helper: Category attribute value dropdown options
// ============================================================================

/**
 * Build Select options from a category internal name.
 * If the name is a key in categoryTree → direct leaf children.
 * If it's an individual tag → just that tag.
 * Always starts with (none).
 */
function getCategoryOptions(categoryInternal) {
  if (!categoryInternal) return [{ label: '(none)', value: '' }];
  const tree = getCategoryTree();
  const children = tree[categoryInternal];
  const options = [{ label: '(none)', value: '' }];
  if (Array.isArray(children)) {
    for (const child of children) {
      const display = child.replace(/_/g, ' ');
      options.push({ label: display, value: child });
    }
  } else {
    const display = categoryInternal.replace(/_/g, ' ');
    options.push({ label: display, value: categoryInternal });
  }
  return options;
}

// ============================================================================
// Helper: Custom attribute value dropdown options
// ============================================================================

function getCustomOptions(optionsString) {
  const options = [{ label: '(none)', value: '' }];
  if (!optionsString || !optionsString.trim()) return options;
  const tags = optionsString.split(',').map(t => t.trim()).filter(t => t);
  for (const tag of tags) {
    options.push({ label: tag, value: tag });
  }
  return options;
}

// ============================================================================
// PartItem Component
// ============================================================================

/**
 * @param {Object}   props
 * @param {Object}   props.part      – Full part object { id, config, data }
 * @param {Function} props.onChange   – (updatedPart) => void
 */
export function PartItem({ part, onChange }) {
  const { config, data } = part;
  const toast = useToast();

  // ── Category selector panel state ───────────────────────────────────────
  const [selectorPanelOpen, setSelectorPanelOpen] = useState(false);
  const [editingCatIndex, setEditingCatIndex] = useState(-1);

  // ── Library action loading states ───────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Update helpers ──────────────────────────────────────────────────────
  const updateConfig = useCallback((patch) => {
    onChange({ ...part, config: { ...config, ...patch } });
  }, [part, onChange]);

  const updateData = useCallback((patch) => {
    onChange({ ...part, data: { ...data, ...patch } });
  }, [part, onChange]);

  // ── Category attributes ─────────────────────────────────────────────────
  const handleCategoryAttrsChange = useCallback((newAttrs) => {
    updateConfig({ categoryAttributes: newAttrs });
  }, [updateConfig]);

  const handleCategoryValueChange = useCallback((index, value) => {
    const attrName = config.categoryAttributes[index]?.name ?? String(index);
    updateData({
      categoryAttributeValues: {
        ...data.categoryAttributeValues,
        [attrName]: value,
      },
    });
  }, [data, config.categoryAttributes, updateData]);

  // ── Custom attributes ───────────────────────────────────────────────────
  const handleCustomAttrsChange = useCallback((newAttrs) => {
    updateConfig({ customAttributes: newAttrs });
  }, [updateConfig]);

  const handleCustomValueChange = useCallback((index, value) => {
    const attrName = config.customAttributes[index]?.name ?? String(index);
    updateData({
      customAttributeValues: {
        ...data.customAttributeValues,
        [attrName]: value,
      },
    });
  }, [data, config.customAttributes, updateData]);

  // ── Category selector panel ─────────────────────────────────────────────
  const handleCategoryButtonClick = useCallback((index) => {
    setEditingCatIndex(index);
    setSelectorPanelOpen(true);
  }, []);

  const handleCategoryReplace = useCallback((_displayName, internalName) => {
    const next = [...config.categoryAttributes];
    const current = next[editingCatIndex];
    const autoName = current.name
      ? current.name
      : internalName.split(/[:/]/).pop().replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
    next[editingCatIndex] = { ...current, category: internalName, name: autoName };
    handleCategoryAttrsChange(next);
    setSelectorPanelOpen(false);
  }, [editingCatIndex, config.categoryAttributes, handleCategoryAttrsChange]);

  // ── Library: Save to Library ────────────────────────────────────────────
  const handleSaveToLibrary = useCallback(async () => {
    if (!config.name || !config.name.trim()) {
      toast.warning('Part must have a name before saving');
      return;
    }
    const uid = toPartUid(config.name);
    setIsSaving(true);
    try {
      const response = await fetch(`/anytale/parts/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, uid }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      // Persist derived uid back into config so future deletes work by uid
      onChange({ ...part, config: { ...config, uid } });
      toast.success(`Saved ${config.name} to library`);
    } catch (err) {
      console.error('[PartItem] Save to library failed:', err);
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [config, part, onChange, toast]);

  // ── Library: Delete from Library ────────────────────────────────────────
  const handleDeleteFromLibrary = useCallback(async () => {
    if (!config.name || !config.name.trim()) return;
    const uid = config.uid || toPartUid(config.name);
    const confirmed = window.confirm(`Delete '${config.name}' from the library? This cannot be undone.`);
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/anytale/parts/${uid}`, { method: 'DELETE' });
      if (response.status === 404) {
        toast.warning(`${config.name} is not in the library`);
        return;
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      toast.success(`Deleted ${config.name} from library`);
    } catch (err) {
      console.error('[PartItem] Delete from library failed:', err);
      toast.error(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  }, [config, toast]);

  // ── Preview click ───────────────────────────────────────────────────────
  const handlePreviewClick = useCallback(() => {
    if (data.previewImageUrl) {
      createImageModal(data.previewImageUrl);
    }
  }, [data.previewImageUrl]);

  return html`
    <${VerticalLayout} gap="small">
      <!-- Top row: preview image | name + type -->
      <${TopRow}>
        <${PreviewArea} onClick=${handlePreviewClick}>
          ${data.previewImageUrl
            ? html`<${PreviewImage} src=${data.previewImageUrl} alt="Preview" />`
            : html`<${PreviewPlaceholder}>No preview</${PreviewPlaceholder}>`
          }
        </${PreviewArea}>
        <${RightFields}>
          <${Input}
            label="Name"
            value=${config.name}
            onInput=${(e) => updateConfig({ name: e.target.value })}
            placeholder="Part name"
            widthScale="full"
            heightScale="compact"
          />
          <${Input}
            label="Type"
            value=${config.type}
            onInput=${(e) => updateConfig({ type: e.target.value })}
            placeholder="e.g. hair, outfit, accessory"
            widthScale="full"
            heightScale="compact"
          />
        </${RightFields}>
      </${TopRow}>

      <!-- Preview Baseline Tags -->
      <${TagInput}
        label="Preview Baseline Tags"
        value=${config.previewBaseline}
        onInput=${(text) => updateConfig({ previewBaseline: text })}
        rows=${2}
        placeholder="Tags for preview generation only..."
      />

      <!-- Baseline Tags -->
      <${TagInput}
        label="Baseline Tags"
        value=${config.baseline}
        onInput=${(text) => updateConfig({ baseline: text })}
        rows=${2}
        placeholder="Tags always included in prompts..."
      />

      <!-- Category Attributes -->
      <${DynamicList}
        title="Category Attributes"
        items=${config.categoryAttributes}
        condensed=${true}
        renderItem=${(attr, i) => html`
          <${AttrRow}>
            <${Input}
              label="Name"
              value=${attr.name}
              onInput=${(e) => {
                const next = [...config.categoryAttributes];
                next[i] = { ...attr, name: e.target.value };
                handleCategoryAttrsChange(next);
              }}
              placeholder="Label"
              widthScale="compact"
              heightScale="compact"
            />
            <${Button}
              label="Category"
              variant="small-text"
              widthScale="compact"
              color="secondary"
              onClick=${() => handleCategoryButtonClick(i)}
              style=${{ width: '100%', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              tooltip=${attr.category || 'Select category'}
            >
              ${attr.category
                ? attr.category.replace(/^tag_group:/, '').replace(/_/g, ' ')
                : 'Select'
              }
            </${Button}>
            <${Select}
              label="Value"
              options=${getCategoryOptions(attr.category)}
              value=${data.categoryAttributeValues?.[attr.name] || ''}
              onChange=${(e) => handleCategoryValueChange(i, e.target.value)}
              heightScale="compact"
              tooltip=${getTagDefinition(data.categoryAttributeValues?.[attr.name] || '') || null}
            />
          </${AttrRow}>
        `}
        createItem=${createDefaultCategoryAttribute}
        onChange=${handleCategoryAttrsChange}
        addLabel="Add Category Attribute"
        showDragButton=${false}
      />

      <!-- Custom Attributes -->
      <${DynamicList}
        title="Custom Attributes"
        items=${config.customAttributes}
        getTitle=${(attr) => attr.name || 'Untitled'}
        renderItem=${(attr, i) => html`
          <${AttrRow}>
            <${Input}
              label="Name"
              value=${attr.name}
              onInput=${(e) => {
                const next = [...config.customAttributes];
                next[i] = { ...attr, name: e.target.value };
                handleCustomAttrsChange(next);
              }}
              placeholder="Label"
              widthScale="normal"
              heightScale="compact"
            />
            <${TagInput}
              label="Options"
              value=${attr.options}
              onInput=${(text) => {
                const next = [...config.customAttributes];
                next[i] = { ...attr, options: text };
                handleCustomAttrsChange(next);
              }}
              rows=${1}
              placeholder="tag1, tag2, ..."
            />
            <${Select}
              label="Value"
              options=${getCustomOptions(attr.options)}
              value=${data.customAttributeValues?.[attr.name] || ''}
              onChange=${(e) => handleCustomValueChange(i, e.target.value)}
              heightScale="compact"
              tooltip=${getTagDefinition(data.customAttributeValues?.[attr.name] || '') || null}
            />
          </${AttrRow}>
        `}
        createItem=${createDefaultCustomAttribute}
        onChange=${handleCustomAttrsChange}
        addLabel="Add Custom Attribute"
        showDragButton=${false}
      />

      <!-- Library Actions -->
      <${AttrRow} style=${{ marginTop: currentTheme.value.spacing.small.gap }}>
        <${Button}
          variant="small-text"
          color="secondary"
          icon="save"
          onClick=${handleSaveToLibrary}
          disabled=${isSaving || isDeleting}
        >
          ${isSaving ? 'Saving...' : 'Save to Library'}
        </${Button}>
        <${Button}
          variant="small-text"
          color="danger"
          icon="trash"
          onClick=${handleDeleteFromLibrary}
          disabled=${isSaving || isDeleting}
        >
          ${isDeleting ? 'Deleting...' : 'Delete from Library'}
        </${Button}>
      </${AttrRow}>

      <!-- Category selector panel (opened by category attribute buttons) -->
      <${TagSelectorPanel}
        isOpen=${selectorPanelOpen}
        initialSearchTerm=${editingCatIndex >= 0
          ? (config.categoryAttributes[editingCatIndex]?.category || config.name.toLowerCase())
          : ''}
        onReplace=${handleCategoryReplace}
        onClose=${() => setSelectorPanelOpen(false)}
        showInsert=${false}
        showReplace=${true}
        replaceRequiresDefinition=${false}
      />
    </${VerticalLayout}>
  `;
}
