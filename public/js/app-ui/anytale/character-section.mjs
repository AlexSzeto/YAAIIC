/**
 * character-section.mjs – Full Character tab component for the AnyTale page.
 *
 * Structure:
 *   - Character section: Name, Personality, Portrait preview, Audio URL
 *     + Generate Portrait / Generate Voice buttons
 *   - Parts section: Add Part from Library autocomplete, DynamicList of CharacterPartItem
 *   - Sticky Generation and Actions section: preview plot autocomplete, prompt preview,
 *     Generate / Save / Delete / Clear buttons
 *
 * Props:
 *   @param {Array}    libraryParts        – Full list of library part configs
 *   @param {Function} onGenerate          – Called with (prompt, name, partsData, plotData) when Generate is clicked
 *   @param {boolean}  isGenerating        – True while a main generation is in-flight
 *   @param {Function} onLibraryPartsChange – Called after a library save to refresh the parent list
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useRef, useMemo } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { H2, VerticalLayout, HorizontalEdgesLayout } from '../../custom-ui/themed-base.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { AudioPlayer } from '../../custom-ui/media/audio-player.mjs';
import { loadCharacter, saveCharacterState, createBlankCharacter } from './anytale-state.mjs';
import { fetchCharacterList, createCharacter, saveCharacter, deleteCharacter, generateCharacterPortrait, generateCharacterVoice } from './character-api.mjs';
import { assemblePartPreviewPrompt } from './prompt-assembler.mjs';
import { CharacterPartItem } from './character-part-item.mjs';
import { ImagePreview } from './image-preview.mjs';
import { ChipAutocompleteInput } from '../chip-autocomplete-input.mjs';
import { fetchOutfitList } from './outfit-api.mjs';
import { LibraryPartPicker } from './library-part-picker.mjs';
import { sseManager } from '../sse-manager.mjs';
import { ProgressBanner } from '../../custom-ui/msg/progress-banner.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const ButtonRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
  flex: none;
`;
ButtonRow.className = 'char-button-row';

const StickySection = styled('div')`
  flex: none;
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.medium.gap};
  padding-top: ${() => currentTheme.value.spacing.medium.padding};
`;
StickySection.className = 'char-sticky-section';

const ScrollArea = styled('div')`
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex: 1 1 auto;
  padding-right: ${() => currentTheme.value.spacing.small.padding};
`;
ScrollArea.className = 'char-scroll-area';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compare two character objects for equality (ignoring uid).
 * Parts are compared via JSON.stringify since their keys are stable.
 */
function charactersEqual(a, b) {
  if (!a || !b) return false;
  return a.name === b.name &&
    a.personality === b.personality &&
    (a.portraitUrl || '') === (b.portraitUrl || '') &&
    (a.audioUrl || '') === (b.audioUrl || '') &&
    (a.introTranscript || '') === (b.introTranscript || '') &&
    JSON.stringify(a.parts || []) === JSON.stringify(b.parts || []) &&
    JSON.stringify(a.preferredOutfits || []) === JSON.stringify(b.preferredOutfits || []);
}

/**
 * Convert character parts to the shape used by assemblePrompt:
 * [{ config, data }] — mirroring the AnyTaleForm parts array format.
 */
function characterPartsToPromptParts(characterParts, libraryParts) {
  return characterParts
    .map(cp => {
      const lib = libraryParts.find(p => p.uid === cp.partUid);
      if (!lib) return null;
      return {
        config: {
          name: lib.name,
          type: lib.type,
          baseline: lib.baseline,
          previewBaseline: lib.previewBaseline,
          attributes: lib.attributes,
        },
        data: {
          enabled: true,
          attributeValues: cp.attributeValues,
          previewImageUrl: cp.previewImageUrl || '',
        },
      };
    })
    .filter(Boolean);
}

// ============================================================================
// Component
// ============================================================================

/**
 * CharacterSection
 *
 * @param {Object}   props
 * @param {Array}    props.libraryParts          – Library parts (from server)
 * @param {Function} [props.onLibraryPartsChange] – Called when library is updated
 * @param {Function} [props.onImportHandlerReady] – Exposes the import handler to the parent
 * @param {number}   [props.refreshKey=0]         – Increment to force reload from localStorage
 */
