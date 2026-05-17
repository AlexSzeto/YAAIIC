/**
 * anytale-form.mjs – Right-column form for the AnyTale page.
 *
 * Contains two tabs:
 *   Parts & Plot:          Parts DynamicList, Plot Section, Generation section (merged char+outfit parts).
 *   Character & Outfits:   CharacterSection + OutfitSection stacked vertically, each with its own scroll area.
 *
 * Persists state to localStorage via anytale-state.mjs.
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { useToast } from '../../custom-ui/msg/toast.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { TabPanels } from '../../custom-ui/nav/tab-panels.mjs';
import { PartItem } from './part-item.mjs';
import { loadState, saveState, clearState, createDefaultPart, loadPlot, loadCharacter, loadOutfit, saveCharacterState, saveOutfitState } from './anytale-state.mjs';
import { extractImagePrompt, parsePromptTags, processPromptImport, extractRemainingPageTags } from './prompt-import.mjs';
import { assemblePrompt, assemblePartPreviewPrompt } from './prompt-assembler.mjs';
import { resolveSlotStatuses, parseRules, applyRules } from './slot-resolver.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';
import { AutocompleteInput } from '../autocomplete-input.mjs';
import { H2, VerticalLayout, HorizontalEdgesLayout } from '../../custom-ui/themed-base.mjs';
import { PlotSection } from './plot-section.mjs';
import { CharacterSection } from './character-section.mjs';
import { OutfitSection } from './outfit-section.mjs';
import { fetchPlotList } from './plot-api.mjs';
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
ButtonRow.className = 'button-row';

const EditLayout = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
  gap: ${() => currentTheme.value.spacing.large.gap};
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

const PickerRow = styled('div')`
  display: flex;
  gap: 8px;
  align-items: flex-end;
  width: 100%;
`;
PickerRow.className = 'anytale-picker-row';

const PickerInputFlex = styled('div')`
  flex: 1;
  min-width: 0;
`;
PickerInputFlex.className = 'anytale-picker-input-flex';

const SearchButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 44px;
`;
SearchButtonWrapper.className = 'autocomplete-input-button-wrapper';

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

// ============================================================================
// Component
// ============================================================================

/**
 * @param {Object}   props
 * @param {Function} props.onGenerate    – Called with (prompt, name, partsData, plotData) when Generate is clicked
 * @param {boolean}  props.isGenerating  – True while a generation is in-flight
 * @param {Function} [props.onImportReady] – Called with import handlers when they change; null on unmount
 */
