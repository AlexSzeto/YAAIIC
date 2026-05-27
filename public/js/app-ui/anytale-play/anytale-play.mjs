import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { loadPlayData, clearPlayDataCache } from './play-data.mjs';
import {
  load as loadSession,
  save as saveSession,
  clear as clearSession,
} from '../anytale/play/play-session.mjs';
import { PortraitPanel } from '../anytale/play/portrait-panel.mjs';
import { assemblePrompt, expandDialogPrompt } from '../anytale/prompt-assembler.mjs';
import { fetchJson } from '../../custom-ui/util.mjs';
import { getClientId } from '../client-id.mjs';
import { queueSSEManager } from '../queue-sse-manager.mjs';
import { useProgress } from '../../custom-ui/msg/progress-context.mjs';
import { globalBgmPlayer, globalAudioPlayer } from '../../custom-ui/global-audio-player.mjs';
import { showModal } from '../../custom-ui/overlays/modal.mjs';
import {
  randomPickN,
  splitOptions,
  computeSlotState,
  checkSlotRequirements,
  buildPartForPrompt,
  buildActiveParts,
  computeVisiblePages,
  buildEnabledPartsForPage,
} from './play-utils.mjs';
import { resolveSlotStatuses, parseRules, applyRules } from '../anytale/slot-resolver.mjs';
import { buildCacheKey, getCacheEntry, setCacheEntry, updateCacheEntry, clearAllCache } from './play-cache.mjs';
import { generateDialog } from './play-dialog.mjs';
import { patchPrefs } from '../anytale/play/play-prefs.mjs';

