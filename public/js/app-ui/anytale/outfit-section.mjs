/**
 * outfit-section.mjs – Outfit editor component for the "Character & Outfits" tab.
 *
 * Structure (top to bottom):
 *   1. H2 "Outfit"
 *   2. Load outfit AutocompleteInput
 *   3. Outfit name Input
 *   4. H3 "Parts"
 *   5. Recommended-missing types label (hidden when all present)
 *   6. AutocompleteInput to add a part from the library by name
 *   7. DynamicList of CharacterPartItem entries for outfit parts
 *   8. ButtonRow with Save, Delete, Clear buttons
 *
 * Props:
 *   @param {Array}    libraryParts          – Full list of library part configs
 *   @param {Function} [onLibraryPartsChange] – Called after a library save to refresh the parent list
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { H2, H3, VerticalLayout, HorizontalEdgesLayout } from '../../custom-ui/themed-base.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { loadOutfit, saveOutfitState, createBlankOutfit } from './anytale-state.mjs';
import { fetchOutfitList, createOutfit, saveOutfit, deleteOutfit } from './outfit-api.mjs';
import { assemblePartPreviewPrompt } from './prompt-assembler.mjs';
import { CharacterPartItem } from './character-part-item.mjs';
import { LibraryPartPicker } from './library-part-picker.mjs';
import { useProgress } from '../../custom-ui/msg/progress-context.mjs';
import { queueSSEManager } from '../queue-sse-manager.mjs';
import { useQueueStatus } from '../use-queue-status.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const ButtonRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
  flex: none;
`;
ButtonRow.className = 'outfit-button-row';

const ScrollArea = styled('div')`
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex: 1 1 auto;
  padding-right: ${() => currentTheme.value.spacing.small.padding};
`;
ScrollArea.className = 'outfit-scroll-area';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compare two outfit objects for equality (ignoring uid).
 */
function outfitsEqual(a, b) {
  if (!a || !b) return false;
  return a.name === b.name &&
    JSON.stringify(a.parts || []) === JSON.stringify(b.parts || []);
}

// ============================================================================
// Component
// ============================================================================

/**
 * OutfitSection
 *
 * @param {Object}   props
 * @param {Array}    props.libraryParts          – Library parts (from server)
 * @param {Function} [props.onLibraryPartsChange] – Called when library is updated
 * @param {number}   [props.refreshKey=0]         – Increment to force reload from localStorage
 */
