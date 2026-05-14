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
import { H2, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { AutocompleteInput } from '../autocomplete-input.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { AudioPlayer } from '../../custom-ui/media/audio-player.mjs';
import { loadCharacter, saveCharacterState, createBlankCharacter } from './anytale-state.mjs';
import { fetchCharacterList, saveCharacter, deleteCharacter, generateCharacterPortrait, generateCharacterVoice } from './character-api.mjs';
import { assemblePartPreviewPrompt } from './prompt-assembler.mjs';
import { CharacterPartItem } from './character-part-item.mjs';
import { ImagePreview } from './image-preview.mjs';
import { ChipAutocompleteInput } from '../chip-autocomplete-input.mjs';
import { fetchOutfitList } from './outfit-api.mjs';

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
          categoryAttributes: lib.categoryAttributes,
          customAttributes: lib.customAttributes,
        },
        data: {
          enabled: true,
          categoryAttributeValues: cp.categoryAttributeValues || {},
          customAttributeValues: cp.customAttributeValues || {},
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
export function CharacterSection({ libraryParts = [], onLibraryPartsChange, onImportHandlerReady, refreshKey = 0, scrollable = true, outfitList: outfitListProp }) {
  const toast = useToast();

  // ── Character state (lazy-loaded from localStorage) ─────────────────────
  const [character, setCharacter] = useState(() => loadCharacter());
  const [savedCharacterUid, setSavedCharacterUid] = useState(() => loadCharacter().uid || null);
  const [characterList, setCharacterList] = useState([]);
  // Tracks the last-saved server copy; used to detect unsaved changes.
  const [libraryCharacter, setLibraryCharacter] = useState(null);

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
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
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
            if (saved) setLibraryCharacter(saved);
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
  const handleLibrarySelect = useCallback((inputValue) => {
    const trimmed = (inputValue || '').trim();
    if (!trimmed) return;
    const match = libraryParts.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (!match) {
      toast.info(`No saved part named '${trimmed}' found`);
      return;
    }
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
          categoryAttributeValues: {},
          customAttributeValues: {},
          previewImageUrl: '',
        },
      ],
    }));
  }, [libraryParts, character.parts, toast]);

  const handlePartChange = useCallback((index, updatedPart) => {
    setCharacter(prev => {
      const newParts = [...prev.parts];
      newParts[index] = updatedPart;
      return { ...prev, parts: newParts };
    });
  }, []);

  // ── Part preview generation (manual, via header action button) ───────────

  const handlePreviewGenerate = useCallback(async (item, index) => {
    if (generatingPreviews[index]) return;

    const libConfig = libraryParts.find(p => p.uid === item.partUid);
    const partForPrompt = {
      config: {
        name: libConfig?.name || item.partUid,
        previewBaseline: libConfig?.previewBaseline || '',
        baseline: libConfig?.baseline || '',
        categoryAttributes: libConfig?.categoryAttributes || [],
        customAttributes: libConfig?.customAttributes || [],
      },
      data: {
        enabled: true,
        categoryAttributeValues: item.categoryAttributeValues || {},
        customAttributeValues: item.customAttributeValues || {},
        previewImageUrl: item.previewImageUrl || '',
      },
    };

    const prompt = assemblePartPreviewPrompt(partForPrompt);
    if (!prompt) {
      console.warn('[CharacterSection] No prompt for part preview, index', index);
      return;
    }

    setGeneratingPreviews(prev => ({ ...prev, [index]: true }));
    try {
      const response = await fetch('/generate/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: 'Text to Image (Illustrious Portrait)',
          name: libConfig?.name || item.partUid || 'preview',
          prompt,
          seed: Math.floor(Math.random() * 4294967295),
          orientation: 'square',
          imageFormat: 'png',
          tags: '',
          description: '',
          summary: '',
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
        handlePartChange(index, { ...item, previewImageUrl: result.imageUrl });
      }
    } catch (err) {
      console.error('[CharacterSection] Part preview generation failed:', err);
      toast.error(`Preview failed: ${err.message}`);
    } finally {
      setGeneratingPreviews(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  }, [generatingPreviews, libraryParts, handlePartChange, toast]);

  const partHeaderActions = [
    { icon: 'refresh', title: 'Generate preview', onClick: handlePreviewGenerate },
  ];

  // ── Portrait generation ──────────────────────────────────────────────────

  const handleGeneratePortrait = useCallback(async () => {
    if (isGeneratingPortrait) return;
    // Ensure a uid for the request (use a temp uid if empty)
    const uid = character.uid || 'temp-portrait';
    setIsGeneratingPortrait(true);
    try {
      const { portraitUrl } = await generateCharacterPortrait(uid, character.parts);
      if (portraitUrl) {
        setCharacter(prev => ({ ...prev, portraitUrl }));
        toast.success('Portrait generated');
      }
    } catch (err) {
      console.error('[CharacterSection] Portrait generation failed:', err);
      toast.error(`Portrait generation failed: ${err.message}`);
    } finally {
      setIsGeneratingPortrait(false);
    }
  }, [character, isGeneratingPortrait, toast]);

  // ── Voice generation ─────────────────────────────────────────────────────

  const handleGenerateVoice = useCallback(async () => {
    if (isGeneratingVoice) return;
    const uid = character.uid || 'temp-voice';
    setIsGeneratingVoice(true);
    try {
      const { audioUrl, transcript } = await generateCharacterVoice(uid, character.personality, character.name);
      const updates = {};
      if (audioUrl) updates.audioUrl = audioUrl;
      if (transcript) updates.introTranscript = transcript;
      if (Object.keys(updates).length > 0) {
        setCharacter(prev => ({ ...prev, ...updates }));
        toast.success('Voice generated');
      }
    } catch (err) {
      console.error('[CharacterSection] Voice generation failed:', err);
      toast.error(`Voice generation failed: ${err.message}`);
    } finally {
      setIsGeneratingVoice(false);
    }
  }, [character, isGeneratingVoice, toast]);

  // ── Prompt parts (used by handleGenerate) ───────────────────────────────

  const promptParts = characterPartsToPromptParts(character.parts, libraryParts);

  // ── Character CRUD actions ───────────────────────────────────────────────

  const isInLibrary = !!(character.uid && characterList.some(c => c.uid === character.uid));
  const hasChanges = !isInLibrary || !charactersEqual(character, libraryCharacter);

  const handleSave = useCallback(async () => {
    let uid = character.uid;
    if (!uid) {
      // Auto-generate uid from name
      uid = (character.name || 'character')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
        `character-${Date.now()}`;
    }
    try {
      const { saved } = await saveCharacter(uid, { ...character, uid });
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
  }, []);

  // ── Load character from library ──────────────────────────────────────────

  const handleCharacterSelect = useCallback((inputValue) => {
    const trimmed = (inputValue || '').trim();
    if (!trimmed) return;
    const match = characterList.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (!match) {
      toast.info(`No saved character named '${trimmed}' found`);
      return;
    }
    setCharacter(match);
    setSavedCharacterUid(match.uid);
    setLibraryCharacter(match);
  }, [characterList, toast]);

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

        const categoryAttributeValues = {};
        for (const attr of (libraryConfig.categoryAttributes || [])) {
          categoryAttributeValues[attr.name] = storedData.categoryAttributeValues?.[attr.name] ?? '';
        }
        const customAttributeValues = {};
        for (const attr of (libraryConfig.customAttributes || [])) {
          customAttributeValues[attr.name] = storedData.customAttributeValues?.[attr.name] ?? '';
        }

        newParts.push({
          partUid: libraryConfig.uid,
          categoryAttributeValues,
          customAttributeValues,
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

  return html`
    <${VerticalLayout} gap="medium" style=${outerStyle}>

      <${ContentWrapper}>
        <${VerticalLayout} gap="large">

          <!-- Load character from library -->
          <${AutocompleteInput}
            label="Load Character"
            placeholder="Type to search saved characters..."
            suggestions=${characterList.map(c => c.name)}
            onSelect=${handleCharacterSelect}
          />

          <!-- Character details -->
          <${VerticalLayout} gap="small">
            <${H2}>Character</${H2}>
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

            <${ButtonRow}>
              <${Button}
                variant="medium-text"
                color="primary"
                icon="image"
                onClick=${handleGeneratePortrait}
                disabled=${isGeneratingPortrait || isGeneratingVoice}
              >
                ${isGeneratingPortrait ? 'Generating...' : 'Generate Portrait'}
              <//>
              <${Button}
                variant="medium-text"
                color="secondary"
                icon="microphone"
                onClick=${handleGenerateVoice}
                disabled=${isGeneratingPortrait || isGeneratingVoice}
              >
                ${isGeneratingVoice ? 'Generating...' : 'Generate Voice'}
              <//>
            </${ButtonRow}>
          </${VerticalLayout}>

          <!-- Parts -->
          <${VerticalLayout} gap="small">
            <${H2}>Parts</${H2}>

            ${missingRecommendedTypes.length > 0
              && html`<div style=${{ padding: currentTheme.value.spacing.small.padding, fontSize: currentTheme.value.typography.fontSize.small, color: currentTheme.value.colors.text.secondary }}><strong>Recommended Missing Character Parts:</strong> ${missingRecommendedTypes.join(', ')}</div>`
            }

            <${AutocompleteInput}
              label="Add Part from Library"
              placeholder="Type to search saved parts..."
              suggestions=${libraryParts.map(p => p.name)}
              onSelect=${handleLibrarySelect}
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
                  />
                `;
              }}
              getTitle=${(item) => {
                const lib = libraryParts.find(p => p.uid === item.partUid);
                return lib ? lib.name : (item.partUid || '(unknown part)');
              }}
              createItem=${() => ({ partUid: '', categoryAttributeValues: {}, customAttributeValues: {}, previewImageUrl: '' })}
              onChange=${(newParts) => setCharacter(prev => ({ ...prev, parts: newParts }))}
              addLabel="Add Part"
              hideAddItem
              headerActions=${partHeaderActions}
            />
          </${VerticalLayout}>

          <!-- Save / Delete / Clear actions -->
          <${ButtonRow}>
            <${Button}
              variant="medium-text"
              color="primary"
              icon="save"
              onClick=${handleSave}
              disabled=${isInLibrary && !hasChanges}
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
