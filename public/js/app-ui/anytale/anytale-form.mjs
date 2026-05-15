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
import { loadState, saveState, clearState, createDefaultPart, loadPlot, loadCharacter, loadOutfit, saveCharacterState, saveOutfitState, createBlankCharacter, createBlankOutfit } from './anytale-state.mjs';
import { assemblePrompt, assemblePartPreviewPrompt } from './prompt-assembler.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';
import { AutocompleteInput } from '../autocomplete-input.mjs';
import { H2, VerticalLayout } from '../../custom-ui/themed-base.mjs';
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
 * @param {Function} [props.onImportReady] – Called with (fn, enabled) when import handler changes; (null, false) on unmount
 */
export function AnyTaleForm({ onGenerate, isGenerating, onImportReady, currentItem = null }) {
  const toast = useToast();
  const [previewImageName, setPreviewImageName] = useState(() => loadState().name);
  const [parts, setParts] = useState(() => loadState().parts);
  const [isImporting, setIsImporting] = useState(false);
  const [activePlotPage, setActivePlotPage] = useState(0);
  const [pageLocked, setPageLocked] = useState([]);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('anytale-active-tab') || 'parts-plot');
  const [previewPlotModalOpen, setPreviewPlotModalOpen] = useState(false);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    localStorage.setItem('anytale-active-tab', tab);
  }, []);

  // Incremented when import writes character/outfit state to localStorage so child
  // sections can pick up the new data.
  const [importRefreshKey, setImportRefreshKey] = useState(0);

  // Plot import handler ref (kept for plot section delegation)
  const plotImportFnRef = useRef(null);
  const handlePlotImportReady = useCallback((fn) => { plotImportFnRef.current = fn; }, []);

  // ── Config for import routing ────────────────────────────────────────────
  const [recommendedCharacterPartTypes, setRecommendedCharacterPartTypes] = useState([]);
  const [recommendedOutfitPartTypes, setRecommendedOutfitPartTypes] = useState([]);
  const [previewBasePromptByType, setPreviewBasePromptByType] = useState({});

  useEffect(() => {
    fetch('/anytale/config')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.recommendedCharacterPartTypes)) setRecommendedCharacterPartTypes(data.recommendedCharacterPartTypes);
        if (Array.isArray(data.recommendedOutfitPartTypes)) setRecommendedOutfitPartTypes(data.recommendedOutfitPartTypes);
        if (data.previewBasePromptByType && typeof data.previewBasePromptByType === 'object') setPreviewBasePromptByType(data.previewBasePromptByType);
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
    saveState({ name: previewImageName, parts });
  }, [previewImageName, parts]);

  // ── Library lookup: add part from library ────────────────────────────────
  const handleLibrarySelect = useCallback((match) => {
    if (!match) return;
    const newPart = createDefaultPart();
    newPart.config = { ...newPart.config, ...match };
    setParts(prev => [...prev, newPart]);
  }, []);

  const handleClear = useCallback(async () => {
    const result = await showDialog('This will erase all parts and the preview image name. Are you sure?', 'Clear Settings', ['Clear', 'Cancel']);
    if (result !== 'Clear') return;
    setPreviewImageName('');
    setParts([]);
    clearState();
  }, []);

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
    const prompt = assemblePrompt(parts, activePage);

    const partsData = {};
    for (const p of parts) {
      if (p.config?.name?.trim()) {
        partsData[p.config.name] = {
          enabled: p.data.enabled,
          attributeValues: p.data.attributeValues,
          previewImageUrl: p.data.previewImageUrl,
        };
      }
    }

    const plotData = (currentPlot.uid || currentPlot.name)
      ? { uid: currentPlot.uid, name: currentPlot.name, page: activePlotPage }
      : null;

    onGenerate(prompt, previewImageName, partsData, plotData);
  }, [parts, previewImageName, onGenerate, activePlotPage]);

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
          enabled: true,
          attributeValues: cp.attributeValues,
          previewImageUrl: cp.previewImageUrl || '',
        },
      };
    }).filter(Boolean);

    let activePage;
    if (charTabPlotUid) {
      try {
        const res = await fetch(`/anytale/plot/${encodeURIComponent(charTabPlotUid)}`);
        if (res.ok) {
          const plotBlock = await res.json();
          activePage = Array.isArray(plotBlock.pages) && plotBlock.pages.length > 0
            ? plotBlock.pages[0] : undefined;
        }
      } catch (err) {
        console.error('[AnyTaleForm] Failed to fetch plot for generation:', err);
      }
    }

    const prompt = assemblePrompt(promptParts, activePage);

    const partsData = {};
    for (const p of promptParts) {
      if (p.config.name?.trim()) {
        partsData[p.config.name] = {
          enabled: p.data.enabled,
          attributeValues: p.data.attributeValues,
          previewImageUrl: p.data.previewImageUrl,
        };
      }
    }

    const plotData = charTabPlotUid ? { uid: charTabPlotUid, name: charTabPlotName, page: 0 } : null;
    onGenerate(prompt, previewImageName, partsData, plotData);
  }, [libraryParts, previewImageName, onGenerate, charTabPlotUid, charTabPlotName]);

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

      const response = await fetch('/generate/silent/async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: 'Text to Image (Illustrious Portrait)',
          name: item.config?.name || 'preview',
          prompt,
          seed: Math.floor(Math.random() * 4294967295),
          orientation: 'square',
          imageFormat: 'png',
          usePostPrompts: false,
          removeBackground: false,
        }),
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

  // ── Import: behaviour depends on which tab is active ─────────────────────
  const handleImport = useCallback(async () => {
    if (!currentItem?.parts || Object.keys(currentItem.parts).length === 0) {
      toast.info('No parts data found on the current image');
      return;
    }

    // ── Parts & Plot tab: restore full parts list + plot ─────────────────
    if (activeTab === 'parts-plot') {
      const result = await showDialog('Importing will clear and overwrite your current data. Are you sure?', 'Confirm Import', ['Import', 'Cancel']);
      if (result !== 'Import') return;

      setIsImporting(true);
      try {
        let latestLibrary = libraryParts;
        try {
          const response = await fetch('/anytale/parts');
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) { latestLibrary = data; setLibraryParts(data); }
          }
        } catch (err) {
          console.error('[AnyTaleForm] Import: failed to fetch library parts:', err);
        }

        const newParts = [];
        const skipped = [];
        for (const [partName, storedData] of Object.entries(currentItem.parts)) {
          const libraryConfig = latestLibrary.find(p => p.name === partName);
          if (!libraryConfig) { skipped.push(partName); continue; }

          const attributeValues = {};
          for (const attr of (libraryConfig.attributes || [])) {
            attributeValues[attr.name] = storedData.attributeValues?.[attr.name] ?? '';
          }

          const newPart = createDefaultPart();
          newPart.config = { ...libraryConfig };
          newPart.data = {
            enabled: storedData.enabled ?? true,
            attributeValues,
            previewImageUrl: storedData.previewImageUrl || '',
          };
          newParts.push(newPart);
        }

        if (newParts.length === 0) {
          toast.error('None of the image\'s parts were found in the library');
          return;
        }

        setParts(newParts);

        if (skipped.length > 0) {
          toast.info(`Imported ${newParts.length} part(s); skipped ${skipped.length} not in library: ${skipped.join(', ')}`);
        } else {
          toast.success(`Imported: loaded ${newParts.length} part(s) from image`);
        }

        const plotMeta = currentItem?.plot;
        if (plotMeta && (plotMeta.uid || plotMeta.name) && plotImportFnRef.current) {
          await plotImportFnRef.current({ uid: plotMeta.uid, name: plotMeta.name, page: plotMeta.page ?? 0 });
        }
      } finally {
        setIsImporting(false);
      }
      return;
    }

    // ── Character & Outfits tab: route parts to character or outfit ───────
    const result = await showDialog('Importing will clear and overwrite your current character and outfit data. Are you sure?', 'Confirm Import', ['Import', 'Cancel']);
    if (result !== 'Import') return;

    setIsImporting(true);
    try {
      let latestLibrary = libraryParts;
      let charTypes = recommendedCharacterPartTypes;
      let outfitTypes = recommendedOutfitPartTypes;

      try {
        const [libRes, configRes] = await Promise.all([fetch('/anytale/parts'), fetch('/anytale/config')]);
        if (libRes.ok) {
          const data = await libRes.json();
          if (Array.isArray(data)) { latestLibrary = data; setLibraryParts(data); }
        }
        if (configRes.ok) {
          const cfg = await configRes.json();
          if (Array.isArray(cfg.recommendedCharacterPartTypes)) charTypes = cfg.recommendedCharacterPartTypes;
          if (Array.isArray(cfg.recommendedOutfitPartTypes)) outfitTypes = cfg.recommendedOutfitPartTypes;
        }
      } catch (err) {
        console.error('[AnyTaleForm] Import: failed to fetch configs:', err);
      }

      const characterParts = [];
      const outfitParts = [];
      const skipped = [];

      for (const [partName, storedData] of Object.entries(currentItem.parts)) {
        const libraryConfig = latestLibrary.find(p => p.name === partName);
        if (!libraryConfig) { skipped.push(partName); continue; }

        const attributeValues = {};
        for (const attr of (libraryConfig.attributes || [])) {
          attributeValues[attr.name] = storedData.attributeValues?.[attr.name] ?? '';
        }
        const partEntry = {
          partUid: libraryConfig.uid,
          attributeValues,
          previewImageUrl: storedData.previewImageUrl || '',
        };

        const partTypes = (libraryConfig.type || []).map(t => t.toLowerCase());
        const isCharType = charTypes.some(t => partTypes.includes(t.toLowerCase()));
        const isOutfitType = outfitTypes.some(t => partTypes.includes(t.toLowerCase()));

        if (isCharType) characterParts.push(partEntry);
        else if (isOutfitType) outfitParts.push({ ...partEntry });
        else { characterParts.push(partEntry); outfitParts.push({ ...partEntry }); }
      }

      const blankChar = createBlankCharacter();
      blankChar.name = currentItem.name || 'Imported Character';
      blankChar.parts = characterParts;
      saveCharacterState(blankChar);

      const blankOutfit = createBlankOutfit();
      blankOutfit.parts = outfitParts;
      saveOutfitState(blankOutfit);

      setImportRefreshKey(k => k + 1);

      if (skipped.length > 0) {
        toast.info(`Imported: ${characterParts.length} character part(s), ${outfitParts.length} outfit part(s); skipped ${skipped.length}: ${skipped.join(', ')}`);
      } else {
        toast.success(`Imported: ${characterParts.length} character part(s), ${outfitParts.length} outfit part(s)`);
      }

      const plotMeta = currentItem?.plot;
      if (plotMeta && (plotMeta.uid || plotMeta.name) && plotImportFnRef.current) {
        await plotImportFnRef.current({ uid: plotMeta.uid, name: plotMeta.name, page: plotMeta.page ?? 0 });
      }

      handleTabChange('character-outfits');
    } finally {
      setIsImporting(false);
    }
  }, [currentItem, libraryParts, recommendedCharacterPartTypes, recommendedOutfitPartTypes, plotImportFnRef, activeTab, toast]);

  // Notify parent when import handler or its enabled state changes
  const canImport = (!!currentItem?.parts || !!currentItem?.plot) && !isGenerating && !isImporting;
  useEffect(() => {
    if (onImportReady) onImportReady(handleImport, canImport);
    return () => { if (onImportReady) onImportReady(null, false); };
  }, [handleImport, canImport, onImportReady]);

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

  // Preview prompt based on merged character+outfit parts (re-reads localStorage on render)
  const previewPrompt = useMemo(() => {
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
          enabled: true,
          attributeValues: cp.attributeValues,
          previewImageUrl: cp.previewImageUrl || '',
        },
      };
    }).filter(Boolean);
    const currentPlot = loadPlot();
    const plotPageCount = currentPlot.pages.length;
    const activePage = plotPageCount > 0 ? currentPlot.pages[Math.min(activePlotPage, plotPageCount - 1)] : undefined;
    return assemblePrompt(promptParts, activePage);
  }, [libraryParts, activePlotPage, importRefreshKey]);

  // ── Tab content ─────────────────────────────────────────────────────────
  const editContent = html`
    <${EditLayout}>
      <${PartsScrollArea}>
        <${VerticalLayout} gap="medium">
          <${VerticalLayout} gap="small">
            <${H2}>Parts</${H2}>
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
                previewBasePromptByType=${previewBasePromptByType}
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
            headerActions=${headerActions}
            deleteIcon="x"
            deleteLabel="Remove"
          />

          <${ButtonRow}>
            <${Button}
              variant="medium-text"
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
            />
            <${OutfitSection}
              libraryParts=${libraryParts}
              onLibraryPartsChange=${refreshLibraryParts}
              refreshKey=${importRefreshKey}
              onOutfitListChange=${setSharedOutfitList}
              scrollable=${false}
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
            setParts(prev => {
              const next = [...prev];
              if (next[idx]) {
                next[idx] = { ...next[idx], data: { ...next[idx].data, previewImageUrl: data.result.imageUrl } };
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