export function OutfitSection({ libraryParts = [], onLibraryPartsChange, refreshKey = 0, scrollable = true, onOutfitListChange, onEditParts }) {
  const toast = useToast();
  const { items: queueItems } = useQueueStatus();
  const { show: progressShow } = useProgress();

  // ── Outfit state (lazy-loaded from localStorage) ─────────────────────
  const [outfit, setOutfit] = useState(() => loadOutfit());
  // Part preview generation: keyed by part index, truthy while in-flight
  const [generatingPreviews, setGeneratingPreviews] = useState({});
  // Always-current refs for use in persistent subscription closures
  const libraryPartsRef = useRef(libraryParts);
  libraryPartsRef.current = libraryParts;
  const outfitRef = useRef(outfit);
  outfitRef.current = outfit;
  const [outfitList, setOutfitList] = useState([]);
  // Tracks the last-saved server copy; used to detect unsaved changes.
  const [libraryOutfit, setLibraryOutfit] = useState(null);
  // Load-outfit modal state
  const [loadOutfitModalOpen, setLoadOutfitModalOpen] = useState(false);
  // Reload from localStorage when parent signals an import (refreshKey changes)
  const refreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === refreshKeyRef.current) return;
    refreshKeyRef.current = refreshKey;
    setOutfit(loadOutfit());
    setLibraryOutfit(null);
  }, [refreshKey]);
  // ── Recommended part types config ────────────────────────────────────
  const [recommendedOutfitPartTypes, setRecommendedOutfitPartTypes] = useState([]);

  useEffect(() => {
    fetch('/anytale/config')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.recommendedOutfitPartTypes)) {
          setRecommendedOutfitPartTypes(data.recommendedOutfitPartTypes);
        }
      })
      .catch(err => console.error('[OutfitSection] Failed to load AnyTale config:', err));
  }, []);

  const missingRecommendedTypes = useMemo(() => {
    if (!recommendedOutfitPartTypes.length) return [];
    const currentTypes = new Set();
    outfit.parts.forEach(op => {
      const libPart = libraryParts.find(p => p.uid === op.partUid);
      if (libPart && Array.isArray(libPart.type)) {
        libPart.type.forEach(t => currentTypes.add(t.toLowerCase()));
      }
    });
    return recommendedOutfitPartTypes.filter(rt => !currentTypes.has(rt.toLowerCase()));
  }, [recommendedOutfitPartTypes, outfit.parts, libraryParts]);

  // Persist outfit to localStorage on every change
  useEffect(() => {
    saveOutfitState(outfit);
  }, [outfit]);

  // Fetch outfit list on mount; also sync libraryOutfit for the active uid.
  useEffect(() => {
    fetchOutfitList()
      .then(list => {
        if (Array.isArray(list)) {
          setOutfitList(list);
          const uid = loadOutfit().uid;
          if (uid) {
            const saved = list.find(o => o.uid === uid);
            if (saved) setLibraryOutfit(saved);
          }
        }
      })
      .catch(err => console.error('[OutfitSection] Failed to fetch outfit list:', err));
  }, []);

  // ── Library autocomplete: add part from library ──────────────────────

  const requestPartPreviewCache = useCallback((index, updatedPart) => {
    const libConfig = libraryParts.find(p => p.uid === updatedPart.partUid);
    if (!libConfig) return;
    const prompt = assemblePartPreviewPrompt({
      config: {
        name: libConfig.name,
        previewBaseline: libConfig.previewBaseline || '',
        baseline: libConfig.baseline || '',
        attributes: libConfig.attributes || [],
      },
      data: { enabled: true, attributeValues: updatedPart.attributeValues, previewImageUrl: '' },
    });
    if (!prompt) return;
    fetch('/anytale/request-part-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
      .then(r => r.json())
      .then(result => {
        if (!result.found) return;
        setOutfit(prev => {
          const parts = [...(prev.parts || [])];
          if (parts[index]?.partUid === updatedPart.partUid) {
            parts[index] = { ...parts[index], previewImageUrl: result.portraitUrl };
          }
          return { ...prev, parts };
        });
      })
      .catch(() => {});
  }, [libraryParts]);

  const handleLibrarySelect = useCallback((match) => {
    if (!match) return;
    if (outfit.parts.some(op => op.partUid === match.uid)) {
      toast.info(`Part '${match.name}' is already added`);
      return;
    }
    const newIndex = outfit.parts.length;
    const newPart = { partUid: match.uid, attributeValues: {}, previewImageUrl: '' };
    setOutfit(prev => ({
      ...prev,
      parts: [...prev.parts, newPart],
    }));
    requestPartPreviewCache(newIndex, newPart);
  }, [outfit.parts, requestPartPreviewCache, toast]);

  const handlePartChange = useCallback((index, updatedPart) => {
    const currentPart = outfit.parts[index];
    const attrChanged = JSON.stringify(currentPart?.attributeValues) !== JSON.stringify(updatedPart.attributeValues);
    setOutfit(prev => {
      const newParts = [...prev.parts];
      newParts[index] = attrChanged ? { ...updatedPart, previewImageUrl: '' } : updatedPart;
      return { ...prev, parts: newParts };
    });
    if (attrChanged) {
      requestPartPreviewCache(index, { ...updatedPart, previewImageUrl: '' });
    }
  }, [outfit.parts, requestPartPreviewCache]);

  // ── Part preview generation (manual, via header action button) ───────

  // Persistent subscription: pick up Part Preview task-started events initiated by this section
  useEffect(() => {
    return queueSSEManager.subscribe({
      'queue:task-started': ({ taskId, source, subLabel, taskData }) => {
        if (source !== 'anytale' || subLabel !== 'Part Preview') return;
        if (taskData?.partContext !== 'outfit') return;
        const prompt = taskData.prompt;
        const currentParts = outfitRef.current.parts || [];
        const idx = currentParts.findIndex(op => {
          const libCfg = libraryPartsRef.current.find(p => p.uid === op.partUid);
          if (!libCfg) return false;
          return assemblePartPreviewPrompt({
            config: { name: libCfg.name, previewBaseline: libCfg.previewBaseline || '', baseline: libCfg.baseline || '', attributes: libCfg.attributes || [] },
            data: { enabled: true, attributeValues: op.attributeValues, previewImageUrl: '' },
          }) === prompt;
        });
        if (idx === -1) return;
        setGeneratingPreviews(prev => ({ ...prev, [idx]: taskId }));
        progressShow(taskId, {
          defaultTitle: 'Generating preview…',
          onComplete: (data) => {
            if (data.result?.imageUrl) {
              const url = `${data.result.imageUrl}?t=${Date.now()}`;
              setOutfit(prev => ({
                ...prev,
                parts: (prev.parts || []).map(op => {
                  const libCfg = libraryPartsRef.current.find(p => p.uid === op.partUid);
                  if (!libCfg) return op;
                  const assembled = assemblePartPreviewPrompt({
                    config: { name: libCfg.name, previewBaseline: libCfg.previewBaseline || '', baseline: libCfg.baseline || '', attributes: libCfg.attributes || [] },
                    data: { enabled: true, attributeValues: op.attributeValues, previewImageUrl: '' },
                  });
                  return assembled === prompt ? { ...op, previewImageUrl: url } : op;
                }),
              }));
            }
            setGeneratingPreviews(prev => { const next = { ...prev }; delete next[idx]; return next; });
          },
          onCancelled: () => setGeneratingPreviews(prev => { const next = { ...prev }; delete next[idx]; return next; }),
          onError: () => setGeneratingPreviews(prev => { const next = { ...prev }; delete next[idx]; return next; }),
          onDismiss: () => setGeneratingPreviews(prev => { const next = { ...prev }; delete next[idx]; return next; }),
        });
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isPartPreviewQueued = useCallback((item) => {
    const libConfig = libraryParts.find(p => p.uid === item.partUid);
    const partForPrompt = {
      config: {
        name: libConfig?.name || item.partUid,
        previewBaseline: libConfig?.previewBaseline || '',
        baseline: libConfig?.baseline || '',
        attributes: libConfig?.attributes || [],
      },
      data: { enabled: true, attributeValues: item.attributeValues, previewImageUrl: item.previewImageUrl || '' },
    };
    const prompt = assemblePartPreviewPrompt(partForPrompt);
    if (!prompt) return false;
    return queueItems.some(q =>
      (q.status === 'queued' || q.status === 'running') &&
      q.source === 'anytale' &&
      q.subLabel === 'Part Preview' &&
      q.taskData?.prompt === prompt
    );
  }, [queueItems, libraryParts]);

  const handlePreviewGenerate = useCallback(async (item, index) => {
    if (generatingPreviews[index]) return;
    if (isPartPreviewQueued(item)) return;

    const libConfig = libraryParts.find(p => p.uid === item.partUid);
    const partForPrompt = {
      config: {
        name: libConfig?.name || item.partUid,
        previewBaseline: libConfig?.previewBaseline || '',
        baseline: libConfig?.baseline || '',
        attributes: libConfig?.attributes || [],
      },
      data: {
        enabled: true,
        attributeValues: item.attributeValues,
        previewImageUrl: item.previewImageUrl || '',
      },
    };

    const prompt = assemblePartPreviewPrompt(partForPrompt);
    if (!prompt) {
      console.warn('[OutfitSection] No prompt for part preview, index', index);
      return;
    }

    try {
      const response = await fetch('/anytale/generate-part-preview?queueOnly=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, partContext: 'outfit' }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('[OutfitSection] Part preview generation failed:', err);
      toast.error(`Preview failed: ${err.message}`);
    }
  }, [generatingPreviews, libraryParts, toast, isPartPreviewQueued]);

  const partHeaderActions = [
    { icon: 'refresh', title: 'Generate preview', onClick: handlePreviewGenerate },
  ];

  // ── Outfit CRUD actions ──────────────────────────────────────────────

  const isInLibrary = !!(outfit.uid && outfitList.some(o => o.uid === outfit.uid));
  const hasChanges = !isInLibrary || !outfitsEqual(outfit, libraryOutfit);

  const handleSave = useCallback(async () => {
    try {
      let saved;
      if (outfit.uid) {
        // Update existing entry by its stable UUID
        ({ saved } = await saveOutfit(outfit.uid, outfit));
      } else {
        // Create new – server assigns the UUID
        ({ saved } = await createOutfit(outfit));
      }
      const uid = saved.uid;
      const savedOutfit = { ...outfit, uid };
      setOutfit(prev => ({ ...prev, uid }));
      setLibraryOutfit(savedOutfit);
      const list = await fetchOutfitList();
      if (Array.isArray(list)) { setOutfitList(list); onOutfitListChange?.(list); }
      toast.success('Outfit saved');
    } catch (err) {
      console.error('[OutfitSection] Save failed:', err);
      toast.error(`Save failed: ${err.message}`);
    }
  }, [outfit, toast]);

  const handleDelete = useCallback(async () => {
    if (!outfit.uid) return;
    const result = await showDialog(
      `Delete outfit "${outfit.name || outfit.uid}"? This cannot be undone.`,
      'Delete Outfit',
      ['Delete', 'Cancel']
    );
    if (result !== 'Delete') return;
    try {
      await deleteOutfit(outfit.uid);
      const list = await fetchOutfitList();
      if (Array.isArray(list)) { setOutfitList(list); onOutfitListChange?.(list); }
      toast.success('Outfit deleted');
      const blank = createBlankOutfit();
      setOutfit(blank);
      setLibraryOutfit(null);
    } catch (err) {
      console.error('[OutfitSection] Delete failed:', err);
      toast.error(`Delete failed: ${err.message}`);
    }
  }, [outfit, toast]);

  const handleRevert = useCallback(async () => {
    if (!libraryOutfit) return;
    const result = await showDialog('Revert this outfit to the saved library version? Unsaved changes will be lost.', 'Revert Outfit', ['Revert', 'Cancel']);
    if (result !== 'Revert') return;
    setOutfit(libraryOutfit);
  }, [libraryOutfit]);

  const handleEditParts = useCallback(() => {
    if (onEditParts) onEditParts(outfit.parts);
  }, [outfit.parts, onEditParts]);

  const handleClear = useCallback(async () => {
    const result = await showDialog(
      'Clear all outfit data? This will reset the form.',
      'Clear Outfit',
      ['Clear', 'Cancel']
    );
    if (result !== 'Clear') return;
    const blank = createBlankOutfit();
    setOutfit(blank);
    setLibraryOutfit(null);
  }, []);

  // ── Load outfit from library ─────────────────────────────────────────

  const handleOutfitSelect = useCallback((uid) => {
    if (!uid) return;
    const match = outfitList.find(o => o.uid === uid);
    if (!match) return;
    setOutfit(match);
    setLibraryOutfit(match);
  }, [outfitList]);

  // ============================================================================
  // Render
  // ============================================================================

  const outerStyle = scrollable
    ? { display: 'flex', flexDirection: 'column', flex: '1 1 auto', overflow: 'hidden' }
    : { display: 'flex', flexDirection: 'column', flex: 'none' };
  const ContentWrapper = scrollable ? ScrollArea : VerticalLayout;

  const sectionHtml = html`
    <${VerticalLayout} gap="medium" style=${outerStyle}>

      <${ContentWrapper}>
        <${VerticalLayout} gap="large">

          <!-- Outfit details -->
          <${VerticalLayout} gap="small">
            <${HorizontalEdgesLayout}>
              <${H2}>Outfit</${H2}>
              <${Button} variant="small-text" color="secondary" icon="folder-open" onClick=${() => setLoadOutfitModalOpen(true)}>Load<//>
            </${HorizontalEdgesLayout}>

            <${Input}
              label="Name"
              value=${outfit.name}
              onInput=${(e) => setOutfit(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Outfit name"
              widthScale="full"
            />
          </${VerticalLayout}>

          <!-- Parts -->
          <${VerticalLayout} gap="small">
            <${H3}>Parts</${H3}>

            ${missingRecommendedTypes.length > 0
              && html`<div style=${{ padding: currentTheme.value.spacing.small.padding, fontSize: currentTheme.value.typography.fontSize.small, color: currentTheme.value.colors.text.secondary }}><strong>Recommended Missing Outfit Parts:</strong> ${missingRecommendedTypes.join(', ')}</div>`
            }

            <${LibraryPartPicker}
              libraryParts=${libraryParts}
              onSelectPart=${handleLibrarySelect}
              onMissingPart=${(name) => toast.info(`No saved part named '${name}' found`)}
            />

            <${DynamicList}
              title="Outfit Parts"
              items=${outfit.parts}
              renderItem=${(item, i) => {
                const libConfig = libraryParts.find(p => p.uid === item.partUid);
                return html`
                  <${CharacterPartItem}
                    part=${item}
                    libraryConfig=${libConfig}
                    onPartChange=${(updated) => handlePartChange(i, updated)}
                    isGenerating=${!!generatingPreviews[i] || isPartPreviewQueued(item)}
                    onPreviewGenerate=${() => handlePreviewGenerate(item, i)}
                  />
                `;
              }}
              getTitle=${(item) => {
                const lib = libraryParts.find(p => p.uid === item.partUid);
                return lib ? lib.name : (item.partUid || '(unknown part)');
              }}
              createItem=${() => ({ partUid: '', attributeValues: {}, previewImageUrl: '' })}
              onChange=${(newParts) => setOutfit(prev => ({ ...prev, parts: newParts }))}
              addLabel="Add Part"
              hideAddItem
            />
          </${VerticalLayout}>

          <!-- Actions -->
          <${ButtonRow}>
            <${Button}
              variant="small-text"
              color="primary"
              icon="save"
              onClick=${handleSave}
              disabled=${!outfit.name || (isInLibrary && !hasChanges)}
            >
              ${isInLibrary ? 'Update' : 'Save'}
            <//>
            <${Button}
              variant="small-text"
              color="secondary"
              icon="undo"
              onClick=${handleRevert}
              disabled=${!isInLibrary || !hasChanges}
            >
              Revert
            <//>
            <${Button}
              variant="small-text"
              color="secondary"
              icon="send-alt"
              onClick=${handleEditParts}
              disabled=${!outfit.parts.length || !onEditParts}
            >
              Edit Parts
            <//>
            <${Button}
              variant="small-text"
              color="danger"
              icon="trash"
              onClick=${handleDelete}
              disabled=${!isInLibrary}
            >
              Delete
            <//>
            <${Button}
              variant="small-text"
              color="danger"
              icon="x"
              onClick=${handleClear}
            >
              Clear
            <//>
          </${ButtonRow}>

          <${SearchSelectModal}
            isOpen=${loadOutfitModalOpen}
            title="Load Outfit"
            items=${outfitList.map(o => ({ label: o.name || o.uid, value: o.uid }))}
            mode="single"
            onSelect=${handleOutfitSelect}
            onClose=${() => setLoadOutfitModalOpen(false)}
          />

        </${VerticalLayout}>
      </${ContentWrapper}>

    </${VerticalLayout}>
  `;
  // Part preview progress is shown via progressShow (progress-context),
  // so no inline ProgressBanners needed here.
  return sectionHtml;
}