export function AnyTalePlayPage() {
  const [, setTheme] = useState(currentTheme.value);
  useEffect(() => currentTheme.subscribe(setTheme), []);

  const { show: progressShow } = useProgress();

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [playData, setPlayData] = useState(null);
  const [session, setSession] = useState(() => loadSession());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEndGenerating, setIsEndGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [introPlot, setIntroPlot] = useState(null);

  // Chapter state (recomputed after chapter entry or page reload)
  const [currentPlot, setCurrentPlot] = useState(null);
  const [visiblePageIndices, setVisiblePageIndices] = useState([]);
  // pageSlotStatuses: Map[] indexed by actual plot-page index; post-action slot statuses
  const [pageSlotStatuses, setPageSlotStatuses] = useState([]);
  // pageImageUrls / pageStatuses keyed by actual plot-page index
  const [pageImageUrls, setPageImageUrls] = useState({});
  const [pageStatuses, setPageStatuses] = useState({});
  // pageDialogTexts keyed by actual plot-page index (null = no dialog / skipped)
  const [pageDialogTexts, setPageDialogTexts] = useState({});
  // pageVoiceUrls / pageVoiceStatuses keyed by actual plot-page index
  const [pageVoiceUrls, setPageVoiceUrls] = useState({});
  const [pageVoiceStatuses, setPageVoiceStatuses] = useState({});
  const [isAutoplay, setIsAutoplay] = useState(false);
  // URL currently shown in PortraitPanel — only advances to a new page's image once ALL page assets are ready
  const [displayedImageUrl, setDisplayedImageUrl] = useState('');

  // Phase-specific draft state (intro)
  const [charDraft, setCharDraft] = useState([]);
  const [outfitDraft, setOutfitDraft] = useState([]);
  const [genreDraft, setGenreDraft] = useState([]);
  const [locationDraft, setLocationDraft] = useState([]);

  // --- Session helpers ---

  const applySession = useCallback((next) => {
    setSession(next);
    saveSession(next);
  }, []);

  const updateSession = useCallback((updates) => {
    setSession(prev => {
      const next = { ...prev, ...updates };
      saveSession(next);
      return next;
    });
  }, []);

  // --- Intro image generation ---

  const generateIntroImage = useCallback((sess, introPl, data) => {
    const partsMap = new Map((data.parts || []).map(p => [p.uid, p]));
    const outfit = (data.outfits || []).find(o => o.uid === sess.outfitUid);

    const charActiveParts = (sess.character.parts || []).map(p => {
      const config = partsMap.get(p.partUid);
      return config ? { config: { type: config.type || [], isRevealing: false } } : null;
    }).filter(Boolean);

    const outfitActiveParts = (outfit ? outfit.parts : []).map(p => {
      const config = partsMap.get(p.partUid);
      return config ? { config: { type: config.type || [], isRevealing: p.isRevealing ?? false } } : null;
    }).filter(Boolean);

    const slotStatuses = resolveSlotStatuses([...charActiveParts, ...outfitActiveParts], introPl.pages || [], 0);
    const parsedRules = parseRules(data.config.slotRules || '');
    const visibility = applyRules(slotStatuses, parsedRules);

    const rawParts = [
      ...(sess.character.parts || []).map(p =>
        buildPartForPrompt(p.partUid, p.attributeValues, partsMap)
      ),
      ...(outfit ? outfit.parts : []).map(p =>
        buildPartForPrompt(p.partUid, p.attributeValues, partsMap)
      ),
    ].filter(Boolean);

    const enabledParts = rawParts.filter(p => {
      const types = Array.isArray(p.config?.type) ? p.config.type : [];
      if (types.length === 0) return true;
      return types.some(t => visibility.get(t.trim().toLowerCase()) !== false);
    });

    if (sess.location.partUid) {
      const locPartConfig = partsMap.get(sess.location.partUid);
      if (locPartConfig) {
        const locTypes = Array.isArray(locPartConfig.type) ? locPartConfig.type : [];
        for (const t of locTypes) visibility.set(t.trim().toLowerCase(), true);
      }
      const locPart = buildPartForPrompt(sess.location.partUid, sess.location.attributeMap, partsMap);
      if (locPart) enabledParts.push(locPart);
    }

    const introPage = introPl.pages?.[0];
    const prompt = assemblePrompt(enabledParts, introPage, visibility);
    const workflow = data.config.generationWorkflow || 'Text to Image (Illustrious Characters)';

    fetchJson('/anytale/play/generate-intro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow,
        name: `${sess.character.name} - Intro`,
        prompt,
        seed: Math.floor(Math.random() * 2 ** 32),
        orientation: 'portrait',
        clientId: getClientId(),
      }),
    }).catch(err => console.error('[AnyTalePlayPage] Failed to submit intro generation:', err));
  }, []);

  // --- End screen image generation ---

  /**
   * Generate the end-screen image for the 'end' section plot.
   *
   * @param {Object} endPlot - full end-section plot object
   * @param {Object} sess - current session snapshot
   * @param {Object} data - play data
   * @param {Map<string,string>|null} [initialSlotStatuses] - final evolved slot state from the last
   *   chapter (post all pages' actions). When provided, slot actions on the end plot's page 0 are
   *   layered on top so parts are correctly disabled/revealed in the end screen image.
   */
  const generateEndScreenImage = useCallback((endPlot, sess, data, initialSlotStatuses = null) => {
    if (!endPlot?.pages?.length) return;
    const partsMap = new Map((data.parts || []).map(p => [p.uid, p]));
    const outfit = (data.outfits || []).find(o => o.uid === sess.outfitUid);
    const outfitParts = outfit ? outfit.parts : [];
    const activeParts = buildActiveParts(sess, outfitParts, partsMap);

    // Run computeVisiblePages starting from the post-story slot state so that:
    //  1. Parts disabled by earlier chapter actions remain hidden.
    //  2. Any slot actions on the end plot's page 0 are applied before prompt assembly.
    const { pageSlotStatuses: endSlotStatuses } = computeVisiblePages(
      activeParts, endPlot, data.config.slotRules || '', initialSlotStatuses
    );

    // Page 0 slot statuses (post page-0 actions) used for part filtering and prompt assembly
    const pageSlotStatus = endSlotStatuses[0];
    if (!pageSlotStatus) return;

    const { enabledParts, visibility } = buildEnabledPartsForPage(
      sess, outfitParts, partsMap, pageSlotStatus, data.config.slotRules || ''
    );

    const endPage = endPlot.pages[0];
    const prompt = assemblePrompt(enabledParts, endPage, visibility);
    const workflow = data.config.generationWorkflow || 'Text to Image (Illustrious Characters)';

    fetchJson('/anytale/play/generate-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow,
        name: `${sess.character.name} - End`,
        prompt,
        seed: Math.floor(Math.random() * 2 ** 32),
        orientation: 'portrait',
        clientId: getClientId(),
      }),
    }).catch(err => console.error('[AnyTalePlayPage] Failed to submit end screen generation:', err));
  }, []);

  // --- Chapter page image queuing ---

  // Accumulated dialog history for the current chapter (cleared on chapter entry / reset)
  const dialogHistoryRef = useRef([]);
  // Tracks which character UID intro voice was last played for
  const introVoicePlayedForRef = useRef('');

  // Stable ref to latest values needed inside callbacks / effects
  const playDataRef = useRef(playData);
  const sessionRef = useRef(session);
  const visiblePageIndicesRef = useRef(visiblePageIndices);
  const pageSlotStatusesRef = useRef(pageSlotStatuses);
  useEffect(() => { playDataRef.current = playData; }, [playData]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { visiblePageIndicesRef.current = visiblePageIndices; }, [visiblePageIndices]);
  useEffect(() => { pageSlotStatusesRef.current = pageSlotStatuses; }, [pageSlotStatuses]);

  // Maps queue item UUID → { plotPageIdx, cacheKey, type: 'image'|'voice' }
  const taskToPageRef = useRef(new Map());
  // Buffer for queue:task-started events that arrive before queuePageImage.then() fires
  const pendingChapterEventsRef = useRef([]);
  // Stable refs so callbacks can call functions defined later in the component
  const queuePageSpeechRef = useRef(null);
  const initChapterRef = useRef(null);
  const currentPlotRef = useRef(currentPlot);
  useEffect(() => { currentPlotRef.current = currentPlot; }, [currentPlot]);

  // Stale generation guard: incremented on every initChapter call.
  // Callbacks that captured a stale ID are discarded.
  const chapterStaleRef = useRef(0);

  // AbortController for dialog generation — replaced on each initChapter call.
  const dialogAbortControllerRef = useRef(null);

  // Open a progress SSE subscription for a chapter page
  const subscribePageProgress = useCallback((sseTaskId, plotPageIdx, cacheKey) => {
    const capturedStaleId = chapterStaleRef.current;
    progressShow(sseTaskId, {
      onComplete: (result) => {
        if (chapterStaleRef.current !== capturedStaleId) return; // stale chapter
        if (result?.result?.imageUrl) {
          const url = result.result.imageUrl;
          setPageImageUrls(prev => ({ ...prev, [plotPageIdx]: url }));
          setPageStatuses(prev => ({ ...prev, [plotPageIdx]: 'complete' }));
          updateCacheEntry(cacheKey, { imageUrl: url, imageStatus: 'complete' });
        } else {
          setPageStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
          updateCacheEntry(cacheKey, { imageStatus: 'error' });
        }
      },
      onError: () => {
        if (chapterStaleRef.current !== capturedStaleId) return;
        setPageStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
        updateCacheEntry(cacheKey, { imageStatus: 'error' });
      },
      onCancelled: () => {
        if (chapterStaleRef.current !== capturedStaleId) return;
        setPageStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
      },
    });
  }, [progressShow]);

  // Open a voice/speech SSE subscription for a chapter page
  const subscribeVoiceProgress = useCallback((sseTaskId, plotPageIdx, cacheKey) => {
    const capturedStaleId = chapterStaleRef.current;
    progressShow(sseTaskId, {
      onComplete: (result) => {
        if (chapterStaleRef.current !== capturedStaleId) return;
        if (result?.result?.audioUrl) {
          const url = result.result.audioUrl;
          setPageVoiceUrls(prev => ({ ...prev, [plotPageIdx]: url }));
          setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'complete' }));
          updateCacheEntry(cacheKey, { voiceUrl: url, voiceStatus: 'complete' });
        } else {
          setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
          updateCacheEntry(cacheKey, { voiceStatus: 'error' });
        }
      },
      onError: () => {
        if (chapterStaleRef.current !== capturedStaleId) return;
        setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
        updateCacheEntry(cacheKey, { voiceStatus: 'error' });
      },
      onCancelled: () => {
        if (chapterStaleRef.current !== capturedStaleId) return;
        setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
      },
    });
  }, [progressShow]);

  const queuePageImage = useCallback((plotPageIdx, plot, slotStatuses) => {
    const data = playDataRef.current;
    const sess = sessionRef.current;
    if (!data || !sess) return;

    const outfit = (data.outfits || []).find(o => o.uid === sess.outfitUid);
    const partsMap = new Map((data.parts || []).map(p => [p.uid, p]));

    const { enabledParts, visibility } = buildEnabledPartsForPage(
      sess,
      outfit ? outfit.parts : [],
      partsMap,
      slotStatuses,
      data.config.slotRules || ''
    );

    const page = plot.pages[plotPageIdx];
    const prompt = assemblePrompt(enabledParts, page, visibility);
    const workflow = data.config.generationWorkflow || 'Text to Image (Illustrious Characters)';

    const cacheKey = buildCacheKey({
      plotUid: plot.uid,
      pageIndex: plotPageIdx,
      characterUid: sess.character.uid,
      outfitUid: sess.outfitUid,
      locationPartUid: sess.location.partUid,
      locationAttributeMap: sess.location.attributeMap,
      slotStatuses,
    });

    updateCacheEntry(cacheKey, { imageUrl: null, imageTaskId: null, imageStatus: 'pending' });

    fetchJson('/anytale/play/generate-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow,
        name: `${plot.name} - Page ${plotPageIdx + 1}`,
        prompt,
        seed: Math.floor(Math.random() * 2 ** 32),
        orientation: 'portrait',
        clientId: getClientId(),
      }),
    }).then(({ taskId: queueItemId }) => {
      updateCacheEntry(cacheKey, { imageTaskId: queueItemId, imageStatus: 'generating' });
      setPageStatuses(prev => ({ ...prev, [plotPageIdx]: 'generating' }));

      const earlyIdx = pendingChapterEventsRef.current.findIndex(e => e.id === queueItemId);
      if (earlyIdx !== -1) {
        const [earlyEvent] = pendingChapterEventsRef.current.splice(earlyIdx, 1);
        subscribePageProgress(earlyEvent.taskId, plotPageIdx, cacheKey);
      } else {
        taskToPageRef.current.set(queueItemId, { plotPageIdx, cacheKey });
      }
    }).catch(err => {
      console.error('[AnyTalePlayPage] Failed to queue page image:', err);
      setPageStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
    });
  }, [subscribePageProgress]);

  // --- Dialog generation ---

  const queuePageDialog = useCallback(async (plotPageIdx, plot, sess, data, cacheKey, history = [], signal) => {
    const page = plot.pages[plotPageIdx];
    const rawDialogPrompt = (page.dialogPrompt || '').trim();
    const personality = (sess.character.personality || '').trim();
    const locationAttrValue = Object.values(sess.location.attributeMap || {}).find(v => v) || '';
    const dialogConfig = data.config.dialog;

    const outfit = (data.outfits || []).find(o => o.uid === sess.outfitUid);
    const partsMap = new Map((data.parts || []).map(p => [p.uid, p]));
    const outfitParts = outfit ? outfit.parts : [];
    const dialogEnabledParts = [
      ...(sess.character?.parts || []).map(p => buildPartForPrompt(p.partUid, p.attributeValues, partsMap)),
      ...outfitParts.map(p => buildPartForPrompt(p.partUid, p.attributeValues, partsMap)),
    ].filter(Boolean);
    const expandedPrompt = expandDialogPrompt(rawDialogPrompt, dialogEnabledParts);

    const outfitPartsForPrompt = outfitParts.map(p => buildPartForPrompt(p.partUid, p.attributeValues, partsMap)).filter(Boolean);
    const outfitText = assemblePrompt(outfitPartsForPrompt, null, null);

    if (!expandedPrompt || !personality || !locationAttrValue || !dialogConfig) {
      updateCacheEntry(cacheKey, { dialogText: null, dialogStatus: 'skipped' });
      setPageDialogTexts(prev => ({ ...prev, [plotPageIdx]: null }));
      return null;
    }

    updateCacheEntry(cacheKey, { dialogText: null, dialogStatus: 'generating' });

    const isStreaming = dialogConfig.stream === true;

    try {
      const text = await generateDialog({
        character: sess.character,
        locationAttributeValue: locationAttrValue,
        outfitText,
        page: { ...page, dialogPrompt: expandedPrompt },
        dialogConfig,
        history,
        signal,
        onChunk: isStreaming ? (partial) => {
          setPageDialogTexts(prev => ({ ...prev, [plotPageIdx]: partial }));
        } : undefined,
      });
      updateCacheEntry(cacheKey, { dialogText: text, dialogStatus: 'complete' });
      setPageDialogTexts(prev => ({ ...prev, [plotPageIdx]: text }));
      return { text, expandedPrompt };
    } catch (err) {
      if (err.name === 'AbortError') {
        // Dialog was aborted due to chapter change — treat as skipped to avoid blocking
        updateCacheEntry(cacheKey, { dialogStatus: 'skipped', dialogText: null });
        setPageDialogTexts(prev => ({ ...prev, [plotPageIdx]: null }));
      } else {
        updateCacheEntry(cacheKey, { dialogStatus: 'error' });
        setPageDialogTexts(prev => ({ ...prev, [plotPageIdx]: null }));
      }
      return null;
    }
  }, []);

  // Queue TTS speech generation for a page (after dialog text is known)
  const queuePageSpeech = useCallback((plotPageIdx, dialogText, cacheKey) => {
    const sess = sessionRef.current;
    const voiceSampleUrl = sess?.character?.voiceSampleUrl;
    if (!voiceSampleUrl || sess?.muted) {
      updateCacheEntry(cacheKey, { voiceUrl: null, voiceStatus: 'skipped' });
      setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'skipped' }));
      return;
    }

    updateCacheEntry(cacheKey, { voiceUrl: null, voiceStatus: 'generating' });
    setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'generating' }));

    fetchJson('/anytale/play/generate-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterUid: sess.character.uid,
        voiceSampleUrl,
        dialogText,
        clientId: getClientId(),
      }),
    }).then(({ taskId: queueItemId }) => {
      updateCacheEntry(cacheKey, { voiceTaskId: queueItemId });
      const earlyIdx = pendingChapterEventsRef.current.findIndex(e => e.id === queueItemId);
      if (earlyIdx !== -1) {
        const [earlyEvent] = pendingChapterEventsRef.current.splice(earlyIdx, 1);
        subscribeVoiceProgress(earlyEvent.taskId, plotPageIdx, cacheKey);
      } else {
        taskToPageRef.current.set(queueItemId, { plotPageIdx, cacheKey, type: 'voice' });
      }
    }).catch(err => {
      console.error('[AnyTalePlayPage] Failed to queue speech:', err);
      setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
      updateCacheEntry(cacheKey, { voiceStatus: 'error' });
    });
  }, [subscribeVoiceProgress]);

  useEffect(() => { queuePageSpeechRef.current = queuePageSpeech; }, [queuePageSpeech]);

  // --- Chapter initialization ---

  /**
   * @param {Object} plot - full plot object
   * @param {Object} sess - session snapshot
   * @param {Object} data - play data
   * @param {Map<string,string>|null} [initialSlotStatuses=null] - carried slot state for cross-chapter continuity
   */
  const initChapter = useCallback(async (plot, sess, data, initialSlotStatuses = null) => {
    // Increment stale ID — callbacks that captured the old ID will be discarded.
    const staleId = ++chapterStaleRef.current;

    // Abort any in-progress dialog generation from a previous chapter.
    dialogAbortControllerRef.current?.abort();
    const dialogAbortCtrl = new AbortController();
    dialogAbortControllerRef.current = dialogAbortCtrl;

    // Phase 1: flush all anytale-play items from the queue
    taskToPageRef.current.clear();
    pendingChapterEventsRef.current = [];
    await fetch('/queue/items/source/anytale-play', { method: 'DELETE' }).catch(() => {});

    // Guard: if chapter changed again while we awaited, abort.
    if (chapterStaleRef.current !== staleId) return;

    const partsMap = new Map((data.parts || []).map(p => [p.uid, p]));
    const outfit = (data.outfits || []).find(o => o.uid === sess.outfitUid);
    const activeParts = buildActiveParts(sess, outfit ? outfit.parts : [], partsMap);

    const { visibleIndices, pageSlotStatuses: slotStatuses } = computeVisiblePages(
      activeParts,
      plot,
      data.config.slotRules || '',
      initialSlotStatuses
    );

    // Compute the actual initial statuses used (for timeline storage)
    const actualInitialStatuses = initialSlotStatuses
      ? initialSlotStatuses
      : resolveSlotStatuses(activeParts, [], 0);

    setCurrentPlot(plot);
    setVisiblePageIndices(visibleIndices);
    setPageSlotStatuses(slotStatuses);

    // Update timeline entry for this chapter with pageCount and actual initial slot state.
    // We use setSession here (not updateSession) to avoid stale closure issues inside the async fn.
    setSession(prev => {
      const idx = prev.timelineIndex ?? 0;
      const newTimeline = [...(prev.timeline || [])];
      if (newTimeline[idx]) {
        newTimeline[idx] = {
          ...newTimeline[idx],
          pageCount: visibleIndices.length,
          slotStateAtEntry: Object.fromEntries(actualInitialStatuses),
        };
      }
      const next = { ...prev, timeline: newTimeline };
      saveSession(next);
      return next;
    });

    const dialogEnabled = !!data.config.dialog;

    const newImageUrls = {};
    const newStatuses = {};
    const newDialogTexts = {};
    const newVoiceUrls = {};
    const newVoiceStatuses = {};
    const toQueueImage = [];
    const toQueueDialog = [];

    for (const plotPageIdx of visibleIndices) {
      const cacheKey = buildCacheKey({
        plotUid: plot.uid,
        pageIndex: plotPageIdx,
        characterUid: sess.character.uid,
        outfitUid: sess.outfitUid,
        locationPartUid: sess.location.partUid,
        locationAttributeMap: sess.location.attributeMap,
        slotStatuses: slotStatuses[plotPageIdx],
      });
      const entry = getCacheEntry(cacheKey);

      if (entry?.imageStatus === 'complete' && entry.imageUrl) {
        newImageUrls[plotPageIdx] = entry.imageUrl;
        newStatuses[plotPageIdx] = 'complete';
      } else {
        newStatuses[plotPageIdx] = 'pending';
        toQueueImage.push({ plotPageIdx, slotStatuses: slotStatuses[plotPageIdx] });
      }

      if (entry?.dialogStatus === 'complete' || entry?.dialogStatus === 'skipped') {
        newDialogTexts[plotPageIdx] = entry.dialogText ?? null;
      } else if (dialogEnabled) {
        toQueueDialog.push({ plotPageIdx, cacheKey });
      } else {
        updateCacheEntry(cacheKey, { dialogText: null, dialogStatus: 'skipped' });
        newDialogTexts[plotPageIdx] = null;
      }

      if (entry?.voiceStatus === 'complete' && entry.voiceUrl) {
        newVoiceUrls[plotPageIdx] = entry.voiceUrl;
        newVoiceStatuses[plotPageIdx] = 'complete';
      } else if (entry?.voiceStatus === 'skipped') {
        newVoiceStatuses[plotPageIdx] = 'skipped';
      } else if (entry?.voiceStatus === 'generating' || entry?.voiceStatus === 'error') {
        updateCacheEntry(cacheKey, { voiceStatus: 'pending', voiceTaskId: null });
      }
    }

    setPageImageUrls(newImageUrls);
    setPageStatuses(newStatuses);
    setPageDialogTexts(newDialogTexts);
    setPageVoiceUrls(newVoiceUrls);
    setPageVoiceStatuses(newVoiceStatuses);

    dialogHistoryRef.current = [];

    // Phase 2: generate all missing dialog sequentially
    if (dialogEnabled) {
      for (const { plotPageIdx, cacheKey } of toQueueDialog) {
        // Guard: abort if another initChapter was called
        if (chapterStaleRef.current !== staleId) return;
        const history = [...dialogHistoryRef.current];
        const result = await queuePageDialog(
          plotPageIdx, plot, sess, data, cacheKey, history, dialogAbortCtrl.signal
        );
        if (chapterStaleRef.current !== staleId) return; // stale check after await
        const text = result?.text ?? null;
        const expandedPrompt = result?.expandedPrompt ?? '';
        if (text && expandedPrompt) {
          dialogHistoryRef.current = [
            ...dialogHistoryRef.current,
            { role: 'user', content: expandedPrompt },
            { role: 'assistant', content: text },
          ];
        }
      }
    }

    if (chapterStaleRef.current !== staleId) return;

    // Phase 3: queue images and TTS for missing pages
    const voiceOn = dialogEnabled && !sess.muted && !!sess.character.voiceSampleUrl;
    const needsImage = new Set(toQueueImage.map(item => item.plotPageIdx));

    for (const plotPageIdx of visibleIndices) {
      const cacheKey = buildCacheKey({
        plotUid: plot.uid,
        pageIndex: plotPageIdx,
        characterUid: sess.character.uid,
        outfitUid: sess.outfitUid,
        locationPartUid: sess.location.partUid,
        locationAttributeMap: sess.location.attributeMap,
        slotStatuses: slotStatuses[plotPageIdx],
      });

      if (needsImage.has(plotPageIdx)) {
        queuePageImage(plotPageIdx, plot, slotStatuses[plotPageIdx]);
      }

      if (voiceOn) {
        const entry = getCacheEntry(cacheKey);
        const dialogText = entry?.dialogText;
        const vs = entry?.voiceStatus;
        const voiceNeeded = dialogText && !['complete', 'generating', 'skipped', 'error'].includes(vs);
        if (voiceNeeded) {
          queuePageSpeechRef.current?.(plotPageIdx, dialogText, cacheKey);
        }
      }
    }
  }, [queuePageImage, queuePageDialog]);

  useEffect(() => { initChapterRef.current = initChapter; }, [initChapter]);

  // Load chapter when phase is 'plot' and plot not yet loaded (or changed)
  useEffect(() => {
    if (session.phase !== 'plot') return;
    if (!session.currentPlotUid) return;
    if (!playData) return;
    if (currentPlot?.uid === session.currentPlotUid) return;

    // Read slotStateAtEntry from the current timeline entry for cross-chapter continuity
    const timelineEntry = (session.timeline || [])[session.timelineIndex ?? 0];
    const storedSlotState = timelineEntry?.slotStateAtEntry;
    const initialSlotStatuses =
      storedSlotState && Object.keys(storedSlotState).length > 0
        ? new Map(Object.entries(storedSlotState))
        : null;

    fetchJson(`/anytale/plot/${session.currentPlotUid}`)
      .then(plot => initChapter(plot, session, playData, initialSlotStatuses))
      .catch(err => {
        console.error('[AnyTalePlayPage] Failed to load chapter:', err);
        updateSession({ phase: 'intro-main' });
      });
  }, [session.phase, session.currentPlotUid, playData, currentPlot?.uid, initChapter, updateSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate end screen image when entering 'end' phase
  useEffect(() => {
    if (session.phase !== 'end') return;
    if (session.endImageUrl) return; // already have it
    if (!playData) return;

    const endPlot = (playData.plots || []).find(
      p => (p.section || '').toLowerCase() === 'end'
    );
    if (!endPlot) return;

    // Derive the final evolved slot state from the last chapter (epilogue).
    // pageSlotStatusesRef holds per-plot-page slot Maps set by initChapter.
    // The entry at the last actual page index is post-all-pages-actions — that is
    // the correct starting state for the end plot's page 0 slot evaluation.
    let finalSlotStatuses = null;
    const lastPlot = currentPlotRef.current;
    const slotStatusMaps = pageSlotStatusesRef.current;
    if (lastPlot?.pages?.length > 0 && slotStatusMaps?.length > 0) {
      const lastPageIdx = lastPlot.pages.length - 1;
      finalSlotStatuses = slotStatusMaps[lastPageIdx] ?? null;
    }

    fetchJson(`/anytale/plot/${endPlot.uid}`)
      .then(fullEndPlot => generateEndScreenImage(fullEndPlot, session, playData, finalSlotStatuses))
      .catch(err => console.error('[AnyTalePlayPage] Failed to load end plot:', err));
  }, [session.phase, session.endImageUrl, playData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-transition to 'end' phase when at the last page of an epilogue chapter
  useEffect(() => {
    if (session.phase !== 'plot' || !currentPlot) return;
    const isEpilogue = (currentPlot.section || '').toLowerCase() === 'epilogue';
    if (!isEpilogue) return;

    const isAtLastPage =
      visiblePageIndices.length > 0 &&
      session.pageIndex === visiblePageIndices.length - 1;
    if (!isAtLastPage) return;

    const currentPlotPageIdx = visiblePageIndices[session.pageIndex];
    if (currentPlotPageIdx == null) return;

    const voiceApplicable = !session.muted && !!session.character.voiceSampleUrl;
    const isVoiceSettled = (() => {
      const vs = pageVoiceStatuses[currentPlotPageIdx];
      if (vs === 'complete' || vs === 'skipped' || vs === 'error') return true;
      if (pageDialogTexts[currentPlotPageIdx] === null) return true;
      return false;
    })();
    const currentPageReady =
      pageStatuses[currentPlotPageIdx] === 'complete' &&
      (!voiceApplicable || isVoiceSettled);

    if (!currentPageReady) return;

    const timer = setTimeout(() => {
      updateSession({ phase: 'end' });
    }, 2000);
    return () => clearTimeout(timer);
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    session.phase, session.pageIndex, session.muted, session.character.voiceSampleUrl,
    currentPlot, visiblePageIndices, pageStatuses, pageVoiceStatuses, pageDialogTexts,
    updateSession,
  ]);

  // --- SSE subscriptions ---

  const sessionPhaseRef = useRef(session.phase);
  useEffect(() => { sessionPhaseRef.current = session.phase; }, [session.phase]);

  useEffect(() => {
    return queueSSEManager.subscribe({
      'queue:task-started': ({ id: queueItemId, taskId: sseTaskId, source, clientId }) => {
        if (source !== 'anytale-play') return;
        if (clientId !== getClientId()) return;

        if (sessionPhaseRef.current === 'plot') {
          const pageInfo = taskToPageRef.current.get(queueItemId);
          if (pageInfo) {
            taskToPageRef.current.delete(queueItemId);
            if (pageInfo.type === 'voice') {
              subscribeVoiceProgress(sseTaskId, pageInfo.plotPageIdx, pageInfo.cacheKey);
            } else {
              subscribePageProgress(sseTaskId, pageInfo.plotPageIdx, pageInfo.cacheKey);
            }
          } else {
            pendingChapterEventsRef.current.push({ id: queueItemId, taskId: sseTaskId });
          }
          return;
        }

        if (sessionPhaseRef.current === 'end') {
          setIsEndGenerating(true);
          progressShow(sseTaskId, {
            onComplete: (data) => {
              setIsEndGenerating(false);
              if (data.result?.imageUrl) {
                updateSession({ endImageUrl: data.result.imageUrl });
              }
            },
            onError: () => setIsEndGenerating(false),
            onCancelled: () => setIsEndGenerating(false),
          });
          return;
        }

        // Intro-phase task
        setIsGenerating(true);
        progressShow(sseTaskId, {
          onComplete: (data) => {
            setIsGenerating(false);
            if (data.result?.imageUrl) {
              updateSession({ introImageUrl: data.result.imageUrl });
            }
          },
          onError: () => setIsGenerating(false),
          onCancelled: () => setIsGenerating(false),
        });
      },
    });
  }, [progressShow, subscribePageProgress, subscribeVoiceProgress, updateSession]);

  // Reconnect recovery
  useEffect(() => {
    return queueSSEManager.onConnect(() => {
      const sess = sessionRef.current;
      const data = playDataRef.current;
      const plot = currentPlotRef.current;
      if (sess.phase === 'plot' && plot && data) {
        const timelineEntry = (sess.timeline || [])[sess.timelineIndex ?? 0];
        const storedSlotState = timelineEntry?.slotStateAtEntry;
        const initialSlotStatuses =
          storedSlotState && Object.keys(storedSlotState).length > 0
            ? new Map(Object.entries(storedSlotState))
            : null;
        initChapterRef.current?.(plot, sess, data, initialSlotStatuses);
      } else {
        fetch('/queue/status')
          .then(r => r.json())
          .catch(err => console.error('[AnyTalePlayPage] Reconnect status fetch failed:', err));
      }
    });
  }, []);

  // --- Bootstrap / restore on data load ---

  useEffect(() => {
    globalBgmPlayer.setGain(0.1);
    loadPlayData()
      .then(data => setPlayData(data))
      .catch(err => {
        console.error('[AnyTalePlayPage] Failed to load play data:', err);
        setError('Failed to load data. Please refresh.');
      });
  }, []);

  useEffect(() => {
    if (!playData) return;

    const introPlotName = (playData.config.introductionPlotName || 'introduction').toLowerCase();
    const foundIntroPl = (playData.plots || []).find(
      p => p.name.toLowerCase() === introPlotName
    );
    if (!foundIntroPl) {
      setError(
        `Introduction plot "${introPlotName}" not found. ` +
        'Please create a plot with that name in the AnyTale editor.'
      );
      return;
    }

    fetchJson(`/anytale/plot/${foundIntroPl.uid}`)
      .then(fullIntroPl => {
        setIntroPlot(fullIntroPl);

        const current = loadSession();
        if (current.character.uid) {
          setSession(current);
          if (current.phase !== 'plot' && current.phase !== 'end' && !current.introImageUrl) {
            generateIntroImage(current, fullIntroPl, playData);
          }
          return;
        }

        // Cold start bootstrap
        const partsMap = new Map((playData.parts || []).map(p => [p.uid, p]));

        const eligibleChars = (playData.characters || []).filter(c => c.parts && c.parts.length > 0);
        if (eligibleChars.length === 0) {
          setError('No characters with parts found. Please create characters in the AnyTale editor.');
          return;
        }
        const character = randomPickN(eligibleChars, 1)[0];

        const preferredUids = character.preferredOutfits || [];
        const eligibleOutfits = preferredUids.length > 0
          ? (playData.outfits || []).filter(o => preferredUids.includes(o.uid))
          : (playData.outfits || []);
        const outfit = eligibleOutfits.length > 0 ? randomPickN(eligibleOutfits, 1)[0] : null;

        const locationParts = (playData.parts || []).filter(
          p => Array.isArray(p.type) && p.type.some(t => t.toLowerCase() === 'location')
        );
        if (locationParts.length === 0) {
          setError('No location parts found. Please add location-typed parts in the AnyTale editor.');
          return;
        }
        const locationPart = randomPickN(locationParts, 1)[0];
        const locationAttributeMap = {};
        for (const attr of (locationPart.attributes || [])) {
          const opts = splitOptions(attr.options);
          if (opts.length > 0) locationAttributeMap[attr.name] = randomPickN(opts, 1)[0];
        }

        const allGenres = playData.genres || [];
        const eligibleGenres = allGenres.filter(g => !g.disabled);
        const genres = eligibleGenres.length > 0 ? eligibleGenres : allGenres;
        const genre = genres.length > 0 ? randomPickN(genres, 1)[0] : null;

        const allActiveParts = [
          ...(character.parts || []),
          ...(outfit ? outfit.parts : []),
        ];
        const slotState = computeSlotState(allActiveParts, partsMap);

        const preludePlots = (playData.plots || []).filter(
          p => (p.section || '').toLowerCase() === 'prelude'
        );
        if (preludePlots.length === 0) {
          setError(
            'No prelude section plots found. ' +
            'Please create plots with section "prelude" in the AnyTale editor.'
          );
          return;
        }
        const satisfying = preludePlots.filter(
          p => checkSlotRequirements(slotState, p.slotRequirements || {})
        );
        const preludePlot = randomPickN(satisfying.length > 0 ? satisfying : preludePlots, 1)[0];

        const newSession = {
          ...loadSession(),
          character: {
            uid: character.uid,
            name: character.name,
            personality: character.personality || '',
            selfProfile: character.selfProfile || '',
            portraitUrl: character.portraitUrl || '',
            voiceSampleUrl: character.voiceSampleUrl || character.audioUrl || '',
            introTranscript: character.introTranscript || '',
            parts: character.parts || [],
          },
          outfitUid: outfit ? outfit.uid : '',
          location: { partUid: locationPart.uid, attributeMap: locationAttributeMap },
          music: { genre: genre ? genre.name : '' },
          slotState,
          preludePlotUid: preludePlot.uid,
          phase: 'intro-main',
          introImageUrl: null,
          endImageUrl: null,
          timeline: [],
          timelineIndex: 0,
        };
        applySession(newSession);
        generateIntroImage(newSession, fullIntroPl, playData);
      })
      .catch(err => {
        console.error('[AnyTalePlayPage] Failed to fetch intro plot:', err);
        setError('Failed to load introduction plot. Please refresh.');
      });
  }, [playData, generateIntroImage, applySession]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- BGM control ---

  useEffect(() => {
    if (!audioUnlocked || !playData || !session.music?.genre) return;
    if (globalBgmPlayer.isPlaying()) return;
    const genres = playData.genres || [];
    const genre = genres.find(g => g.name === session.music.genre);
    if (!genre || !genre.tracks?.length) return;
    const shuffled = randomPickN(genre.tracks, genre.tracks.length);
    globalBgmPlayer.setPlaylist(shuffled.map(t => ({ url: t.audioUrl, label: t.name })));
    globalBgmPlayer.setTransition({ mode: 'crossfade', durationSeconds: 2 });
    if (session.musicOn) {
      globalBgmPlayer.play().catch(() => {});
    }
  }, [audioUnlocked, playData, session.music?.genre]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session.musicOn) {
      if (!globalBgmPlayer.isPlaying()) {
        const genres = playData?.genres || [];
        const genre = genres.find(g => g.name === session.music?.genre);
        if (genre?.tracks?.length) {
          const shuffled = randomPickN(genre.tracks, genre.tracks.length);
          globalBgmPlayer.setPlaylist(shuffled.map(t => ({ url: t.audioUrl, label: t.name })));
          globalBgmPlayer.setTransition({ mode: 'crossfade', durationSeconds: 2 });
        }
        globalBgmPlayer.play().catch(() => {});
      }
    } else {
      if (globalBgmPlayer.isPlaying()) globalBgmPlayer.stop();
    }
  }, [session.musicOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Voice playback ---

  useEffect(() => {
    if (session.phase !== 'plot' || !currentPlot) return;
    globalAudioPlayer.stop();
  }, [session.pageIndex, session.phase, currentPlot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session.phase !== 'plot' || !currentPlot) return;
    // Decision page (virtual index = length) has no image/voice of its own — skip transition
    if (session.pageIndex >= visiblePageIndices.length) return;
    const plotIdx = visiblePageIndices[session.pageIndex];
    if (plotIdx == null) return;

    const imgUrl = pageImageUrls[plotIdx];
    if (!imgUrl || pageStatuses[plotIdx] !== 'complete') return;

    const isNewTransition = imgUrl !== displayedImageUrl;

    if (isNewTransition) {
      const img = new Image();
      img.src = imgUrl;
    }

    const voiceApplicable = !session.muted && !!session.character.voiceSampleUrl;
    const vs = pageVoiceStatuses[plotIdx];
    const voiceSettled = !voiceApplicable ||
      vs === 'complete' || vs === 'skipped' || vs === 'error' ||
      pageDialogTexts[plotIdx] === null;
    if (!voiceSettled || !isNewTransition) return;

    setDisplayedImageUrl(imgUrl);
    if (!session.muted && pageVoiceUrls[plotIdx]) {
      globalAudioPlayer.play(pageVoiceUrls[plotIdx]);
    }
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    session.phase, session.pageIndex, session.muted, session.character.voiceSampleUrl,
    currentPlot, visiblePageIndices, pageImageUrls, pageStatuses,
    pageVoiceStatuses, pageDialogTexts, pageVoiceUrls, displayedImageUrl,
  ]);

  // Handle mute toggle
  useEffect(() => {
    if (session.phase !== 'plot' || !currentPlot) return;

    if (session.muted) {
      globalAudioPlayer.stop();

      for (const plotPageIdx of visiblePageIndices) {
        if (pageVoiceStatuses[plotPageIdx] !== 'generating') continue;
        const cacheKey = buildCacheKey({
          plotUid: currentPlot.uid,
          pageIndex: plotPageIdx,
          characterUid: session.character.uid,
          outfitUid: session.outfitUid,
          locationPartUid: session.location.partUid,
          locationAttributeMap: session.location.attributeMap,
          slotStatuses: pageSlotStatuses[plotPageIdx],
        });
        const entry = getCacheEntry(cacheKey);
        if (entry?.voiceTaskId) {
          fetch(`/queue/item/${entry.voiceTaskId}`, { method: 'DELETE' }).catch(() => {});
        }
        setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'skipped' }));
        updateCacheEntry(cacheKey, { voiceStatus: 'skipped', voiceTaskId: null });
      }
    } else if (session.character.voiceSampleUrl) {
      const currentPlotIdx = visiblePageIndices[session.pageIndex];
      const currentVoiceUrl = pageVoiceUrls[currentPlotIdx];
      if (currentVoiceUrl) globalAudioPlayer.play(currentVoiceUrl);

      let anyVoiceReset = false;
      for (const plotPageIdx of visiblePageIndices) {
        const cacheKey = buildCacheKey({
          plotUid: currentPlot.uid,
          pageIndex: plotPageIdx,
          characterUid: session.character.uid,
          outfitUid: session.outfitUid,
          locationPartUid: session.location.partUid,
          locationAttributeMap: session.location.attributeMap,
          slotStatuses: pageSlotStatuses[plotPageIdx],
        });
        const entry = getCacheEntry(cacheKey);
        if (entry?.dialogText && entry?.voiceStatus === 'skipped') {
          updateCacheEntry(cacheKey, { voiceStatus: 'pending' });
          anyVoiceReset = true;
        }
      }

      if (anyVoiceReset) {
        const timelineEntry = (session.timeline || [])[session.timelineIndex ?? 0];
        const storedSlotState = timelineEntry?.slotStateAtEntry;
        const initialSlotStatuses =
          storedSlotState && Object.keys(storedSlotState).length > 0
            ? new Map(Object.entries(storedSlotState))
            : null;
        initChapterRef.current?.(currentPlot, session, playDataRef.current, initialSlotStatuses);
      }
    }
  }, [session.muted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intro voice playback
  useEffect(() => {
    if (session.phase !== 'intro-main' || !audioUnlocked || session.muted) return;
    if (!session.character.voiceSampleUrl || !session.character.introTranscript) return;
    if (isGenerating || !session.introImageUrl) return;
    if (introVoicePlayedForRef.current === session.character.uid) return;
    introVoicePlayedForRef.current = session.character.uid;
    globalAudioPlayer.play(session.character.voiceSampleUrl);
  }, [session.phase, session.character.uid, audioUnlocked, session.muted, isGenerating, session.introImageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamic voice reprioritization
  useEffect(() => {
    if (session.phase !== 'plot' || !currentPlot) return;
    const plotPageIdx = visiblePageIndices[session.pageIndex];
    if (plotPageIdx === undefined) return;
    if (pageVoiceStatuses[plotPageIdx] !== 'generating') return;

    const entry = getCacheEntry(buildCacheKey({
      plotUid: currentPlot.uid,
      pageIndex: plotPageIdx,
      characterUid: session.character.uid,
      outfitUid: session.outfitUid,
      locationPartUid: session.location.partUid,
      locationAttributeMap: session.location.attributeMap,
      slotStatuses: pageSlotStatuses[plotPageIdx],
    }));
    const voiceTaskId = entry?.voiceTaskId;
    if (!voiceTaskId) return;

    fetch('/queue/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: voiceTaskId, toIndex: 1 }),
    }).catch(() => {});
  }, [session.pageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Autoplay ---

  useEffect(() => {
    if (!isAutoplay || !currentPlot) return;

    const nextVisIdx = session.pageIndex + 1;
    const isAdvancingToDecisionPage = nextVisIdx === visiblePageIndices.length;

    // Already at or past the decision page — nothing to advance to
    if (nextVisIdx > visiblePageIndices.length) return;

    // For content→content advance, the next content page must be fully loaded
    if (!isAdvancingToDecisionPage) {
      const nextPlotPageIdx = visiblePageIndices[nextVisIdx];
      if (pageStatuses[nextPlotPageIdx] !== 'complete') return;
    }

    // What happens when the timer fires: advance to decision page, or cross to next chapter.
    // Read session from ref inside the callback to avoid stale-closure issues.
    const doAdvance = () => {
      const sess = sessionRef.current;
      if (isAdvancingToDecisionPage) {
        const nextTlIdx = (sess.timelineIndex ?? 0) + 1;
        const nextTlEntry = (sess.timeline || [])[nextTlIdx];
        if (nextTlEntry) {
          // Completed chapter: skip the decision page and go straight to next chapter
          setCurrentPlot(null);
          setVisiblePageIndices([]);
          updateSession({ currentPlotUid: nextTlEntry.plotUid, timelineIndex: nextTlIdx, pageIndex: 0 });
        } else {
          // No successor yet: advance to the decision page
          updateSession({ pageIndex: nextVisIdx });
        }
      } else {
        updateSession({ pageIndex: nextVisIdx });
      }
    };

    const currentPlotPageIdx = visiblePageIndices[session.pageIndex];
    const currentVoiceUrl = pageVoiceUrls[currentPlotPageIdx];
    const currentDialogText = pageDialogTexts[currentPlotPageIdx];

    if (!session.muted && currentVoiceUrl) {
      let timer = null;
      const scheduleAdvance = () => {
        if (timer !== null) return;
        timer = setTimeout(doAdvance, 3000);
      };

      if (!globalAudioPlayer.isPlaying(currentVoiceUrl)) {
        scheduleAdvance();
        return () => { if (timer !== null) clearTimeout(timer); };
      }

      const unsubscribe = globalAudioPlayer.subscribe(() => {
        if (!globalAudioPlayer.isPlaying(currentVoiceUrl)) {
          scheduleAdvance();
          unsubscribe();
        }
      });

      return () => {
        unsubscribe();
        if (timer !== null) clearTimeout(timer);
      };
    }

    const delay = 5000 + (currentDialogText ? 3000 : 0);
    const timer = setTimeout(doAdvance, delay);
    return () => clearTimeout(timer);
  }, [isAutoplay, session.pageIndex, session.muted, pageStatuses, pageVoiceUrls, pageDialogTexts, visiblePageIndices, currentPlot, updateSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Reset ---

  const doReset = useCallback(() => {
    // Abort any in-progress dialog generation
    dialogAbortControllerRef.current?.abort();
    dialogAbortControllerRef.current = null;

    fetch('/queue/items/source/anytale-play', { method: 'DELETE' })
      .catch(err => console.error('[AnyTalePlayPage] Failed to cancel play queue items:', err));

    globalAudioPlayer.stop();
    globalBgmPlayer.stop();

    taskToPageRef.current.clear();
    pendingChapterEventsRef.current = [];
    dialogHistoryRef.current = [];

    clearAllCache();

    clearSession();
    setSession(loadSession());
    clearPlayDataCache();
    setIntroPlot(null);
    setError(null);
    setIsGenerating(false);
    setIsEndGenerating(false);
    setCurrentPlot(null);
    setVisiblePageIndices([]);
    setPageSlotStatuses([]);
    setPageImageUrls({});
    setPageStatuses({});
    setPageDialogTexts({});
    setPageVoiceUrls({});
    setPageVoiceStatuses({});
    setIsAutoplay(false);
    setDisplayedImageUrl('media/anytale-background.png');
    setPlayData(null);
    loadPlayData()
      .then(data => setPlayData(data))
      .catch(err => {
        console.error('[AnyTalePlayPage] Failed to reload play data:', err);
        setError('Failed to reload data. Please refresh.');
      });
  }, []);

  const handleReset = useCallback(() => {
    showModal({
      title: 'Start over?',
      size: 'small',
      content: html`<p>All progress will be lost and a new story will begin.</p>`,
      footer: [
        { label: 'Cancel', color: 'secondary', onClick: () => {} },
        { label: 'Start over', color: 'primary', onClick: doReset },
      ],
    });
  }, [doReset]);

  // --- Intro phase transitions ---

  const enterCharacterPick = useCallback(() => {
    if (!playData) return;
    globalAudioPlayer.stop();
    const others = (playData.characters || []).filter(
      c => c.parts?.length > 0 && c.uid !== session.character.uid
    );
    setCharDraft(randomPickN(others, 3));
    updateSession({ phase: 'character-pick' });
  }, [playData, session.character.uid, updateSession]);

  const rerollChars = useCallback(() => {
    if (!playData) return;
    const others = (playData.characters || []).filter(
      c => c.parts?.length > 0 && c.uid !== session.character.uid
    );
    setCharDraft(randomPickN(others, 3));
  }, [playData, session.character.uid]);

  const pickCharacter = useCallback((char) => {
    if (!playData || !introPlot) return;
    const partsMap = new Map((playData.parts || []).map(p => [p.uid, p]));
    const preferredUids = char.preferredOutfits || [];
    const eligible = preferredUids.length > 0
      ? (playData.outfits || []).filter(o => preferredUids.includes(o.uid))
      : (playData.outfits || []);
    const outfit = eligible.length > 0 ? randomPickN(eligible, 1)[0] : null;
    const slotState = computeSlotState(
      [...(char.parts || []), ...(outfit ? outfit.parts : [])],
      partsMap
    );
    setSession(prev => {
      const next = {
        ...prev,
        character: {
          uid: char.uid, name: char.name,
          personality: char.personality || '',
          selfProfile: char.selfProfile || '',
          portraitUrl: char.portraitUrl || '',
          voiceSampleUrl: char.voiceSampleUrl || char.audioUrl || '',
          introTranscript: char.introTranscript || '',
          parts: char.parts || [],
        },
        outfitUid: outfit ? outfit.uid : '',
        slotState,
        phase: 'intro-main',
        introImageUrl: null,
      };
      saveSession(next);
      generateIntroImage(next, introPlot, playData);
      return next;
    });
  }, [playData, introPlot, generateIntroImage]);

  const enterMood = useCallback(() => updateSession({ phase: 'intro-mood' }), [updateSession]);

  // "Begin the tale" — enter the chapter
  const beginTale = useCallback(() => {
    if (!playData || !session.preludePlotUid) return;
    // Initialise timeline with the first chapter; pageCount and slotStateAtEntry are filled in by initChapter.
    updateSession({
      phase: 'plot',
      currentPlotUid: session.preludePlotUid,
      pageIndex: 0,
      timelineIndex: 0,
      timeline: [{ plotUid: session.preludePlotUid, pageCount: 0, slotStateAtEntry: {} }],
    });
  }, [playData, session.preludePlotUid, updateSession]);

  const enterOutfitPick = useCallback(() => {
    if (!playData) return;
    const eligible = (playData.outfits || []).filter(o => o.uid !== session.outfitUid);
    setOutfitDraft(randomPickN(eligible, 3));
    updateSession({ phase: 'outfit-pick' });
  }, [playData, session.outfitUid, updateSession]);

  const pickOutfit = useCallback((outfit) => {
    if (!playData || !introPlot) return;
    const partsMap = new Map((playData.parts || []).map(p => [p.uid, p]));
    const slotState = computeSlotState(
      [...(session.character.parts || []), ...(outfit.parts || [])],
      partsMap
    );
    setSession(prev => {
      const next = { ...prev, outfitUid: outfit.uid, slotState, phase: 'intro-main' };
      saveSession(next);
      generateIntroImage(next, introPlot, playData);
      return next;
    });
  }, [playData, introPlot, session.character.parts, generateIntroImage]);

  const enterLocationPick = useCallback(() => {
    if (!playData) return;
    const locationParts = (playData.parts || []).filter(
      p => Array.isArray(p.type) && p.type.some(t => t.toLowerCase() === 'location')
    );
    setLocationDraft(randomPickN(locationParts.filter(p => p.uid !== session.location.partUid), 3));
    updateSession({ phase: 'location-pick' });
  }, [playData, session.location.partUid, updateSession]);

  const pickLocation = useCallback((locPart) => {
    const attrs = locPart.attributes || [];
    const attributeMap = {};
    for (const attr of attrs) {
      const opts = splitOptions(attr.options);
      if (opts.length > 0) attributeMap[attr.name] = randomPickN(opts, 1)[0];
    }
    setSession(prev => {
      const next = {
        ...prev, phase: 'intro-main',
        location: { partUid: locPart.uid, attributeMap },
      };
      saveSession(next);
      if (introPlot && playData) generateIntroImage(next, introPlot, playData);
      return next;
    });
  }, [introPlot, playData, generateIntroImage]);

  const enterMusicPick = useCallback(() => {
    const allGenres = playData?.genres || [];
    const eligibleGenres = allGenres.filter(g => !g.disabled);
    const genres = eligibleGenres.length > 0 ? eligibleGenres : allGenres;
    setGenreDraft(randomPickN(genres, 3));
    updateSession({ phase: 'music-pick' });
  }, [playData, updateSession]);

  const pickGenre = useCallback((genre) => {
    const tracks = genre.tracks || [];
    if (tracks.length > 0) {
      const shuffled = randomPickN(tracks, tracks.length);
      globalBgmPlayer.stop();
      globalBgmPlayer.setPlaylist(shuffled.map(t => ({ url: t.audioUrl, label: t.name })));
      globalBgmPlayer.setTransition({ mode: 'crossfade', durationSeconds: 2 });
      globalBgmPlayer.play().catch(err => console.error('[AnyTalePlayPage] BGM play failed:', err));
    }
    updateSession({ music: { genre: genre.name }, phase: 'intro-mood' });
  }, [updateSession]);

  // --- Chapter navigation ---

  const goToPrev = useCallback(() => {
    setIsAutoplay(false);
    const sess = sessionRef.current;

    if (sess.pageIndex > 0) {
      // Simple: go to previous page within this chapter
      updateSession({ pageIndex: sess.pageIndex - 1 });
      return;
    }

    // At first page: go back to the previous chapter in the timeline
    const prevTimelineIndex = (sess.timelineIndex ?? 0) - 1;
    if (prevTimelineIndex < 0) return; // no previous chapter

    const prevEntry = (sess.timeline || [])[prevTimelineIndex];
    if (!prevEntry) return;

    const prevPageIndex = Math.max(0, (prevEntry.pageCount || 1) - 1);

    // Clear current chapter state so we show loading while prev chapter re-initialises
    setCurrentPlot(null);
    setVisiblePageIndices([]);

    updateSession({
      currentPlotUid: prevEntry.plotUid,
      timelineIndex: prevTimelineIndex,
      pageIndex: prevPageIndex,
    });
  }, [updateSession]);

  const goToNext = useCallback(() => {
    const indices = visiblePageIndicesRef.current;
    const sess = sessionRef.current;
    if (sess.pageIndex < indices.length) {
      // Within-chapter advance (includes advancing to the decision page)
      setSession(prev => {
        if (prev.pageIndex >= indices.length) return prev;
        const next = { ...prev, pageIndex: prev.pageIndex + 1 };
        saveSession(next);
        return next;
      });
      return;
    }
    // At decision page of a completed chapter: advance to the next completed chapter
    const nextTlIdx = (sess.timelineIndex ?? 0) + 1;
    const nextEntry = (sess.timeline || [])[nextTlIdx];
    if (!nextEntry) return;
    setCurrentPlot(null);
    setVisiblePageIndices([]);
    updateSession({ currentPlotUid: nextEntry.plotUid, timelineIndex: nextTlIdx, pageIndex: 0 });
  }, [updateSession]);

  const startAutoplay = useCallback(() => setIsAutoplay(true), []);
  const stopAutoplay = useCallback(() => setIsAutoplay(false), []);

  const handleToggleMute = useCallback(() => {
    const next = !session.muted;
    patchPrefs({ muted: next });
    updateSession({ muted: next });
  }, [session.muted, updateSession]);

  const handleToggleMusic = useCallback(() => {
    const next = !session.musicOn;
    patchPrefs({ musicOn: next });
    updateSession({ musicOn: next });
  }, [session.musicOn, updateSession]);

  // --- Chapter decision (end-of-chapter branching) ---

  /**
   * Compute post-chapter slot state as a plain object for use with checkSlotRequirements.
   * The post-chapter state is the slot statuses after ALL plot pages (including hidden ones).
   */
  const getPostChapterSlotStateObj = useCallback(() => {
    if (!currentPlot || !pageSlotStatuses.length) return {};
    const lastIdx = currentPlot.pages.length - 1;
    const lastMap = pageSlotStatuses[lastIdx];
    return lastMap ? Object.fromEntries(lastMap) : {};
  }, [currentPlot, pageSlotStatuses]);

  const handleChapterChoice = useCallback((chosenPlot) => {
    const postChapterSlotState = getPostChapterSlotStateObj();

    const newTimeline = [
      ...(sessionRef.current.timeline || []),
      { plotUid: chosenPlot.uid, pageCount: 0, slotStateAtEntry: postChapterSlotState },
    ];
    const newTimelineIndex = newTimeline.length - 1;

    // Clear current chapter state to show loading immediately
    setCurrentPlot(null);
    setVisiblePageIndices([]);

    updateSession({
      currentPlotUid: chosenPlot.uid,
      timeline: newTimeline,
      timelineIndex: newTimelineIndex,
      pageIndex: 0,
    });
  }, [getPostChapterSlotStateObj, updateSession]);

  /**
   * Build the decision options array shown at the end of a chapter.
   * Defined after handleChapterChoice so it can safely reference it in deps.
   * Returns an array of PortraitPanel decision option objects.
   */
  const computeChapterDecisions = useCallback(() => {
    if (!currentPlot || !playData) return [];
    const postChapterSlotState = getPostChapterSlotStateObj();
    const progressionSections = currentPlot.progressionSections || [];

    // --- Chapter candidates ---
    let candidates = [];
    if (progressionSections.length > 0) {
      const sectionMatches = (playData.plots || []).filter(
        p => progressionSections.includes(p.section)
      );
      // Primary: section match + slot requirements satisfied
      const primary = sectionMatches.filter(
        p => checkSlotRequirements(postChapterSlotState, p.slotRequirements || {})
      );
      candidates = primary.length > 0 ? primary : sectionMatches;
    }

    const decisions = candidates.map(plot => ({
      text: plot.description || plot.name,
      onClick: () => handleChapterChoice(plot),
    }));

    // --- "Let's say goodbye" epilogue option (always present) ---
    const epiloguePlots = (playData.plots || []).filter(
      p => (p.section || '').toLowerCase() === 'epilogue'
    );
    const satisfyingEpilogues = epiloguePlots.filter(
      p => checkSlotRequirements(postChapterSlotState, p.slotRequirements || {})
    );
    const epiloguePlot = randomPickN(
      satisfyingEpilogues.length > 0 ? satisfyingEpilogues : epiloguePlots,
      1
    )[0];

    if (epiloguePlot) {
      decisions.push({
        text: "Let's say goodbye for now",
        onClick: () => handleChapterChoice(epiloguePlot),
      });
    }

    return decisions;
  }, [currentPlot, playData, getPostChapterSlotStateObj, handleChapterChoice]);

  // --- Render ---

  if (!audioUnlocked) {
    const handleStart = () => {
      setAudioUnlocked(true);
      if (session.musicOn && session.music?.genre && playData) {
        const genres = playData.genres || [];
        const genre = genres.find(g => g.name === session.music.genre);
        if (genre?.tracks?.length && !globalBgmPlayer.isPlaying()) {
          const shuffled = randomPickN(genre.tracks, genre.tracks.length);
          globalBgmPlayer.setPlaylist(shuffled.map(t => ({ url: t.audioUrl, label: t.name })));
          globalBgmPlayer.setTransition({ mode: 'crossfade', durationSeconds: 2 });
          globalBgmPlayer.play().catch(() => {});
        }
      }
    };
    return html`
      <${PortraitPanel}
        mode="start"
        backgroundUrl=${session.introImageUrl || 'media/anytale-background.png'}
        onStart=${handleStart}
      />
    `;
  }

  if (error) {
    return html`
      <${PortraitPanel}
        mode="page"
        bubbleText=${error}
        onReset=${handleReset}
      />
    `;
  }

  if (!playData || !session.character.uid) {
    return html`<${PortraitPanel} mode="loading" />`;
  }

  const { phase } = session;

  // ── End phase ────────────────────────────────────────────────────────────────
  if (phase === 'end') {
    const endMode = (!session.endImageUrl || isEndGenerating) ? 'loading' : 'decision';

    const backFromEnd = () => {
      // Navigate back to the last chapter in the timeline (epilogue)
      const lastTimelineIndex = (session.timeline || []).length - 1;
      if (lastTimelineIndex < 0) {
        updateSession({ phase: 'plot' });
        return;
      }
      const lastEntry = session.timeline[lastTimelineIndex];
      const lastPageIndex = Math.max(0, (lastEntry.pageCount || 1) - 1);
      setCurrentPlot(null);
      setVisiblePageIndices([]);
      updateSession({
        phase: 'plot',
        currentPlotUid: lastEntry.plotUid,
        timelineIndex: lastTimelineIndex,
        pageIndex: lastPageIndex,
      });
    };

    return html`
      <${PortraitPanel}
        mode=${endMode}
        backgroundUrl=${session.endImageUrl || displayedImageUrl}
        bubbleText="You have reached the end of this tale."
        bubbleType="caption"
        muted=${session.muted}
        musicEnabled=${session.musicOn}
        decisions=${[]}
        onBack=${backFromEnd}
        onReset=${handleReset}
        onToggleMute=${handleToggleMute}
        onToggleMusic=${handleToggleMusic}
      />
    `;
  }

  // ── Chapter (plot) phase ─────────────────────────────────────────────────
  if (phase === 'plot') {
    if (!currentPlot || visiblePageIndices.length === 0) {
      return html`
        <${PortraitPanel}
          mode="loading"
          muted=${session.muted}
          musicEnabled=${session.musicOn}
          onReset=${handleReset}
          onToggleMute=${handleToggleMute}
          onToggleMusic=${handleToggleMusic}
        />
      `;
    }

    // Virtual decision page sits at index === visiblePageIndices.length (one past last content page)
    const isAtDecisionPage = session.pageIndex === visiblePageIndices.length;
    const isAtLastContentPage = session.pageIndex === visiblePageIndices.length - 1;
    const isEpilogue = (currentPlot.section || '').toLowerCase() === 'epilogue';
    // A chapter is "completed" when a successor already exists in the timeline
    const isChapterCompleted =
      (session.timelineIndex ?? 0) + 1 < (session.timeline || []).length;

    // Use last content page's plot index when at decision page (for readiness + background image)
    const lastContentPlotPageIdx = visiblePageIndices[visiblePageIndices.length - 1];
    const currentPlotPageIdx = isAtDecisionPage
      ? lastContentPlotPageIdx
      : visiblePageIndices[session.pageIndex];
    const currentDialogText = isAtDecisionPage ? '' : (pageDialogTexts[currentPlotPageIdx] || '');

    const voiceApplicable = !session.muted && !!session.character.voiceSampleUrl;

    const isVoiceSettled = (plotIdx) => {
      const vs = pageVoiceStatuses[plotIdx];
      if (vs === 'complete' || vs === 'skipped' || vs === 'error') return true;
      if (pageDialogTexts[plotIdx] === null) return true;
      return false;
    };

    const currentPageReady =
      pageStatuses[currentPlotPageIdx] === 'complete' &&
      (!voiceApplicable || isVoiceSettled(currentPlotPageIdx));

    const loadedCount = visiblePageIndices.filter(i => {
      const imageReady = pageStatuses[i] === 'complete';
      if (!voiceApplicable) return imageReady;
      return imageReady && isVoiceSettled(i);
    }).length;
    const loadedPercent = visiblePageIndices.length > 0
      ? (loadedCount / visiblePageIndices.length) * 100 : 0;
    // Cap progress at 100% when at the virtual decision page
    const pageForProgress = Math.min(session.pageIndex, visiblePageIndices.length - 1);
    const currentPercent = visiblePageIndices.length > 0
      ? ((pageForProgress + 1) / visiblePageIndices.length) * 100 : 0;

    const chapterName = currentPlot.name || `Chapter ${(session.timelineIndex ?? 0) + 1}`;

    // Mode: decision at virtual page (not locked), loading if content page not ready, page otherwise.
    // Locked completed-chapter decision page falls through to 'page' mode (no decision buttons).
    const pageMode = (isAtDecisionPage && !isChapterCompleted) ? 'decision'
      : !currentPageReady ? 'loading'
      : 'page';

    // Navigation
    const canGoPrev = session.pageIndex > 0 || (session.timelineIndex ?? 0) > 0;
    // Forward: allow to decision page (from last content page, when ready and not epilogue),
    // or through a completed chapter's locked decision page to the next chapter.
    const canGoNext = isChapterCompleted
      ? isAtDecisionPage               // locked decision page → next chapter
      : !isAtDecisionPage && (!isAtLastContentPage || (currentPageReady && !isEpilogue));

    // Back button: only at the open (not locked) decision page (returns to last content page)
    const onBack = (isAtDecisionPage && !isChapterCompleted) ? goToPrev : undefined;

    // Play button: only on content pages that aren't the last (autoplay pauses before decision page)
    const onPlay = (currentPageReady && !isAtLastContentPage && !isAtDecisionPage) ? startAutoplay : undefined;

    // Decision page background = last content page's image; caption is hardcoded
    const backgroundUrl = isAtDecisionPage
      ? (pageImageUrls[lastContentPlotPageIdx] || displayedImageUrl)
      : displayedImageUrl;
    const bubbleText = isAtDecisionPage
      ? (isChapterCompleted ? '' : "What's your next move?")
      : (currentPageReady ? currentDialogText : '');

    // Chapter decisions: computed only at the open (not locked) decision page
    const chapterDecisions = (isAtDecisionPage && !isChapterCompleted) ? computeChapterDecisions() : [];

    // Error: open decision page but no options available
    const hasNoOptions = isAtDecisionPage && !isChapterCompleted && chapterDecisions.length === 0;

    if (hasNoOptions) {
      return html`
        <${PortraitPanel}
          mode="page"
          backgroundUrl=${backgroundUrl}
          bubbleText="No story options found. Please check your plot configuration."
          muted=${session.muted}
          musicEnabled=${session.musicOn}
          onReset=${handleReset}
          onToggleMute=${handleToggleMute}
          onToggleMusic=${handleToggleMusic}
        />
      `;
    }

    return html`
      <${PortraitPanel}
        mode=${pageMode}
        backgroundUrl=${backgroundUrl}
        bubbleText=${bubbleText}
        bubbleType="caption"
        muted=${session.muted}
        musicEnabled=${session.musicOn}
        chapter=${chapterName}
        page=${session.pageIndex + 1}
        loadedPercent=${loadedPercent}
        currentPercent=${currentPercent}
        isAutoplay=${isAutoplay}
        onPrev=${canGoPrev ? goToPrev : undefined}
        onPlay=${onPlay}
        onStop=${stopAutoplay}
        onNext=${canGoNext ? goToNext : undefined}
        onBack=${onBack}
        decisions=${chapterDecisions}
        onReset=${handleReset}
        onToggleMute=${handleToggleMute}
        onToggleMusic=${handleToggleMusic}
      />
    `;
  }

  // ── Intro phases ─────────────────────────────────────────────────────────
  const panelMode = isGenerating || !session.introImageUrl ? 'loading' : 'decision';

  let decisions = [];
  let bubbleText = '';
  let bubbleType = 'caption';
  let onBack = null;

  if (phase === 'intro-main' && panelMode === 'decision') {
    bubbleText = session.character.introTranscript ||
      (session.character.name ? `Hello, I'm ${session.character.name}.` : '');
    bubbleType = 'speech';
    decisions = [
      { text: 'Let me meet someone else', onClick: enterCharacterPick },
      { text: "The mood isn't right", onClick: enterMood },
      { text: 'Begin the tale', onClick: beginTale },
    ];

  } else if (phase === 'intro-mood') {
    bubbleText = 'What would you like to change?';
    onBack = () => updateSession({ phase: 'intro-main' });
    decisions = [
      { text: 'Maybe try on a different outfit?', onClick: enterOutfitPick },
      { text: "Let's go somewhere else.", onClick: enterLocationPick },
      { text: "Let's listen to something different.", onClick: enterMusicPick },
    ];

  } else if (phase === 'character-pick') {
    bubbleText = 'Who would you like to meet?';
    onBack = () => updateSession({ phase: 'intro-main' });
    decisions = [
      ...charDraft.map(char => ({
        text: char.name,
        subtitle: char.selfProfile || undefined,
        image: char.portraitUrl || undefined,
        onClick: () => pickCharacter(char),
      })),
      { text: 'Maybe someone else?', onClick: rerollChars },
      {
        text: "I'm feeling lucky!",
        onClick: () => {
          const allChars = (playData.characters || []).filter(c => c.parts?.length > 0);
          const char = randomPickN(allChars, 1)[0];
          if (char) pickCharacter(char);
        },
      },
    ];

  } else if (phase === 'outfit-pick') {
    bubbleText = 'Pick a different outfit.';
    onBack = () => updateSession({ phase: 'intro-mood' });
    decisions = [
      ...outfitDraft.map(outfit => ({
        text: outfit.name,
        subtitle: outfit.description || undefined,
        image: outfit.renderUrl || undefined,
        onClick: () => pickOutfit(outfit),
      })),
      { text: 'Nevermind', onClick: () => updateSession({ phase: 'intro-mood' }) },
      {
        text: "I'm feeling lucky!",
        onClick: () => {
          const outfit = randomPickN(playData.outfits || [], 1)[0];
          if (outfit) pickOutfit(outfit);
        },
      },
    ];

  } else if (phase === 'location-pick') {
    bubbleText = 'Where would you like to go?';
    onBack = () => updateSession({ phase: 'intro-mood' });
    const allLocParts = (playData.parts || []).filter(
      p => Array.isArray(p.type) && p.type.some(t => t.toLowerCase() === 'location')
    );
    decisions = [
      ...locationDraft.map(loc => ({
        text: loc.name,
        onClick: () => pickLocation(loc),
      })),
      {
        text: "I'm feeling lucky!",
        onClick: () => {
          const loc = randomPickN(allLocParts, 1)[0];
          if (loc) pickLocation(loc);
        },
      },
    ];

  } else if (phase === 'music-pick') {
    bubbleText = 'What kind of music sets the mood?';
    onBack = () => updateSession({ phase: 'intro-mood' });
    decisions = [
      ...genreDraft.map(genre => ({
        text: genre.name,
        onClick: () => pickGenre(genre),
      })),
      {
        text: "I'm feeling lucky!",
        onClick: () => {
          const genre = randomPickN(playData.genres || [], 1)[0];
          if (genre) pickGenre(genre);
        },
      },
    ];
  }

  return html`
    <${PortraitPanel}
      mode=${panelMode}
      backgroundUrl=${session.introImageUrl || 'media/anytale-background.png'}
      bubbleText=${bubbleText}
      bubbleType=${bubbleType}
      muted=${session.muted}
      musicEnabled=${session.musicOn}
      decisions=${decisions}
      onBack=${onBack}
      onReset=${handleReset}
      onToggleMute=${handleToggleMute}
      onToggleMusic=${handleToggleMusic}
    />
  `;
}