export function AnyTaleForm({ onGenerate, isGenerating, onImportReady, currentItem = null }) {
  const toast = useToast();
  const [previewImageName, setPreviewImageName] = useState(() => loadState().name);
  const [parts, setParts] = useState(() => loadState().parts);
  const [isImporting, setIsImporting] = useState(false);
  const [activePlotPage, setActivePlotPage] = useState(() => loadState().activePlotPage);
  const [pageLocked, setPageLocked] = useState([]);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('anytale-active-tab') || 'parts-plot');
  const [previewPlotModalOpen, setPreviewPlotModalOpen] = useState(false);
  const [loadPartModalOpen, setLoadPartModalOpen] = useState(false);
  // Live plot state mirrored from PlotSection for immediate prompt preview updates
  const [livePlot, setLivePlot] = useState(() => loadPlot());

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    localStorage.setItem('anytale-active-tab', tab);
  }, []);

  // Incremented when import writes character/outfit state to localStorage so child
  // sections can pick up the new data.
  const [importRefreshKey, setImportRefreshKey] = useState(0);
  const [plotRefreshKey, setPlotRefreshKey] = useState(0);

  // Plot import handler ref (kept for plot section delegation)
  const plotImportFnRef = useRef(null);
  const plotPageTagsFnRef = useRef(null);
  const handlePlotImportReady = useCallback((fn) => { plotImportFnRef.current = fn; }, []);
  const handlePlotPageTagsReady = useCallback((fn) => { plotPageTagsFnRef.current = fn; }, []);

  // ── Config for import routing ────────────────────────────────────────────
  const [recommendedCharacterPartTypes, setRecommendedCharacterPartTypes] = useState([]);
  const [recommendedOutfitPartTypes, setRecommendedOutfitPartTypes] = useState([]);
  const [previewBasePromptByType, setPreviewBasePromptByType] = useState({});
  const [parsedRules, setParsedRules] = useState([]);

  useEffect(() => {
    fetch('/anytale/config')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.recommendedCharacterPartTypes)) setRecommendedCharacterPartTypes(data.recommendedCharacterPartTypes);
        if (Array.isArray(data.recommendedOutfitPartTypes)) setRecommendedOutfitPartTypes(data.recommendedOutfitPartTypes);
        if (data.previewBasePromptByType && typeof data.previewBasePromptByType === 'object') setPreviewBasePromptByType(data.previewBasePromptByType);
        setParsedRules(parseRules(typeof data.slotRules === 'string' ? data.slotRules : ''));
      })
      .catch(err => console.error('[AnyTaleForm] Failed to fetch config:', err));
  }, []);
  // �"��"� Plot list for Character & Outfits tab generate section �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�
  const [charTabPlotList, setCharTabPlotList] = useState([]);
  const [charTabPlotName, setCharTabPlotName] = useState('');
  const [charTabPlotUid, setCharTabPlotUid] = useState('');

  useEffect(() => {
    fetchPlotList()
      .then(list => { if (Array.isArray(list)) setCharTabPlotList(list); })
      .catch(err => console.error('[AnyTaleForm] Failed to fetch plot list:', err));
  }, []);

  const handleCharTabPlotSelect = useCallback((inputValue) => {
    const trimmed = (inputValue || '').trim();
    if (!trimmed) { setCharTabPlotName(''); setCharTabPlotUid(''); return; }
    const match = charTabPlotList.find(p =>
      p.uid === trimmed || p.name?.toLowerCase() === trimmed.toLowerCase()
    );
    if (match) { setCharTabPlotName(match.name); setCharTabPlotUid(match.uid); }
    else { setCharTabPlotName(trimmed); setCharTabPlotUid(''); }
  }, [charTabPlotList]);

  // ── Shared outfit list (keeps CharacterSection in sync after OutfitSection saves) ─
  const [sharedOutfitList, setSharedOutfitList] = useState([]);

  useEffect(() => {
    fetchOutfitList()
      .then(list => { if (Array.isArray(list)) setSharedOutfitList(list); })
      .catch(err => console.error('[AnyTaleForm] Failed to fetch outfit list:', err));
  }, []);

  // ── Library lookup state ─────────────────────────────────────────────────
  const [libraryParts, setLibraryParts] = useState([]);

  useEffect(() => {
    fetch('/anytale/parts')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLibraryParts(data); })
      .catch(err => console.error('[AnyTaleForm] Failed to fetch library parts:', err));
  }, []);

  const refreshLibraryParts = useCallback(() => {
    fetch('/anytale/parts')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLibraryParts(data); })
      .catch(err => console.error('[AnyTaleForm] Failed to refresh library parts:', err));
  }, []);

  // Persist on every change
  useEffect(() => {
    saveState({ name: previewImageName, activePlotPage, parts });
  }, [previewImageName, activePlotPage, parts]);

  // ── Library lookup: add part from library ────────────────────────────────
  const handleLibrarySelect = useCallback((match) => {
    if (!match) return;
    const newPart = createDefaultPart();
    newPart.config = { ...newPart.config, ...match };
    setParts(prev => [...prev, newPart]);
  }, []);

  const handlePartLoadSelect = useCallback((uid) => {
    const match = libraryParts.find(p => p.uid === uid);
    if (match) handleLibrarySelect(match);
  }, [libraryParts, handleLibrarySelect]);

  const handleClear = useCallback(async () => {
    const result = await showDialog('This will erase all parts and the preview image name. Are you sure?', 'Clear Settings', ['Clear', 'Cancel']);
    if (result !== 'Clear') return;
    setPreviewImageName('');
    setParts([]);
    clearState();
  }, []);

  // ── Slot visibility helper ────────────────────────────────────────────────
  const computeSlotVisibility = useCallback((activeParts, plotPages, pageIndex) => {
    return applyRules(resolveSlotStatuses(activeParts, plotPages, pageIndex), parsedRules);
  }, [parsedRules]);

  // ── Generate: uses local parts state and plot from localStorage ────────────
  const handleGenerate = useCallback(() => {
    setPageLocked(prev => {
      const next = [...prev];
      next[activePlotPage] = true;
      return next;
    });

    const currentPlot = loadPlot();

    const plotPageCount = currentPlot.pages.length;
    const activePage = plotPageCount > 0 ? currentPlot.pages[Math.min(activePlotPage, plotPageCount - 1)] : undefined;
    const enabledParts = parts.filter(p => p.data?.enabled !== false);
    const slotVisibility = computeSlotVisibility(enabledParts, currentPlot.pages, activePlotPage);
    const prompt = assemblePrompt(parts, activePage, slotVisibility);

    const partsData = {};
    for (const p of parts) {
      if (p.config?.name?.trim()) {
        partsData[p.config.name] = {
          attributeValues: p.data.attributeValues,
          previewImageUrl: p.data.previewImageUrl,
        };
      }
    }

    const plotData = (currentPlot.uid || currentPlot.name)
      ? { uid: currentPlot.uid, name: currentPlot.name, page: activePlotPage }
      : null;

    onGenerate(prompt, previewImageName, partsData, plotData);
  }, [parts, previewImageName, onGenerate, activePlotPage, computeSlotVisibility]);

  // �"��"� Generate from Character & Outfits tab: uses charTabPlotUid (page 0) �"��"�
  const handleCharTabGenerate = useCallback(async () => {
    const currentCharacter = loadCharacter();
    const currentOutfit = loadOutfit();

    const mergedMap = {};
    for (const p of (currentCharacter.parts || [])) mergedMap[p.partUid] = p;
    for (const p of (currentOutfit.parts || [])) mergedMap[p.partUid] = p;
    const mergedParts = Object.values(mergedMap);

    const promptParts = mergedParts.map(cp => {
      const lib = libraryParts.find(p => p.uid === cp.partUid);
      if (!lib) return null;
      return {
        config: {
          name: lib.name, type: lib.type,
          baseline: lib.baseline, previewBaseline: lib.previewBaseline,
          attributes: lib.attributes,
        },
        data: {
          attributeValues: cp.attributeValues,
          previewImageUrl: cp.previewImageUrl || '',
        },
      };
    }).filter(Boolean);

    let activePage;
    let plotPages = [];
    if (charTabPlotUid) {
      try {
        const res = await fetch(`/anytale/plot/${encodeURIComponent(charTabPlotUid)}`);
        if (res.ok) {
          const plotBlock = await res.json();
          plotPages = Array.isArray(plotBlock.pages) ? plotBlock.pages : [];
          activePage = plotPages.length > 0 ? plotPages[0] : undefined;
        }
      } catch (err) {
        console.error('[AnyTaleForm] Failed to fetch plot for generation:', err);
      }
    }

    const slotVisibility = computeSlotVisibility(promptParts, plotPages, 0);
    const prompt = assemblePrompt(promptParts, activePage, slotVisibility);

    const partsData = {};
    for (const p of promptParts) {
      if (p.config.name?.trim()) {
        partsData[p.config.name] = {
          attributeValues: p.data.attributeValues,
          previewImageUrl: p.data.previewImageUrl,
        };
      }
    }

    const plotData = charTabPlotUid ? { uid: charTabPlotUid, name: charTabPlotName, page: 0 } : null;
    onGenerate(prompt, previewImageName, partsData, plotData);
  }, [libraryParts, previewImageName, onGenerate, charTabPlotUid, charTabPlotName, computeSlotVisibility]);

  // Update a single part by index
  const handlePartChange = useCallback((index, updatedPart) => {
    setParts(prev => {
      const next = [...prev];
      next[index] = updatedPart;
      return next;
    });
  }, []);

  // Preview generation – { [index]: taskId } while a preview is in-flight
  const [generatingPreviews, setGeneratingPreviews] = useState({});

  // Derived: true if any part preview generation is in-flight
  const isAnyPreviewGenerating = Object.keys(generatingPreviews).length > 0;

  const dismissPreviewByIndex = useCallback((index) => {
    setGeneratingPreviews(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const handlePreviewGenerate = useCallback(async (item, index) => {
    if (generatingPreviews[index]) return;
    try {
      const prompt = assemblePartPreviewPrompt(item);
      if (!prompt) {
        console.warn('[AnyTaleForm] No tags to generate preview for part', index);
        return;
      }

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
      console.error('[AnyTaleForm] Preview generation failed:', err);
    }
  }, [generatingPreviews]);

  // Header actions for DynamicList items
  const headerActions = [
    { icon: 'refresh', title: 'Generate preview', onClick: handlePreviewGenerate },
  ];

  const fetchImportConfigs = useCallback(async () => {
    let latestLibrary = libraryParts;
    let charTypes = recommendedCharacterPartTypes;
    let outfitTypes = recommendedOutfitPartTypes;

    try {
      const [libRes, configRes] = await Promise.all([fetch('/anytale/parts'), fetch('/anytale/config')]);
      if (libRes.ok) {
        const data = await libRes.json();
        if (Array.isArray(data)) {
          latestLibrary = data;
          setLibraryParts(data);
        }
      }
      if (configRes.ok) {
        const cfg = await configRes.json();
        if (Array.isArray(cfg.recommendedCharacterPartTypes)) charTypes = cfg.recommendedCharacterPartTypes;
        if (Array.isArray(cfg.recommendedOutfitPartTypes)) outfitTypes = cfg.recommendedOutfitPartTypes;
      }
    } catch (err) {
      console.error('[AnyTaleForm] Import: failed to fetch configs:', err);
    }

    return { latestLibrary, charTypes, outfitTypes };
  }, [libraryParts, recommendedCharacterPartTypes, recommendedOutfitPartTypes]);

  const preparePromptImport = useCallback(() => {
    const rawPrompt = extractImagePrompt(currentItem);
    if (!rawPrompt) {
      toast.info('No prompt found on the current image');
      return null;
    }

    const tags = parsePromptTags(rawPrompt);
    if (tags.length === 0) {
      toast.info('The image prompt has no tags to import');
      return null;
    }

    return { tags };
  }, [currentItem, toast]);

  const handleImportPartsPlot = useCallback(async () => {
    const prepared = preparePromptImport();
    if (!prepared) return;

    const result = await showDialog(
      'Importing will clear and overwrite your current parts list. Plot data will be kept. Are you sure?',
      'Confirm Import Parts',
      ['Import', 'Cancel']
    );
    if (result !== 'Import') return;

    setIsImporting(true);
    try {
      const { latestLibrary, charTypes, outfitTypes } = await fetchImportConfigs();
      const { parts: importedParts, skipped } = processPromptImport({
        tags: prepared.tags,
        libraryParts: latestLibrary,
        recommendedCharacterPartTypes: charTypes,
        recommendedOutfitPartTypes: outfitTypes,
        mode: 'parts-plot',
        createDefaultPart,
      });

      if (importedParts.length === 0) {
        toast.error('No tags in the image prompt matched the parts library');
        return;
      }

      setParts(importedParts);

      if (skipped.length > 0) {
        toast.info(`Imported ${importedParts.length} part(s); ${skipped.length} tag(s) had no match: ${skipped.join(', ')}`);
      } else {
        toast.success(`Imported ${importedParts.length} part(s) from prompt tags`);
      }
    } finally {
      setIsImporting(false);
    }
  }, [preparePromptImport, fetchImportConfigs, toast]);

  const handleImportCharacter = useCallback(async () => {
    const prepared = preparePromptImport();
    if (!prepared) return;

    const result = await showDialog(
      'Importing will replace the current character parts list. Other character fields will be kept. Are you sure?',
      'Confirm Import Character',
      ['Import', 'Cancel']
    );
    if (result !== 'Import') return;

    setIsImporting(true);
    try {
      const { latestLibrary, charTypes, outfitTypes } = await fetchImportConfigs();
      const { characterParts, skipped } = processPromptImport({
        tags: prepared.tags,
        libraryParts: latestLibrary,
        recommendedCharacterPartTypes: charTypes,
        recommendedOutfitPartTypes: outfitTypes,
        mode: 'character-only',
        createDefaultPart,
      });

      if (characterParts.length === 0) {
        toast.error('No tags in the image prompt matched character parts in the library');
        return;
      }

      const character = loadCharacter();
      character.parts = characterParts;
      saveCharacterState(character);
      setImportRefreshKey(k => k + 1);

      if (skipped.length > 0) {
        toast.info(`Imported ${characterParts.length} character part(s); ${skipped.length} tag(s) had no match: ${skipped.join(', ')}`);
      } else {
        toast.success(`Imported ${characterParts.length} character part(s) from prompt tags`);
      }
    } finally {
      setIsImporting(false);
    }
  }, [preparePromptImport, fetchImportConfigs, toast]);

  const handleImportOutfit = useCallback(async () => {
    const prepared = preparePromptImport();
    if (!prepared) return;

    const result = await showDialog(
      'Importing will replace the current outfit parts list. Other outfit fields will be kept. Are you sure?',
      'Confirm Import Outfit',
      ['Import', 'Cancel']
    );
    if (result !== 'Import') return;

    setIsImporting(true);
    try {
      const { latestLibrary, charTypes, outfitTypes } = await fetchImportConfigs();
      const { outfitParts, skipped } = processPromptImport({
        tags: prepared.tags,
        libraryParts: latestLibrary,
        recommendedCharacterPartTypes: charTypes,
        recommendedOutfitPartTypes: outfitTypes,
        mode: 'outfit-only',
        createDefaultPart,
      });

      if (outfitParts.length === 0) {
        toast.error('No tags in the image prompt matched outfit parts in the library');
        return;
      }

      const outfit = loadOutfit();
      outfit.parts = outfitParts;
      saveOutfitState(outfit);
      setImportRefreshKey(k => k + 1);

      if (skipped.length > 0) {
        toast.info(`Imported ${outfitParts.length} outfit part(s); ${skipped.length} tag(s) had no match: ${skipped.join(', ')}`);
      } else {
        toast.success(`Imported ${outfitParts.length} outfit part(s) from prompt tags`);
      }
    } finally {
      setIsImporting(false);
    }
  }, [preparePromptImport, fetchImportConfigs, toast]);

  const handleImportPlot = useCallback(async () => {
    const prepared = preparePromptImport();
    if (!prepared) return;

    if (pageLocked[activePlotPage] === true) {
      toast.info('The current plot page is locked — unlock it before importing page tags');
      return;
    }

    const result = await showDialog(
      'Importing will replace the current page tags with prompt tags that do not match any library part. Other plot and page fields will be kept. Are you sure?',
      'Confirm Import Plot',
      ['Import', 'Cancel']
    );
    if (result !== 'Import') return;

    if (!plotPageTagsFnRef.current) {
      toast.error('Plot editor is not ready');
      return;
    }

    setIsImporting(true);
    try {
      const { latestLibrary } = await fetchImportConfigs();
      const { pageTags, removedCount, remainingCount } = extractRemainingPageTags(
        prepared.tags,
        latestLibrary
      );

      plotPageTagsFnRef.current(activePlotPage, pageTags);

      if (removedCount === 0) {
        toast.success(`Updated page tags with ${remainingCount} tag(s) from the prompt`);
      } else {
        toast.success(
          `Updated page tags: ${remainingCount} kept, ${removedCount} part-matched tag(s) removed`
        );
      }
    } finally {
      setIsImporting(false);
    }
  }, [preparePromptImport, fetchImportConfigs, activePlotPage, pageLocked, toast]);

  const canImport = !!extractImagePrompt(currentItem) && !isGenerating && !isImporting;
  useEffect(() => {
    if (!onImportReady) return;
    onImportReady({
      activeTab,
      canImport,
      importPartsPlot: handleImportPartsPlot,
      importPlot: handleImportPlot,
      importCharacter: handleImportCharacter,
      importOutfit: handleImportOutfit,
    });
    return () => { onImportReady(null); };
  }, [
    activeTab,
    canImport,
    handleImportPartsPlot,
    handleImportPlot,
    handleImportCharacter,
    handleImportOutfit,
    onImportReady,
  ]);

  // ── Edit Parts: push character/outfit part attribute values into the parts list ──
  const handleEditParts = useCallback((sourceParts) => {
    setParts(prev => {
      const next = [...prev];
      for (const sp of sourceParts) {
        const libConfig = libraryParts.find(p => p.uid === sp.partUid);
        if (!libConfig) continue;
        const existingIdx = next.findIndex(p => p.config?.uid === sp.partUid);
        if (existingIdx >= 0) {
          next[existingIdx] = {
            ...next[existingIdx],
            data: { ...next[existingIdx].data, attributeValues: { ...sp.attributeValues } },
          };
        } else {
          const newPart = createDefaultPart();
          newPart.config = { ...libConfig };
          newPart.data = { ...newPart.data, attributeValues: { ...sp.attributeValues } };
          next.push(newPart);
        }
      }
      return next;
    });
    handleTabChange('parts-plot');
  }, [libraryParts, handleTabChange]);

  // Compute all unique type strings from the library for autocomplete suggestions
  const allTypes = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of libraryParts) {
      const types = Array.isArray(p.type) ? p.type : [];
      for (const t of types) {
        if (t && t.trim() && !seen.has(t.toLowerCase())) {
          seen.add(t.toLowerCase());
          out.push(t.trim());
        }
      }
    }
    return out;
  }, [libraryParts]);

  // Preview prompt for the Parts & Plot tab: assembled directly from parts state and live plot
  const previewPrompt = useMemo(() => {
    const plotPageCount = livePlot.pages.length;
    const activePage = plotPageCount > 0 ? livePlot.pages[Math.min(activePlotPage, plotPageCount - 1)] : undefined;
    const enabledParts = parts.filter(p => p.data?.enabled !== false);
    const slotVisibility = computeSlotVisibility(enabledParts, livePlot.pages, activePlotPage);
    return assemblePrompt(parts, activePage, slotVisibility);
  }, [parts, livePlot, activePlotPage, computeSlotVisibility]);

  // ── Tab content ─────────────────────────────────────────────────────────
  const editContent = html`
    <${EditLayout}>
      <${PartsScrollArea}>
        <${VerticalLayout} gap="medium">
          <${VerticalLayout} gap="small">
            <${HorizontalEdgesLayout}>
              <${H2}>Parts</${H2}>
              <${Button} variant="small-text" color="secondary" icon="folder-open" onClick=${() => setLoadPartModalOpen(true)}>Load<//>
            </${HorizontalEdgesLayout}>
            <${LibraryPartPicker}
              libraryParts=${libraryParts}
              onSelectPart=${handleLibrarySelect}
              onMissingPart=${(name) => toast.info(`No saved part named '${name}' found`)}
            />
          </${VerticalLayout}>

          <${DynamicList}
            title="Parts List"
            items=${parts}
            renderItem=${(item, i) => html`
              <${PartItem}
                part=${item}
                onChange=${(updated) => handlePartChange(i, updated)}
                allTypes=${allTypes}
                libraryPart=${libraryParts.find(p =>
                  (item.config?.uid && p.uid === item.config.uid) ||
                  (item.config?.name && p.name === item.config.name)
                )}
                onLibraryChanged=${refreshLibraryParts}
                onDeletedFromLibrary=${() => setParts(prev => prev.filter((_, j) => j !== i))}
                previewBasePromptByType=${previewBasePromptByType}
                onPreviewGenerate=${() => handlePreviewGenerate(item, i)}
                isGeneratingPreview=${!!generatingPreviews[i]}
              />
            `}
            getTitle=${(item) => {
              const base = item.config?.name || '(unnamed)';
              const lib = libraryParts.find(p =>
                (item.config?.uid && p.uid === item.config.uid) ||
                (item.config?.name && p.name === item.config.name)
              );
              if (!lib) return `${base} *`;
              const configFields = {
                name: item.config.name, type: item.config.type,
                baseline: item.config.baseline, previewBaseline: item.config.previewBaseline,
                attributes: item.config.attributes,
              };
              const libFields = {
                name: lib.name, type: lib.type,
                baseline: lib.baseline, previewBaseline: lib.previewBaseline,
                attributes: lib.attributes,
              };
              const isModified = JSON.stringify(configFields) !== JSON.stringify(libFields);
              return isModified ? `${base} *` : base;
            }}
            getEnabled=${(item) => item.data?.enabled ?? true}
            onToggleEnabled=${(item, i) => handlePartChange(i, { ...item, data: { ...item.data, enabled: !(item.data?.enabled ?? true) } })}
            createItem=${createDefaultPart}
            onChange=${setParts}
            addLabel="Add Part"
            deleteIcon="x"
            deleteLabel="Remove"
          />

          <${ButtonRow}>
            <${Button}
              variant="small-text"
              color="danger"
              icon="x"
              onClick=${handleClear}
            >
              Clear Parts
            <//>
          </${ButtonRow}>

          <${PlotSection}
            parts=${parts}
            activePage=${activePlotPage}
            onPageChange=${setActivePlotPage}
            pageLocked=${pageLocked}
            onPageLockedChange=${setPageLocked}
            onPlotReset=${() => setPageLocked([])}
            onImportHandlerReady=${handlePlotImportReady}
            onPageTagsUpdateReady=${handlePlotPageTagsReady}
            onPlotChange=${setLivePlot}
            refreshKey=${plotRefreshKey}
          />
        </${VerticalLayout}>
      </${PartsScrollArea}>

      <!-- Generation section: prompt preview + merged generate button -->
      <${VerticalLayout} gap="medium">
        <${H2}>Generation</${H2}>
        <${Input}
          label="Preview Image Name"
          value=${previewImageName}
          onInput=${(e) => setPreviewImageName(e.target.value)}
          placeholder="Name for generated preview images"
          widthScale="full"
        />
        ${previewPrompt ? html`
          <${PromptPreview}>
            <strong>Prompt preview:</strong> ${previewPrompt}
          </${PromptPreview}>
        ` : html`<div style=${{ fontSize: currentTheme.value.typography.fontSize.small, color: currentTheme.value.colors.text.secondary }}>No character or outfit parts yet.</div>`}
      </${VerticalLayout}>

      <${ButtonRow}>
        <${Button}
          variant="large-text"
          color="primary"
          icon="play"
          onClick=${handleGenerate}
          disabled=${isGenerating || isAnyPreviewGenerating}
        >
          ${isGenerating ? 'Generating...' : 'Generate'}
        <//>
      </${ButtonRow}>

      <${SearchSelectModal}
        isOpen=${loadPartModalOpen}
        title="Load Part"
        items=${libraryParts.map(p => ({ label: p.name || p.uid, value: p.uid }))}
        mode="single"
        onSelect=${handlePartLoadSelect}
        onClose=${() => setLoadPartModalOpen(false)}
      />
    </${EditLayout}>
  `;

  const tabs = [
    {
      id: 'parts-plot',
      label: 'Parts & Plot',
      content: editContent,
    },
    {
      id: 'character-outfits',
      label: 'Character & Outfits',
      content: html`
        <div style=${{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', overflow: 'hidden', gap: currentTheme.value.spacing.medium.gap }}>
          <div style=${{ flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: currentTheme.value.spacing.large.gap, paddingRight: currentTheme.value.spacing.small.padding }}>
            <${CharacterSection}
              libraryParts=${libraryParts}
              onLibraryPartsChange=${refreshLibraryParts}
              refreshKey=${importRefreshKey}
              outfitList=${sharedOutfitList}
              scrollable=${false}
              onEditParts=${handleEditParts}
            />
            <${OutfitSection}
              libraryParts=${libraryParts}
              onLibraryPartsChange=${refreshLibraryParts}
              refreshKey=${importRefreshKey}
              onOutfitListChange=${setSharedOutfitList}
              scrollable=${false}
              onEditParts=${handleEditParts}
            />
          </div>
          <!-- Sticky Generate section -->
          <div style=${{ flex: 'none', display: 'flex', flexDirection: 'column', gap: currentTheme.value.spacing.small.gap, paddingTop: currentTheme.value.spacing.small.padding }}>
            <${H2}>Generation</${H2}>
            <${Input}
              label="Preview Image Name"
              value=${previewImageName}
              onInput=${(e) => setPreviewImageName(e.target.value)}
              placeholder="Name for generated preview images"
              widthScale="full"
            />
            <${PickerRow}>
              <${PickerInputFlex}>
                <${AutocompleteInput}
                  label="Preview Plot"
                  placeholder="Type to search saved plots..."
                  suggestions=${charTabPlotList.map(p => p.name)}
                  onSelect=${handleCharTabPlotSelect}
                />
              </${PickerInputFlex}>
              <${SearchButtonWrapper}>
                <${Button}
                  variant="medium-icon"
                  icon="search"
                  title="Browse saved plots"
                  disabled=${charTabPlotList.length === 0}
                  onClick=${() => setPreviewPlotModalOpen(true)}
                />
              </${SearchButtonWrapper}>
            </${PickerRow}>
            ${charTabPlotName ? html`<div style=${{ fontSize: currentTheme.value.typography.fontSize.small, color: currentTheme.value.colors.text.secondary }}><strong>Plot:</strong> ${charTabPlotName}</div>` : null}
            <${ButtonRow}>
              <${Button}
                variant="large-text"
                color="primary"
                icon="play"
                onClick=${handleCharTabGenerate}
                disabled=${isGenerating}
              >
                ${isGenerating ? 'Generating...' : 'Generate'}
              <//>
            </${ButtonRow}>
            <${SearchSelectModal}
              isOpen=${previewPlotModalOpen}
              title="Preview Plot"
              items=${charTabPlotList.map(plot => ({ label: plot.name || plot.uid, value: plot.uid }))}
              mode="single"
              onSelect=${handleCharTabPlotSelect}
              onClose=${() => setPreviewPlotModalOpen(false)}
            />
          </div>
        </div>
      `,
    },
  ];

  return [
    html`<${TabPanels}
      tabs=${tabs}
      activeTab=${activeTab}
      onTabChange=${handleTabChange}
      variant="outlined"
      style=${{ height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    />`,
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
            setParts(prev => {
              const next = [...prev];
              if (next[idx]) {
                next[idx] = { ...next[idx], data: { ...next[idx].data, previewImageUrl: url } };
              }
              return next;
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
}

