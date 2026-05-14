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
import { H2, H3, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { AutocompleteInput } from '../autocomplete-input.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { loadOutfit, saveOutfitState, createBlankOutfit } from './anytale-state.mjs';
import { fetchOutfitList, saveOutfit, deleteOutfit } from './outfit-api.mjs';
import { CharacterPartItem } from './character-part-item.mjs';

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
export function OutfitSection({ libraryParts = [], onLibraryPartsChange, refreshKey = 0, scrollable = true }) {
  const toast = useToast();

  // ── Outfit state (lazy-loaded from localStorage) ─────────────────────
  const [outfit, setOutfit] = useState(() => loadOutfit());
  const [outfitList, setOutfitList] = useState([]);
  // Tracks the last-saved server copy; used to detect unsaved changes.
  const [libraryOutfit, setLibraryOutfit] = useState(null);
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
  const handleLibrarySelect = useCallback((inputValue) => {
    const trimmed = (inputValue || '').trim();
    if (!trimmed) return;
    const match = libraryParts.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (!match) {
      toast.info(`No saved part named '${trimmed}' found`);
      return;
    }
    if (outfit.parts.some(op => op.partUid === match.uid)) {
      toast.info(`Part '${match.name}' is already added`);
      return;
    }
    setOutfit(prev => ({
      ...prev,
      parts: [
        ...prev.parts,
        {
          partUid: match.uid,
          categoryAttributeValues: {},
          customAttributeValues: {},
          previewImageUrl: '',
        },
      ],
    }));
  }, [libraryParts, outfit.parts, toast]);

  const handlePartChange = useCallback((index, updatedPart) => {
    setOutfit(prev => {
      const newParts = [...prev.parts];
      newParts[index] = updatedPart;
      return { ...prev, parts: newParts };
    });
  }, []);

  // ── Outfit CRUD actions ──────────────────────────────────────────────

  const isInLibrary = !!(outfit.uid && outfitList.some(o => o.uid === outfit.uid));
  const hasChanges = !isInLibrary || !outfitsEqual(outfit, libraryOutfit);

  const handleSave = useCallback(async () => {
    let uid = outfit.uid;
    if (!uid) {
      // Auto-generate uid from name
      uid = (outfit.name || 'outfit')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
        `outfit-${Date.now()}`;
    }
    try {
      await saveOutfit(uid, { ...outfit, uid });
      const savedOutfit = { ...outfit, uid };
      setOutfit(prev => ({ ...prev, uid }));
      setLibraryOutfit(savedOutfit);
      const list = await fetchOutfitList();
      if (Array.isArray(list)) setOutfitList(list);
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
      if (Array.isArray(list)) setOutfitList(list);
      toast.success('Outfit deleted');
      const blank = createBlankOutfit();
      setOutfit(blank);
      setLibraryOutfit(null);
    } catch (err) {
      console.error('[OutfitSection] Delete failed:', err);
      toast.error(`Delete failed: ${err.message}`);
    }
  }, [outfit, toast]);

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

  const handleOutfitSelect = useCallback((inputValue) => {
    const trimmed = (inputValue || '').trim();
    if (!trimmed) return;
    const match = outfitList.find(o => o.name.toLowerCase() === trimmed.toLowerCase());
    if (!match) {
      toast.info(`No saved outfit named '${trimmed}' found`);
      return;
    }
    setOutfit(match);
    setLibraryOutfit(match);
  }, [outfitList, toast]);

  // ============================================================================
  // Render
  // ============================================================================

  const outerStyle = scrollable
    ? { display: 'flex', flexDirection: 'column', flex: '1 1 auto', overflow: 'hidden' }
    : { display: 'flex', flexDirection: 'column', flex: 'none' };
  const ContentWrapper = scrollable ? ScrollArea : VerticalLayout;

  return html`
    <${VerticalLayout} gap="medium" style=${outerStyle}>

      <${ContentWrapper}>
        <${VerticalLayout} gap="large">

          <!-- Load outfit from library -->
          <${AutocompleteInput}
            label="Load Outfit"
            placeholder="Type to search saved outfits..."
            suggestions=${outfitList.map(o => o.name)}
            onSelect=${handleOutfitSelect}
          />

          <!-- Outfit details -->
          <${VerticalLayout} gap="small">
            <${H2}>Outfit</${H2}>

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

            <${AutocompleteInput}
              label="Add Part from Library"
              placeholder="Type to search saved parts..."
              suggestions=${libraryParts.map(p => p.name)}
              onSelect=${handleLibrarySelect}
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
                    isGenerating=${false}
                  />
                `;
              }}
              getTitle=${(item) => {
                const lib = libraryParts.find(p => p.uid === item.partUid);
                return lib ? lib.name : (item.partUid || '(unknown part)');
              }}
              createItem=${() => ({ partUid: '', categoryAttributeValues: {}, customAttributeValues: {}, previewImageUrl: '' })}
              onChange=${(newParts) => setOutfit(prev => ({ ...prev, parts: newParts }))}
              addLabel="Add Part"
              hideAddItem
            />
          </${VerticalLayout}>

          <!-- Actions -->
          <${ButtonRow}>
            <${Button}
              variant="medium-text"
              color="primary"
              icon="save"
              onClick=${handleSave}
              disabled=${!outfit.name || (isInLibrary && !hasChanges)}
            >
              ${isInLibrary ? 'Update' : 'Save'}
            <//>
            <${Button}
              variant="medium-text"
              color="secondary"
              icon="trash"
              onClick=${handleDelete}
              disabled=${!isInLibrary}
            >
              Delete
            <//>
            <${Button}
              variant="medium-text"
              color="secondary"
              icon="x"
              onClick=${handleClear}
            >
              Clear
            <//>
          </${ButtonRow}>

        </${VerticalLayout}>
      </${ContentWrapper}>

    </${VerticalLayout}>
  `;
}