export function CharacterSection({ libraryParts = [], onLibraryPartsChange, onImportHandlerReady, refreshKey = 0, scrollable = true, outfitList: outfitListProp, onEditParts }) {
  const toast = useToast();

  // ── Character state (lazy-loaded from localStorage) ─────────────────────
  const [character, setCharacter] = useState(() => loadCharacter());
  const [savedCharacterUid, setSavedCharacterUid] = useState(() => loadCharacter().uid || null);
  const [characterList, setCharacterList] = useState([]);
  // Tracks the last-saved server copy; used to detect unsaved changes.
  const [libraryCharacter, setLibraryCharacter] = useState(null);
  // Load-character modal state
  const [loadCharModalOpen, setLoadCharModalOpen] = useState(false);
  const [loadPartModalOpen, setLoadPartModalOpen] = useState(false);

  // Reload from localStorage when parent signals an import (refreshKey changes)
  const refreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === refreshKeyRef.current) return;
    refreshKeyRef.current = refreshKey;
    const loaded = loadCharacter();
    setCharacter(loaded);
    setSavedCharacterUid(loaded.uid || null);
    setLibraryCharacter(null);
  }, [refreshKey]);

  // ── Generation state ─────────────────────────────────────────────────────
  const [portraitTaskId, setPortraitTaskId] = useState(null);
  const isGeneratingPortrait = !!portraitTaskId;
  const [voiceTaskId, setVoiceTaskId] = useState(null);
  const isGeneratingVoice = !!voiceTaskId;
  // Part preview generation: keyed by part index, truthy while in-flight
  const [generatingPreviews, setGeneratingPreviews] = useState({});

  // ── Outfit list for preferredOutfits autocomplete ────────────────────────
  const [outfitListInternal, setOutfitListInternal] = useState([]);
  // Use prop if provided (kept in sync by parent); fall back to internal fetch.
  const outfitList = outfitListProp ?? outfitListInternal;

  useEffect(() => {
    if (outfitListProp !== undefined) return; // parent manages this
    fetchOutfitList()
      .then(list => { if (Array.isArray(list)) setOutfitListInternal(list); })
      .catch(err => console.error('[CharacterSection] Failed to fetch outfit list:', err));
  }, [outfitListProp]);

  const [recommendedPartTypes, setRecommendedPartTypes] = useState([]);

  // Fetch recommended part types config on mount
  useEffect(() => {
    fetch('/anytale/config')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.recommendedCharacterPartTypes)) {
          setRecommendedPartTypes(data.recommendedCharacterPartTypes);
        }
      })
      .catch(err => console.error('[CharacterSection] Failed to load AnyTale config:', err));
  }, []);

  const missingRecommendedTypes = useMemo(() => {
    if (!recommendedPartTypes.length) return [];
    
    // Collect all types from currently added parts
    const currentTypes = new Set();
    character.parts.forEach(cp => {
      const libPart = libraryParts.find(p => p.uid === cp.partUid);
      if (libPart && Array.isArray(libPart.type)) {
        libPart.type.forEach(t => currentTypes.add(t.toLowerCase()));
      }
    });

    return recommendedPartTypes.filter(rt => !currentTypes.has(rt.toLowerCase()));
  }, [recommendedPartTypes, character.parts, libraryParts]);

  // Persist character to localStorage on every change
  useEffect(() => {
    saveCharacterState(character);
  }, [character]);

  // Fetch character list on mount; also sync libraryCharacter for the active uid.
  useEffect(() => {
    fetchCharacterList()
      .then(list => {
        if (Array.isArray(list)) {
          setCharacterList(list);
          const uid = loadCharacter().uid;
          if (uid) {
            const saved = list.find(c => c.uid === uid);
            if (saved) {
              setLibraryCharacter(saved);
              // Merge server-authoritative fields that may have been written by
              // background generation while the client was away (e.g. voice generation
              // that completed after a page reload).
              setCharacter(prev => {
                const serverFields = {};
                if (saved.portraitUrl) serverFields.portraitUrl = saved.portraitUrl;
                if (saved.audioUrl) serverFields.audioUrl = saved.audioUrl;
                if (saved.introTranscript) serverFields.introTranscript = saved.introTranscript;
                return { ...prev, ...serverFields };
              });
            }
          }
        }
      })
      .catch(err => console.error('[CharacterSection] Failed to fetch character list:', err));
  }, []);

  // ── Character field handlers ─────────────────────────────────────────────

  const handleFieldChange = useCallback((field, value) => {
    setCharacter(prev => ({ ...prev, [field]: value }));
  }, []);

  // ── PreferredOutfits: resolve uid from outfit name on chip select ─────────
  const preferredOutfitNames = useMemo(() => {
    return (character.preferredOutfits || []).map(uid => {
      const match = outfitList.find(o => o.uid === uid);
      return match ? match.name : uid;
    });
  }, [character.preferredOutfits, outfitList]);

  const handlePreferredOutfitsChange = useCallback((names) => {
    const uids = names.map(name => {
      const match = outfitList.find(o => o.name === name);
      return match ? match.uid : name;
    });
    setCharacter(prev => ({ ...prev, preferredOutfits: uids }));
  }, [outfitList]);

  // ── Library autocomplete: add part from library ──────────────────────────
  const handleLibrarySelect = useCallback((match) => {
    if (!match) return;
    // Avoid duplicates
    if (character.parts.some(cp => cp.partUid === match.uid)) {
      toast.info(`Part '${match.name}' is already added`);
      return;
    }
    setCharacter(prev => ({
      ...prev,
      parts: [
        ...prev.parts,
        {
          partUid: match.uid,
          attributeValues: {},
          previewImageUrl: '',
        },
      ],
    }));
  }, [character.parts, toast]);

  const handlePartLoadSelect = useCallback((uid) => {
    const match = libraryParts.find(p => p.uid === uid);
    if (match) handleLibrarySelect(match);
  }, [libraryParts, handleLibrarySelect]);

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
        setCharacter(prev => {
          const parts = [...(prev.parts || [])];
          if (parts[index]?.partUid === updatedPart.partUid) {
            parts[index] = { ...parts[index], previewImageUrl: result.portraitUrl };
          }
          return { ...prev, parts };
        });
      })
      .catch(() => {});
  }, [libraryParts]);

  const handlePartChange = useCallback((index, updatedPart) => {
    const currentPart = character.parts[index];
    const attrChanged = JSON.stringify(currentPart?.attributeValues) !== JSON.stringify(updatedPart.attributeValues);
    setCharacter(prev => {
      const newParts = [...prev.parts];
      newParts[index] = attrChanged ? { ...updatedPart, previewImageUrl: '' } : updatedPart;
      return { ...prev, parts: newParts };
    });
    if (attrChanged) {
      requestPartPreviewCache(index, { ...updatedPart, previewImageUrl: '' });
    }
  }, [character.parts, requestPartPreviewCache]);

  // ── Part preview generation (manual, via header action button) ───────────

  const dismissPreviewByIndex = useCallback((index) => {
    setGeneratingPreviews(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const handlePreviewGenerate = useCallback(async (item, index) => {
    if (generatingPreviews[index]) return;

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
      console.warn('[CharacterSection] No prompt for part preview, index', index);
      return;
    }

    try {
      const response = await fetch('/anytale/generate-part-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      const { taskId } = await response.json();
      setGeneratingPreviews(prev => ({ ...prev, [index]: taskId }));
    } catch (err) {
      console.error('[CharacterSection] Part preview generation failed:', err);
      toast.error(`Preview failed: ${err.message}`);
    }
  }, [generatingPreviews, libraryParts, toast]);

  const partHeaderActions = [
    { icon: 'refresh', title: 'Generate preview', onClick: handlePreviewGenerate },
  ];

  // ── Portrait generation ──────────────────────────────────────────────────

  const handleGeneratePortrait = useCallback(async () => {
    if (isGeneratingPortrait) return;
    const uid = character.uid || 'temp-portrait';
    try {
      const { taskId } = await generateCharacterPortrait(uid, character.parts);
      setPortraitTaskId(taskId);
    } catch (err) {
      console.error('[CharacterSection] Portrait generation failed:', err);
      toast.error(`Portrait generation failed: ${err.message}`);
    }
  }, [character, isGeneratingPortrait, toast]);

  // ── Voice generation ─────────────────────────────────────────────────────

  const handleGenerateVoice = useCallback(async () => {
    if (isGeneratingVoice) return;
    const uid = character.uid || 'temp-voice';
    try {
      const { taskId } = await generateCharacterVoice(uid, character.personality, character.name);
      setVoiceTaskId(taskId);
    } catch (err) {
      console.error('[CharacterSection] Voice generation failed:', err);
      toast.error(`Voice generation failed: ${err.message}`);
    }
  }, [character, isGeneratingVoice, toast]);

  // ── Prompt parts (used by handleGenerate) ───────────────────────────────

  const promptParts = characterPartsToPromptParts(character.parts, libraryParts);

  // ── Character CRUD actions ───────────────────────────────────────────────

  const isInLibrary = !!(character.uid && characterList.some(c => c.uid === character.uid));
  const hasChanges = !isInLibrary || !charactersEqual(character, libraryCharacter);

  const handleSave = useCallback(async () => {
    try {
      let saved;
      if (character.uid) {
        // Update existing entry by its stable UUID
        ({ saved } = await saveCharacter(character.uid, character));
      } else {
        // Create new – server assigns the UUID
        ({ saved } = await createCharacter(character));
      }
      const uid = saved.uid;
      const savedChar = { ...character, uid };
      setCharacter(prev => ({ ...prev, uid }));
      setSavedCharacterUid(uid);
      setLibraryCharacter(savedChar);
      const list = await fetchCharacterList();
      if (Array.isArray(list)) setCharacterList(list);
      toast.success('Character saved');
    } catch (err) {
      console.error('[CharacterSection] Save failed:', err);
      toast.error(`Save failed: ${err.message}`);
    }
  }, [character, toast]);

  const handleDelete = useCallback(async () => {
    if (!character.uid) return;
    const result = await showDialog(
      `Delete character "${character.name || character.uid}"? This cannot be undone.`,
      'Delete Character',
      ['Delete', 'Cancel']
    );
    if (result !== 'Delete') return;
    try {
      await deleteCharacter(character.uid);
      const list = await fetchCharacterList();
      if (Array.isArray(list)) setCharacterList(list);
      toast.success('Character deleted');
      const blank = createBlankCharacter();
      setCharacter(blank);
      setSavedCharacterUid(null);
      setLibraryCharacter(null);
    } catch (err) {
      console.error('[CharacterSection] Delete failed:', err);
      toast.error(`Delete failed: ${err.message}`);
    }
  }, [character, toast]);

  const handleRevert = useCallback(async () => {
    if (!libraryCharacter) return;
    const result = await showDialog('Revert this character to the saved library version? Unsaved changes will be lost.', 'Revert Character', ['Revert', 'Cancel']);
    if (result !== 'Revert') return;
    setCharacter(libraryCharacter);
  }, [libraryCharacter]);

  const handleEditParts = useCallback(() => {
    if (onEditParts) onEditParts(character.parts);
  }, [character.parts, onEditParts]);

  const handleClear = useCallback(async () => {
    const result = await showDialog(
      'Clear all character data? This will reset the form.',
      'Clear Character',
      ['Clear', 'Cancel']
    );
    if (result !== 'Clear') return;
    const blank = createBlankCharacter();
    setCharacter(blank);
    setSavedCharacterUid(null);
    setLibraryCharacter(null);
  }, [])

  // ── Load character from library ──────────────────────────────────────────

  const handleCharacterSelect = useCallback((uid) => {
    if (!uid) return;
    const match = characterList.find(c => c.uid === uid);
    if (!match) return;
    setCharacter(match);
    setSavedCharacterUid(match.uid);
    setLibraryCharacter(match);
  }, [characterList]);

  // ── Import handler (from AnyTaleForm parent) ───────────────────────────
  const handleImport = useCallback(async (imageItem) => {
    // Task: "clear the current character data, replace the character name with the image name, 
    // and populate the character's parts data using the data from the image generation record."
    const blank = createBlankCharacter();
    blank.name = imageItem.name || 'Imported Character';
    
    const newParts = [];
    const skipped = [];

    // Latest library might be needed, but we use the libraryParts prop.
    if (imageItem.parts) {
      for (const [partName, storedData] of Object.entries(imageItem.parts)) {
        const libraryConfig = libraryParts.find(p => p.name === partName);
        if (!libraryConfig) {
          skipped.push(partName);
          continue;
        }

        const attributeValues = {};
        for (const attr of (libraryConfig.attributes || [])) {
          attributeValues[attr.name] = storedData.attributeValues?.[attr.name] ?? '';
        }

        newParts.push({
          partUid: libraryConfig.uid,
          attributeValues,
          previewImageUrl: storedData.previewImageUrl || '',
        });
      }
    }
    
    blank.parts = newParts;
    setCharacter(blank);
    setSavedCharacterUid(null);
    setLibraryCharacter(null);

    if (skipped.length > 0) {
      toast.info(`Imported ${newParts.length} part(s); skipped ${skipped.length} not in library: ${skipped.join(', ')}`);
    } else {
      toast.success(`Imported: loaded ${newParts.length} part(s) and character name from image`);
    }

  }, [libraryParts, toast]);

  useEffect(() => {
    if (onImportHandlerReady) onImportHandlerReady(handleImport);
    return () => { if (onImportHandlerReady) onImportHandlerReady(null); };
  }, [handleImport, onImportHandlerReady]);

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

          <!-- Character details -->
          <${VerticalLayout} gap="small">
            <${HorizontalEdgesLayout}>
              <${H2}>Character</${H2}>
              <${Button} variant="small-text" color="secondary" icon="folder-open" onClick=${() => setLoadCharModalOpen(true)}>Load<//>
            </${HorizontalEdgesLayout}>
            <!-- Portrait preview row -->
            <div style=${{ display: 'flex', gap: currentTheme.value.spacing.medium.gap, alignItems: 'flex-start' }}>
              <${ImagePreview} src=${character.portraitUrl} alt="Character portrait" />
              <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', gap: currentTheme.value.spacing.small.gap }}>
                <label style=${{
                  color: currentTheme.value.colors.text.secondary,
                  fontSize: currentTheme.value.typography.fontSize.medium,
                  fontWeight: currentTheme.value.typography.fontWeight.medium,
                }}>Voice Preview</label>
                <${AudioPlayer} audioUrl=${character.audioUrl} widthScale="full" disabled=${!character.audioUrl} />
                ${character.introTranscript ? html`<div style=${{ fontSize: currentTheme.value.typography.fontSize.small, color: currentTheme.value.colors.text.secondary }}>${character.introTranscript}</div>` : null}
              </div>
            </div>

            <${ButtonRow}>
              <${Button}
                variant="small-text"
                color="primary"
                icon="image"
                onClick=${handleGeneratePortrait}
                disabled=${isGeneratingPortrait || isGeneratingVoice}
              >
                ${isGeneratingPortrait ? 'Generating...' : 'Generate Portrait'}
              <//>
              <${Button}
                variant="small-text"
                color="primary"
                icon="microphone"
                onClick=${handleGenerateVoice}
                disabled=${isGeneratingPortrait || isGeneratingVoice || !character.personality?.trim()}
              >
                ${isGeneratingVoice ? 'Generating...' : 'Generate Voice'}
              <//>
            </${ButtonRow}>

            <${Input}
              label="Name"
              value=${character.name}
              onInput=${(e) => handleFieldChange('name', e.target.value)}
              placeholder="Character name"
              widthScale="full"
            />
            <${Input}
              label="Personality"
              value=${character.personality}
              onInput=${(e) => handleFieldChange('personality', e.target.value)}
              placeholder="Personality description..."
              widthScale="full"
              multiline
              rows=${3}
            />

            <${ChipAutocompleteInput}
              label="Preferred Outfits"
              placeholder="Type to add an outfit..."
              suggestions=${outfitList.map(o => o.name)}
              values=${preferredOutfitNames}
              onValuesChange=${handlePreferredOutfitsChange}
            />

          </${VerticalLayout}>

          <!-- Parts -->
          <${VerticalLayout} gap="small">
            <${HorizontalEdgesLayout}>
              <${H2}>Parts</${H2}>
              <${Button} variant="small-text" color="secondary" icon="folder-open" onClick=${() => setLoadPartModalOpen(true)}>Load<//>
            </${HorizontalEdgesLayout}>

            ${missingRecommendedTypes.length > 0
              && html`<div style=${{ padding: currentTheme.value.spacing.small.padding, fontSize: currentTheme.value.typography.fontSize.small, color: currentTheme.value.colors.text.secondary }}><strong>Recommended Missing Character Parts:</strong> ${missingRecommendedTypes.join(', ')}</div>`
            }

            <${LibraryPartPicker}
              libraryParts=${libraryParts}
              onSelectPart=${handleLibrarySelect}
              onMissingPart=${(name) => toast.info(`No saved part named '${name}' found`)}
            />

            <${DynamicList}
              title="Character Parts"
              items=${character.parts}
              renderItem=${(item, i) => {
                const libConfig = libraryParts.find(p => p.uid === item.partUid);
                return html`
                  <${CharacterPartItem}
                    part=${item}
                    libraryConfig=${libConfig}
                    onPartChange=${(updated) => handlePartChange(i, updated)}
                    isGenerating=${!!generatingPreviews[i]}
                    onPreviewGenerate=${() => handlePreviewGenerate(item, i)}
                  />
                `;
              }}
              getTitle=${(item) => {
                const lib = libraryParts.find(p => p.uid === item.partUid);
                return lib ? lib.name : (item.partUid || '(unknown part)');
              }}
              createItem=${() => ({ partUid: '', attributeValues: {}, previewImageUrl: '' })}
              onChange=${(newParts) => setCharacter(prev => ({ ...prev, parts: newParts }))}
              addLabel="Add Part"
              hideAddItem
            />
          </${VerticalLayout}>

          <!-- Save / Delete / Clear / Revert / Edit Parts actions -->
          <${ButtonRow}>
            <${Button}
              variant="small-text"
              color="primary"
              icon="save"
              onClick=${handleSave}
              disabled=${isInLibrary && !hasChanges}
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
              disabled=${!character.parts.length || !onEditParts}
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
            isOpen=${loadCharModalOpen}
            title="Load Character"
            items=${characterList.map(c => ({ label: c.name || c.uid, value: c.uid }))}
            mode="single"
            onSelect=${handleCharacterSelect}
            onClose=${() => setLoadCharModalOpen(false)}
          />

          <${SearchSelectModal}
            isOpen=${loadPartModalOpen}
            title="Load Part"
            items=${libraryParts.map(p => ({ label: p.name || p.uid, value: p.uid }))}
            mode="single"
            onSelect=${handlePartLoadSelect}
            onClose=${() => setLoadPartModalOpen(false)}
          />

        </${VerticalLayout}>
      </${ContentWrapper}>

    </${VerticalLayout}>
  `;
  const banners = [
    sectionHtml,
    ...Object.entries(generatingPreviews).map(([indexStr, taskId]) => {
      const idx = parseInt(indexStr);
      return html`<${ProgressBanner}
        key=${taskId}
        taskId=${taskId}
        sseManager=${sseManager}
        defaultTitle="Generating preview…"
        onComplete=${(data) => {
          if (data.result?.imageUrl) {
            const url = `${data.result.imageUrl}?t=${Date.now()}`;
            setCharacter(prev => {
              const newParts = [...(prev.parts || [])];
              if (newParts[idx]) {
                newParts[idx] = { ...newParts[idx], previewImageUrl: url };
              }
              return { ...prev, parts: newParts };
            });
          }
          dismissPreviewByIndex(idx);
        }}
        onCancelled=${() => dismissPreviewByIndex(idx)}
        onCancel=${async () => {
          await fetch('/generate/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId }),
          });
        }}
        onError=${() => dismissPreviewByIndex(idx)}
        onDismiss=${() => dismissPreviewByIndex(idx)}
      />`;
    })
  ];

  if (portraitTaskId) {
    banners.push(html`<${ProgressBanner}
      key=${portraitTaskId}
      taskId=${portraitTaskId}
      sseManager=${sseManager}
      defaultTitle="Generating portrait…"
      onComplete=${(data) => {
        if (data.result?.imageUrl) {
          setCharacter(prev => ({ ...prev, portraitUrl: data.result.imageUrl }));
          toast.success('Portrait generated');
        }
        setPortraitTaskId(null);
      }}
      onCancelled=${() => setPortraitTaskId(null)}
      onCancel=${async () => {
        await fetch('/generate/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: portraitTaskId }),
        });
      }}
      onError=${() => setPortraitTaskId(null)}
      onDismiss=${() => setPortraitTaskId(null)}
    />`);
  }

  if (voiceTaskId) {
    banners.push(html`<${ProgressBanner}
      key=${voiceTaskId}
      taskId=${voiceTaskId}
      sseManager=${sseManager}
      defaultTitle="Generating voice…"
      onComplete=${(data) => {
        const updates = {};
        if (data.result?.audioUrl) updates.audioUrl = data.result.audioUrl;
        if (data.result?.summary) updates.introTranscript = data.result.summary;
        if (Object.keys(updates).length > 0) {
          setCharacter(prev => ({ ...prev, ...updates }));
          toast.success('Voice generated');
        }
        setVoiceTaskId(null);
      }}
      onCancelled=${() => setVoiceTaskId(null)}
      onCancel=${async () => {
        await fetch('/generate/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: voiceTaskId }),
        });
      }}
      onError=${() => setVoiceTaskId(null)}
      onDismiss=${() => setVoiceTaskId(null)}
    />`);
  }

  return banners;
}
