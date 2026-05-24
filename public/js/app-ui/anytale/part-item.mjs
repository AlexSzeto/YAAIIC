/**
 * part-item.mjs - Single part form for the AnyTale DynamicList.
 *
 * Renders the inner form content only - the outer shell (header, delete,
 * collapse, drag) is provided by DynamicList.
 *
 * Layout:
 *   Top row: 128x128 preview image (left) | Enabled + Name (right)
 *   Below:   Type, Preview Baseline, Baseline, Attributes
 */
import { html } from 'htm/preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { TagInput } from '../tags/tag-input.mjs';
import { VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { createDefaultAttribute, getPartsCoverage, setPartCoverage } from './anytale-state.mjs';
import { useQueueStatus } from '../use-queue-status.mjs';
import { assemblePartPreviewPrompt } from './prompt-assembler.mjs';
import { showDialog, showTextPrompt } from '../../custom-ui/overlays/dialog.mjs';
import { getClientId } from '../client-id.mjs';
import { ImagePreview } from './image-preview.mjs';
import { getCategoryTree, tagDefinitionExists, getTagDefinition } from '../tags/tag-data.mjs';
import { getTags, tagExists } from '../tags/tags.mjs';
import { TagSelectorPanel } from '../tags/tag-selector-panel.mjs';
import { ChipAutocompleteInput } from '../chip-autocomplete-input.mjs';
import { Checkbox } from '../../custom-ui/io/checkbox.mjs';
import { ToggleSwitch } from '../../custom-ui/io/toggle-switch.mjs';
import { formButtonStates } from '../forms.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const TopRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.medium.gap};
  align-items: flex-start;
`;
TopRow.className = 'part-item-top-row';

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
// Helpers
// ============================================================================

function toPartUid(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function getAttrOptions(optionsString) {
  // (none) text removed
  const options = [{ label: '', value: '' }];
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
 * @param {Object}   props.part              - Full part object { id, config, data }
 * @param {Function} props.onChange           - (updatedPart) => void
 * @param {string[]} [props.allTypes=[]]      - All unique type strings across all parts (for autocomplete suggestions)
 * @param {Object}   [props.libraryPart]      - The matching saved library config (or undefined)
 * @param {Function} [props.onLibraryChanged] - Called after a successful save or delete so the
 *                                              parent can refresh its library list.
 * @param {Object}   [props.previewBasePromptByType] - Map of type name to preview base prompt string.
 *                                                     When a new type is added and previewBaseline is empty,
 *                                                     the matching entry is used to auto-fill previewBaseline.
 */
export function PartItem({ part, onChange, allTypes = [], libraryPart, onLibraryChanged, onDeletedFromLibrary, previewBasePromptByType = {}, onPreviewGenerate, isGeneratingPreview = false }) {
  const { config, data } = part;
  const toast = useToast();

  // ── Queue items ref for stale-preview cleanup ───────────────────────────
  const { items: queueItems } = useQueueStatus();
  const queueItemsRef = useRef(queueItems);
  queueItemsRef.current = queueItems;

  // ── Tag import panel state (for the import-from-category helper) ────────
  const [selectorPanelOpen, setSelectorPanelOpen] = useState(false);
  const [editingAttrIndex, setEditingAttrIndex] = useState(-1);

  // ── Library action loading states ───────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Temporary partial-coverage setting (session-only, not part of library config) ─
  const partKey = config.uid || part.id;
  const [isRevealing, setIsRevealing] = useState(() => getPartsCoverage()[partKey] ?? false);
  const handleCoverageToggle = useCallback(() => {
    setIsRevealing(prev => {
      const next = !prev;
      setPartCoverage(partKey, next);
      return next;
    });
  }, [partKey]);

  // ── Local baseline state — committed to parent on blur, not per keystroke ─
  const [localPreviewBaseline, setLocalPreviewBaseline] = useState(config.previewBaseline || '');
  const [localBaseline, setLocalBaseline] = useState(config.baseline || '');
  const previewBaselineFocusedRef = useRef(false);
  const baselineFocusedRef = useRef(false);

  useEffect(() => {
    if (!previewBaselineFocusedRef.current) setLocalPreviewBaseline(config.previewBaseline || '');
  }, [config.previewBaseline]);

  useEffect(() => {
    if (!baselineFocusedRef.current) setLocalBaseline(config.baseline || '');
  }, [config.baseline]);

  // ── Update helpers ──────────────────────────────────────────────────────
  const updateConfig = useCallback((patch) => {
    onChange({ ...part, config: { ...config, ...patch } });
  }, [part, onChange]);

  const updateData = useCallback((patch) => {
    onChange({ ...part, data: { ...data, ...patch } });
  }, [part, onChange]);

  const requestPortraitCache = useCallback(async (updatedPart) => {
    const prompt = assemblePartPreviewPrompt(updatedPart);
    console.log('[auto-preview] requestPortraitCache called, prompt:', prompt || '(empty)');
    if (!prompt) return;
    const partUid = updatedPart.config?.uid || null;
    try {
      const r = await fetch('/anytale/request-part-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const result = await r.json();
      console.log('[auto-preview] cache lookup result:', result, 'partUid:', partUid);
      if (result.found) {
        onChange({ ...updatedPart, data: { ...updatedPart.data, previewImageUrl: result.portraitUrl } });
        return;
      }
      // Cache miss — cancel stale queued previews for this part and re-enqueue
      const stale = partUid
        ? queueItemsRef.current.filter(
            i => i.endpointKey === 'anytale-part-preview' && i.taskData?.partUid === partUid
          )
        : [];
      console.log('[auto-preview] stale queue items:', stale.length, stale.map(i => i.id));
      await Promise.all(stale.map(i =>
        fetch(`/queue/item/${encodeURIComponent(i.id)}`, { method: 'DELETE' }).catch(() => {})
      ));
      console.log('[auto-preview] enqueueing fresh preview, prompt:', prompt, 'partUid:', partUid);
      const enqRes = await fetch('/anytale/generate-part-preview?queueOnly=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, partContext: 'parts-list', partUid, clientId: getClientId() }),
      });
      console.log('[auto-preview] enqueue response status:', enqRes.status);
    } catch (err) {
      console.error('[auto-preview] requestPortraitCache error:', err);
    }
  }, [onChange]);

  // When a new type is added and previewBaseline is empty, auto-fill from previewBasePromptByType.
  const handleTypeChange = useCallback((newTypes) => {
    const oldTypeSet = new Set((Array.isArray(config.type) ? config.type : []).map(t => t.toLowerCase()));
    const added = newTypes.filter(t => !oldTypeSet.has(t.toLowerCase()));
    const patch = { type: newTypes };
    if (added.length > 0 && !config.previewBaseline?.trim()) {
      for (const t of added) {
        const entry = Object.entries(previewBasePromptByType).find(
          ([key]) => key.toLowerCase() === t.toLowerCase()
        );
        if (entry) {
          patch.previewBaseline = entry[1];
          break;
        }
      }
    }
    const updatedPart = { ...part, config: { ...config, ...patch } };
    onChange(updatedPart);
    requestPortraitCache(updatedPart);
  }, [part, config, previewBasePromptByType, onChange, requestPortraitCache]);

  // ── Attributes ──────────────────────────────────────────────────────────
  const handleAttrsChange = useCallback((newAttrs) => {
    // Remove values for attributes that no longer exist
    const validNames = new Set(newAttrs.map((a, i) => a.name ?? String(i)));
    const cleanedValues = Object.fromEntries(
      Object.entries(data.attributeValues || {}).filter(([k]) => validNames.has(k))
    );
    onChange({ ...part, config: { ...config, attributes: newAttrs }, data: { ...data, attributeValues: cleanedValues } });
  }, [part, config, data, onChange]);

  const handleAttrValueChange = useCallback((index, value) => {
    const attrName = config.attributes[index]?.name ?? String(index);
    const updatedPart = {
      ...part,
      data: {
        ...data,
        attributeValues: { ...data.attributeValues, [attrName]: value },
        previewImageUrl: '',
      },
    };
    onChange(updatedPart);
    requestPortraitCache(updatedPart);
  }, [part, data, config.attributes, onChange, requestPortraitCache]);

  const handleRandom = useCallback(() => {
    const attrs = config.attributes || [];
    if (attrs.length === 0) return;
    const newValues = {};
    for (let i = 0; i < attrs.length; i++) newValues[attrs[i].name ?? String(i)] = '';
    const count = Math.ceil(attrs.length / 3);
    const shuffled = attrs.map((_, i) => i);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const idx of shuffled.slice(0, count)) {
      const attr = attrs[idx];
      const opts = getAttrOptions(attr.options).filter(o => o.value !== '');
      if (opts.length > 0) newValues[attr.name ?? String(idx)] = opts[Math.floor(Math.random() * opts.length)].value;
    }
    const updatedPart = { ...part, data: { ...data, attributeValues: newValues, previewImageUrl: '' } };
    onChange(updatedPart);
    requestPortraitCache(updatedPart);
  }, [part, data, config.attributes, onChange, requestPortraitCache]);

  // ── Tag import helper: opens category selector for a specific attribute ─
  const handleTagImportClick = useCallback((attr, attrIndex) => {
    setEditingAttrIndex(attrIndex);
    setSelectorPanelOpen(true);
  }, []);

  const handleTagImport = useCallback((_displayName, internalName) => {
    const tree = getCategoryTree();
    const children = tree[internalName];

    let tags = [];
    if (Array.isArray(children)) {
      // Filter out intermediate nodes (contain ':' or '/')
      tags = children
        .filter(tag => !tag.includes(':') && !tag.includes('/'))
        .map(tag => tag.replace(/_/g, ' '));
    } else if (internalName && !internalName.includes(':') && !internalName.includes('/')) {
      // Direct leaf tag
      tags = [internalName.replace(/_/g, ' ')];
    }

    if (tags.length === 0) {
      toast.info('No leaf tags found for this category');
      setSelectorPanelOpen(false);
      return;
    }

    const next = [...config.attributes];
    const current = next[editingAttrIndex] || createDefaultAttribute();

    // Auto-fill name from category if currently empty
    const autoName = current.name
      ? current.name
      : internalName.split(/[:/]/).pop().replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toLowerCase());

    next[editingAttrIndex] = { ...current, name: autoName, options: tags.join(', ') };
    handleAttrsChange(next);
    setSelectorPanelOpen(false);
  }, [editingAttrIndex, config.attributes, handleAttrsChange, toast]);

  // ── Categorized options generator ─────────────────────────────────────
  const RAINBOW_COLORS = ['aqua', 'black', 'blonde', 'blue', 'brown', 'dark', 'dark aqua', 'dark blonde', 'dark blue', 'dark brown', 'dark green', 'dark grey', 'dark orange', 'dark pink', 'dark purple', 'dark red', 'dark white', 'dark yellow', 'gold', 'green', 'grey', 'light', 'light aqua', 'light blonde', 'light blue', 'light brown', 'light green', 'light grey', 'light orange', 'light pink', 'light purple', 'light red', 'light white', 'light yellow', 'orange', 'pink', 'purple', 'red', 'silver', 'white', 'yellow'];
  const COMMON_PATTERNS = ['argyle', 'camouflage', 'checkered', 'diagonal-striped', 'floral print', 'frilled', 'pinstripe', 'plaid', 'pleated', 'polka dot', 'print', 'ribbed', 'striped', 'vertical-striped' ];

  const generateCategorizedOptions = async (attrIndex, promptTitle, hint, categorizedOptions, defaultName) => {
    const keyword = await showTextPrompt(promptTitle, config.name.toLowerCase(), hint);
    if (!keyword || !keyword.trim()) return;
    const kw = keyword.trim().toLowerCase();
    const validTags = categorizedOptions
      .map(option => `${option} ${kw}`)
      .filter(tag => tagExists(tag));
    if (validTags.length === 0) {
      toast.info(`No ${promptTitle.toLowerCase()} variations found for "${kw}"`);
      return;
    }
    const next = [...config.attributes];
    // Auto-fill name with defaultName if currently empty
    const autoName = next[attrIndex].name || defaultName;
    next[attrIndex] = { ...next[attrIndex], name: autoName, options: validTags.join(', ') };
    handleAttrsChange(next);
  }

  const handleRainbowAction = useCallback(async (attr, attrIndex) => {
    generateCategorizedOptions(attrIndex, 'Color Keyword', 'e.g. eyeshadow', RAINBOW_COLORS, 'color');
  }, [config.attributes, config.name, handleAttrsChange, toast]);

  const handlePatternAction = useCallback(async (attr, attrIndex) => {
    generateCategorizedOptions(attrIndex, 'Pattern Keyword', 'e.g. shirt', COMMON_PATTERNS, 'pattern');
  }, [config.attributes, config.name, handleAttrsChange, toast]);


  const BANNED_VARIATION_KEYWORDS = ['holding', 'holding unworn', 'mismatched', 'no', 'removing', 'adjusting', 'torn', 'see-through', 'layered', 'impossible', 'gradient', 'two-tone', 'multicolored', 'unworn', 'wet']

  const handleVariationsAction = useCallback(async (attr, attrIndex) => {
    const keyword = await showTextPrompt('Leftover Variation Keyword', config.name.toLowerCase(), 'e.g. camisole');
    if (!keyword || !keyword.trim()) return;
    const kw = keyword.trim().toLowerCase();

    // Build an exclusion set from all other attributes so we don't suggest duplicates
    const coveredTags = new Set();
    for (let i = 0; i < config.attributes.length; i++) {
      if (i === attrIndex) continue;
      const opts = config.attributes[i].options || '';
      for (const tag of opts.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)) {
        coveredTags.add(tag);
      }
    }

    for (const banned of BANNED_VARIATION_KEYWORDS) {
      coveredTags.add(`${banned} ${kw}`);
    }

    const validTags = getTags().filter(tag => {
      const normalised = tag.replace(/_/g, ' ');
      return (normalised.endsWith(`-${kw}`) || normalised.endsWith(` ${kw}`)) && !coveredTags.has(normalised);
    }).map(tag => tag.replace(/_/g, ' '));

    if (validTags.length === 0) {
      toast.info(`No uncovered variations found for "${kw}"`);
      return;
    }
    const next = [...config.attributes];
    // Auto-fill name with "style" if currently empty
    const autoName = next[attrIndex].name || 'style';
    next[attrIndex] = { ...next[attrIndex], name: autoName, options: validTags.join(', ') };
    handleAttrsChange(next);
  }, [config.attributes, config.name, handleAttrsChange, toast]);

  // ── Header select: value picker shown inside each attribute item header ──
  const getAttrSelectOptions = useCallback((attr) => getAttrOptions(attr.options), []);
  const getAttrSelectValue   = useCallback((attr, i) => data.attributeValues?.[attr.name] || '', [data.attributeValues]);
  const handleAttrSelectChange = useCallback((attr, i, value) => handleAttrValueChange(i, value), [handleAttrValueChange]);
  const getAttrSelectTooltip = useCallback((attr) => getTagDefinition(data.attributeValues?.[attr.name] || '') || null, [data.attributeValues]);

  // ── Library: Save to Library ────────────────────────────────────────────
  const handleSaveToLibrary = useCallback(async () => {
    if (!config.name || !config.name.trim()) {
      toast.info('Part must have a name before saving');
      return;
    }
    setIsSaving(true);
    try {
      let savedUid;
      if (config.uid) {
        // Update existing entry by its stable UUID
        const response = await fetch(`/anytale/parts/${config.uid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }
        savedUid = config.uid;
      } else {
        // Create new – server assigns the UUID
        const response = await fetch('/anytale/parts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }
        const { saved } = await response.json();
        savedUid = saved.uid;
      }
      onChange({ ...part, config: { ...config, uid: savedUid } });
      if (onLibraryChanged) onLibraryChanged();
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
    const result = await showDialog(`Delete '${config.name}' from the library? This cannot be undone.`, 'Delete from Library', ['Delete', 'Cancel']);
    if (result !== 'Delete') return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/anytale/parts/${uid}`, { method: 'DELETE' });
      if (response.status === 404) {
        toast.info(`${config.name} is not in the library`);
        return;
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      if (onLibraryChanged) onLibraryChanged();
      if (onDeletedFromLibrary) onDeletedFromLibrary();
      toast.success(`Deleted ${config.name} from library`);
    } catch (err) {
      console.error('[PartItem] Delete from library failed:', err);
      toast.error(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  }, [config, onLibraryChanged, onDeletedFromLibrary, toast]);

  // ── Library: Revert to Library ────────────────────────────────────────────
  const handleRevertToLibrary = useCallback(async () => {
    if (!libraryPart) return;
    const result = await showDialog('Revert this part to the saved library version? Unsaved changes will be lost.', 'Revert Part', ['Revert', 'Cancel']);
    if (result !== 'Revert') return;
    onChange({ ...part, config: { ...libraryPart } });
  }, [libraryPart, part, onChange]);

  const isUnchangedFromLibrary = !!libraryPart && JSON.stringify({
    name: config.name, type: config.type, baseline: config.baseline,
    previewBaseline: config.previewBaseline, attributes: config.attributes,
  }) === JSON.stringify({
    name: libraryPart.name, type: libraryPart.type, baseline: libraryPart.baseline,
    previewBaseline: libraryPart.previewBaseline, attributes: libraryPart.attributes,
  });
  const { saveLabel, saveEnabled, deleteEnabled, revertEnabled } = formButtonStates(!!libraryPart, !isUnchangedFromLibrary);

  return html`
    <${VerticalLayout} gap="medium">
      <${Checkbox}
        label="Partial Coverage (temporary setting test)"
        checked=${isRevealing}
        onChange=${handleCoverageToggle}
      />
      <!-- Top row: preview image | name + type -->
      <${TopRow}>
        <div style=${{ display: 'flex', flexDirection: 'column', gap: currentTheme.value.spacing.small.gap, flexShrink: 0 }}>
          <${ImagePreview} src=${data.previewImageUrl} alt="Part preview" isGenerating=${isGeneratingPreview} />
          ${onPreviewGenerate ? html`
            <${Button}
              variant="small-text"
              color="primary"
              icon="play"
              onClick=${onPreviewGenerate}
              disabled=${isGeneratingPreview}
            >
              ${isGeneratingPreview ? 'Generating...' : 'Preview'}
            </${Button}>
            <${Button}
              variant="small-text"
              color="primary"
              icon="dice-3"
              onClick=${handleRandom}
              disabled=${isGeneratingPreview}
            >
              Random
            </${Button}>
          ` : null}
        </div>
        <${RightFields}>
          <${Input}
            label="Name"
            value=${config.name}
            onInput=${(e) => updateConfig({ name: e.target.value })}
            placeholder="Part name"
            widthScale="full"
            heightScale="compact"
          />
          <${ChipAutocompleteInput}
            label="Type"
            placeholder="e.g. hair, outfit, accessory"
            suggestions=${allTypes}
            values=${Array.isArray(config.type) ? config.type : []}
            onValuesChange=${handleTypeChange}
          />
        </${RightFields}>
      </${TopRow}>

      <!-- Preview Baseline Tags -->
      <${TagInput}
        label="Preview Baseline Tags"
        value=${localPreviewBaseline}
        onInput=${setLocalPreviewBaseline}
        onFocus=${() => { previewBaselineFocusedRef.current = true; }}
        onBlur=${() => {
          previewBaselineFocusedRef.current = false;
          const updatedPart = { ...part, config: { ...config, previewBaseline: localPreviewBaseline } };
          onChange(updatedPart);
          requestPortraitCache(updatedPart);
        }}
        rows=${2}
        placeholder="Tags for preview generation only..."
      />

      <!-- Baseline Tags -->
      <${TagInput}
        label="Baseline Tags"
        value=${localBaseline}
        onInput=${setLocalBaseline}
        onFocus=${() => { baselineFocusedRef.current = true; }}
        onBlur=${() => {
          baselineFocusedRef.current = false;
          const updatedPart = { ...part, config: { ...config, baseline: localBaseline } };
          onChange(updatedPart);
          requestPortraitCache(updatedPart);
        }}
        rows=${2}
        placeholder="Tags always included in prompts..."
      />

      <!-- Attributes -->
      <${DynamicList}
        title="Attributes"
        items=${config.attributes}
        getTitle=${(attr) => attr.name || 'untitled'}
        renderItem=${(attr, i) => html`
          <${VerticalLayout} gap="small">
          <${AttrRow}>
            <${Input}
              label="Name"
              value=${attr.name}
              onInput=${(e) => {
                const next = [...config.attributes];
                next[i] = { ...attr, name: e.target.value };
                handleAttrsChange(next);
              }}
              placeholder="Label"
              widthScale="normal"
              heightScale="compact"
            />
            <${TagInput}
              label="Options"
              value=${attr.options}
              onInput=${(text) => {
                const next = [...config.attributes];
                next[i] = { ...attr, options: text };
                handleAttrsChange(next);
              }}
              rows=${1}
              placeholder="tag1, tag2, ..."
            />
          </${AttrRow}>
          <${AttrRow}>
            <${Button}
              variant="small-text"
              icon="palette"
              onClick=${(e) => { e.stopPropagation(); handleRainbowAction(attr, i); }}
            >Colors</${Button}>
            <${Button}
              variant="small-text"
              icon="apps"
              onClick=${(e) => { e.stopPropagation(); handlePatternAction(attr, i); }}
            >Patterns</${Button}>
            <${Button}
              variant="small-text"
              icon="menu"
              onClick=${(e) => { e.stopPropagation(); handleVariationsAction(attr, i); }}
            >Leftovers</${Button}>
            <${Button}
              variant="small-text"
              icon="tag"
              onClick=${(e) => { e.stopPropagation(); handleTagImportClick(attr, i); }}
            >Import</${Button}>
          </${AttrRow}>
          </${VerticalLayout}>
        `}
        createItem=${createDefaultAttribute}
        onChange=${handleAttrsChange}
        addLabel="Add Attribute"
        getHeaderSelectOptions=${getAttrSelectOptions}
        getHeaderSelectValue=${getAttrSelectValue}
        onHeaderSelectChange=${handleAttrSelectChange}
        getHeaderSelectTooltip=${getAttrSelectTooltip}
      />

      <!-- Library Actions -->
      <${AttrRow} style=${{ marginTop: currentTheme.value.spacing.small.gap }}>
        <${Button}
          variant="small-text"
          color="primary"
          icon="save"
          onClick=${handleSaveToLibrary}
          disabled=${isSaving || isDeleting || !saveEnabled}
        >
          ${isSaving ? 'Saving...' : saveLabel}
        </${Button}>
        <${Button}
          variant="small-text"
          color="secondary"
          icon="undo"
          onClick=${handleRevertToLibrary}
          disabled=${isSaving || isDeleting || !revertEnabled}
        >
          Revert
        </${Button}>
        <${Button}
          variant="small-text"
          color="danger"
          icon="trash"
          onClick=${handleDeleteFromLibrary}
          disabled=${isSaving || isDeleting || !deleteEnabled}
        >
          ${isDeleting ? 'Deleting...' : 'Delete'}
        </${Button}>
      </${AttrRow}>

      <!-- Tag import panel (opened by the tag-import helper button) -->
      <${TagSelectorPanel}
        isOpen=${selectorPanelOpen}
        initialSearchTerm=${config.name}
        onReplace=${handleTagImport}
        onClose=${() => setSelectorPanelOpen(false)}
        showInsert=${false}
        showReplace=${true}
        replaceRequiresDefinition=${false}
      />
    </${VerticalLayout}>
  `;
}
