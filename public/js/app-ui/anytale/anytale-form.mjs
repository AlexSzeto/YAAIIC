/**
 * anytale-form.mjs – Right-column form for the AnyTale page.
 *
 * Contains two tabs:
 *   Parts & Plot:  Character Name, Parts DynamicList, Prompt Preview, Generate/Delete/Clear buttons.
 *   Character:     Character database form (CharacterSection).
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
import { loadState, saveState, clearState, createDefaultPart, loadPlot } from './anytale-state.mjs';
import { assemblePrompt, assemblePartPreviewPrompt } from './prompt-assembler.mjs';
import { showDialog } from '../../custom-ui/overlays/dialog.mjs';
import { AutocompleteInput } from '../autocomplete-input.mjs';
import { H2, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { PlotSection } from './plot-section.mjs';
import { CharacterSection } from './character-section.mjs';
import { fetchPlotList } from './plot-api.mjs';

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
 * @param {Function} props.onGenerate    – Called with (prompt, name) when Generate is clicked
 * @param {boolean}  props.isGenerating  – True while a generation is in-flight
 * @param {Function} [props.onStateLoaded] – Called with the restored name after localStorage is read
 * @param {Function} [props.onRepromptReady] – Called with (fn, enabled) when reprompt handler changes; (null, false) on unmount
 */
export function AnyTaleForm({ onGenerate, isGenerating, onStateLoaded, onRepromptReady, currentItem = null }) {
  const toast = useToast();
  // Lazy initialization from localStorage so the save effect never runs with empty data
  // on the first render before loadState has been called.
  const [name, setName] = useState(() => loadState().name);
  const [parts, setParts] = useState(() => loadState().parts);
  const [isReprompting, setIsReprompting] = useState(false);
  const [activePlotPage, setActivePlotPage] = useState(0);
  const [pageLocked, setPageLocked] = useState([]);
  const [activeTab, setActiveTab] = useState('parts-plot');

  // Ref to hold the reprompt handler exposed by PlotSection
  const plotRepromptFnRef = useRef(null);

  const handlePlotRepromptReady = useCallback((fn) => {
    plotRepromptFnRef.current = fn;
  }, []);

  // ── Library lookup state ─────────────────────────────────────────────────
  const [libraryParts, setLibraryParts] = useState([]);
  // Plot list shared with CharacterSection for autocomplete hints
  const [plotList, setPlotList] = useState([]);

  // Notify parent of the initial loaded name (state is already seeded above)
  useEffect(() => {
    if (onStateLoaded) onStateLoaded(loadState().name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch library parts on mount
  useEffect(() => {
    fetch('/anytale/parts')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLibraryParts(data); })
      .catch(err => console.error('[AnyTaleForm] Failed to fetch library parts:', err));
  }, []);

  // Fetch plot list on mount for CharacterSection autocomplete
  useEffect(() => {
    fetchPlotList()
      .then(list => { if (Array.isArray(list)) setPlotList(list); })
      .catch(err => console.error('[AnyTaleForm] Failed to fetch plot list:', err));
  }, []);

  const refreshLibraryParts = useCallback(() => {
    fetch('/anytale/parts')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLibraryParts(data); })
      .catch(err => console.error('[AnyTaleForm] Failed to refresh library parts:', err));
  }, []);

  // Persist on every change
  useEffect(() => {
    saveState({ name, parts });
  }, [name, parts]);

  // ── Library lookup: add part from library ────────────────────────────────
  const handleLibrarySelect = useCallback((inputValue) => {
    const trimmed = (inputValue || '').trim();
    if (!trimmed) return;
    const match = libraryParts.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (!match) {
      toast.info(`No saved part named '${trimmed}' found`);
      return;
    }
    const newPart = createDefaultPart();
    newPart.config = { ...newPart.config, ...match };
    setParts(prev => [...prev, newPart]);
  }, [libraryParts, toast]);

  const handleClear = useCallback(async () => {
    const result = await showDialog('This will erase all parts and the name. Are you sure?', 'Clear Settings', ['Clear', 'Cancel']);
    if (result !== 'Clear') return;
    setName('');
    setParts([]);
    clearState();
  }, []);

  const handleGenerate = useCallback(() => {
    // Lock the current page as soon as generation is triggered
    setPageLocked(prev => {
      const next = [...prev];
      next[activePlotPage] = true;
      return next;
    });
    // Retrieve the active plot page from localStorage so PlotSection changes are reflected
    const currentPlot = loadPlot();
    const plotPageCount = currentPlot.pages.length;
    const activePage = plotPageCount > 0 ? currentPlot.pages[Math.min(activePlotPage, plotPageCount - 1)] : undefined;
    const prompt = assemblePrompt(parts, activePage);
    // Build parts data: keyed by part name, only parts with non-empty names
    const partsData = {};
    for (const part of parts) {
      if (part.config?.name?.trim()) {
        partsData[part.config.name] = {
          enabled: part.data.enabled,
          categoryAttributeValues: part.data.categoryAttributeValues,
          customAttributeValues: part.data.customAttributeValues,
          previewImageUrl: part.data.previewImageUrl,
        };
      }
    }
    const plotData = (currentPlot.uid || currentPlot.name)
      ? { uid: currentPlot.uid, name: currentPlot.name, page: activePlotPage }
      : null;
    onGenerate(prompt, name, partsData, plotData);
  }, [parts, name, onGenerate, activePlotPage]);

  // Update a single part by index
  const handlePartChange = useCallback((index, updatedPart) => {
    setParts(prev => {
      const next = [...prev];
      next[index] = updatedPart;
      return next;
    });
  }, []);

  // Preview generation
  const [generatingPreviews, setGeneratingPreviews] = useState({});

  // Derived: true if any part preview generation is in-flight
  const isAnyPreviewGenerating = Object.keys(generatingPreviews).length > 0;

  const handlePreviewGenerate = useCallback(async (item, index) => {
    // Prevent double-click
    if (generatingPreviews[index]) return;

    setGeneratingPreviews(prev => ({ ...prev, [index]: true }));

    try {
      const prompt = assemblePartPreviewPrompt(item);
      if (!prompt) {
        console.warn('[AnyTaleForm] No tags to generate preview for part', index);
        return;
      }

      const response = await fetch('/generate/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: 'Text to Image (Illustrious Portrait)',
          name: item.config?.name || 'preview',
          prompt,
          seed: Math.floor(Math.random() * 4294967295),
          orientation: 'square',
          // extraInputs defaults for 'Text to Image (Illustrious Portrait)'
          imageFormat: 'png',
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
        handlePartChange(index, {
          ...item,
          data: { ...item.data, previewImageUrl: result.imageUrl },
        });
      }
    } catch (err) {
      console.error('[AnyTaleForm] Preview generation failed:', err);
    } finally {
      setGeneratingPreviews(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  }, [generatingPreviews, handlePartChange]);

  // Header actions for DynamicList items
  const headerActions = [
    { icon: 'refresh', title: 'Generate preview', onClick: handlePreviewGenerate },
  ];

  // ── Reprompt: restore parts from the currently displayed image ─────────
  const handleReprompt = useCallback(async () => {
    if (!currentItem?.parts || Object.keys(currentItem.parts).length === 0) {
      toast.info('No parts data found on the current image');
      return;
    }

    setIsReprompting(true);
    try {
      // Fetch the latest library configs so we get up-to-date attribute definitions
      let latestLibrary = libraryParts;
      try {
        const response = await fetch('/anytale/parts');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            latestLibrary = data;
            setLibraryParts(data);
          }
        }
      } catch (err) {
        console.error('[AnyTaleForm] Reprompt: failed to fetch library parts:', err);
      }

      // Rebuild the parts list from the image's stored parts data
      const newParts = [];
      const skipped = [];
      for (const [partName, storedData] of Object.entries(currentItem.parts)) {
        const libraryConfig = latestLibrary.find(p => p.name === partName);
        if (!libraryConfig) {
          skipped.push(partName);
          continue;
        }

        // For each attribute in the latest config, use the stored value if it
        // exists (attribute name matches), otherwise default to empty string.
        // Stored values whose key doesn't match any current attribute are ignored.
        const categoryAttributeValues = {};
        for (const attr of (libraryConfig.categoryAttributes || [])) {
          categoryAttributeValues[attr.name] = storedData.categoryAttributeValues?.[attr.name] ?? '';
        }
        const customAttributeValues = {};
        for (const attr of (libraryConfig.customAttributes || [])) {
          customAttributeValues[attr.name] = storedData.customAttributeValues?.[attr.name] ?? '';
        }

        const newPart = createDefaultPart();
        newPart.config = { ...libraryConfig };
        newPart.data = {
          enabled: storedData.enabled ?? true,
          categoryAttributeValues,
          customAttributeValues,
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
        toast.info(`Loaded ${newParts.length} part(s); skipped ${skipped.length} not in library: ${skipped.join(', ')}`);
      } else {
        toast.success(`Reprompted: loaded ${newParts.length} part(s) from image`);
      }

      const plotMeta = currentItem?.plot;
      if (plotMeta && (plotMeta.uid || plotMeta.name) && plotRepromptFnRef.current) {
        await plotRepromptFnRef.current({ uid: plotMeta.uid, name: plotMeta.name, page: plotMeta.page ?? 0 });
      }
    } finally {
      setIsReprompting(false);
    }
  }, [currentItem, libraryParts, plotRepromptFnRef, toast]);

  // Notify parent when reprompt handler or its enabled state changes
  const canReprompt = (!!currentItem?.parts || !!currentItem?.plot) && !isGenerating && !isReprompting;
  useEffect(() => {
    if (onRepromptReady) onRepromptReady(handleReprompt, canReprompt);
    return () => { if (onRepromptReady) onRepromptReady(null, false); };
  }, [handleReprompt, canReprompt, onRepromptReady]);

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

  // Build preview prompt (also reflects the active plot page)
  const previewPrompt = (() => {
    const currentPlot = loadPlot();
    const plotPageCount = currentPlot.pages.length;
    const activePage = plotPageCount > 0 ? currentPlot.pages[Math.min(activePlotPage, plotPageCount - 1)] : undefined;
    return assemblePrompt(parts, activePage);
  })();

  // ── Tab content ─────────────────────────────────────────────────────────
  const editContent = html`
    <${EditLayout}>
      <div style="flex: none">
        <${VerticalLayout} gap="small">
          <${Input}
            label="Character Name"
            value=${name}
            onInput=${(e) => setName(e.target.value)}
            placeholder="Character name"
            widthScale="full"
          />
        </${VerticalLayout}>
      </div>

      <${PartsScrollArea}>
        <${VerticalLayout} gap="medium">
          <${VerticalLayout} gap="small">
            <${H2}>Parts</${H2}>
            <${AutocompleteInput}
              label="Add Part from Library"
              placeholder="Type to search saved parts..."
              suggestions=${libraryParts.map(p => p.name)}
              onSelect=${handleLibrarySelect}
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
              />
            `}
            getTitle=${(item) => {
              const base = item.config?.name || '(unnamed)';
              const lib = libraryParts.find(p =>
                (item.config?.uid && p.uid === item.config.uid) ||
                (item.config?.name && p.name === item.config.name)
              );
              if (!lib) return `${base} (unsaved)`;
              const configFields = {
                name: item.config.name, type: item.config.type,
                baseline: item.config.baseline, previewBaseline: item.config.previewBaseline,
                categoryAttributes: item.config.categoryAttributes,
                customAttributes: item.config.customAttributes,
              };
              const libFields = {
                name: lib.name, type: lib.type,
                baseline: lib.baseline, previewBaseline: lib.previewBaseline,
                categoryAttributes: lib.categoryAttributes,
                customAttributes: lib.customAttributes,
              };
              const isModified = JSON.stringify(configFields) !== JSON.stringify(libFields);
              return isModified ? `${base} (modified)` : base;
            }}
            getEnabled=${(item) => item.data?.enabled ?? true}
            onToggleEnabled=${(item, i) => handlePartChange(i, { ...item, data: { ...item.data, enabled: !(item.data?.enabled ?? true) } })}
            createItem=${createDefaultPart}
            onChange=${setParts}
            addLabel="Add Part"
            headerActions=${headerActions}
          />

          <${ButtonRow}>
            <${Button}
              variant="medium-text"
              color="secondary"
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
            onRepromptHandlerReady=${handlePlotRepromptReady}
          />
        </${VerticalLayout}>
      </${PartsScrollArea}>

      ${previewPrompt ? html`
        <${VerticalLayout} gap="medium">
          <${H2}>Generation</${H2}>
          <${PromptPreview}>
            <strong>Prompt preview:</strong> ${previewPrompt}
          </${PromptPreview}>
        </${VerticalLayout}>
      ` : null}

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
      id: 'character',
      label: 'Character',
      content: html`
        <${CharacterSection}
          libraryParts=${libraryParts}
          onGenerate=${onGenerate}
          isGenerating=${isGenerating || isAnyPreviewGenerating}
          onLibraryPartsChange=${refreshLibraryParts}
          plotList=${plotList}
        />
      `,
    },
  ];

  return html`
    <${TabPanels}
      tabs=${tabs}
      activeTab=${activeTab}
      onTabChange=${setActiveTab}
      variant="outlined"
      style=${{ height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    />
  `;
}
