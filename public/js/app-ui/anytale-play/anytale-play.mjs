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
import { assemblePrompt } from '../anytale/prompt-assembler.mjs';
import { fetchJson } from '../../custom-ui/util.mjs';
import { getClientId } from '../client-id.mjs';
import { queueSSEManager } from '../queue-sse-manager.mjs';
import { useProgress } from '../../custom-ui/msg/progress-context.mjs';
import { globalBgmPlayer, globalAudioPlayer } from '../../custom-ui/global-audio-player.mjs';
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

const CROSSFADE_MS = 600;

export function AnyTalePlayPage() {
  const [, setTheme] = useState(currentTheme.value);
  useEffect(() => currentTheme.subscribe(setTheme), []);

  const { show: progressShow } = useProgress();

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [playData, setPlayData] = useState(null);
  const [session, setSession] = useState(() => loadSession());
  const [isGenerating, setIsGenerating] = useState(false);
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

  // --- Chapter page image queuing ---

  // Accumulated dialog history for the current chapter (cleared on chapter entry / reset)
  const dialogHistoryRef = useRef([]);
  // Tracks which character UID intro voice was last played for — prevents replaying on outfit/location changes
  const introVoicePlayedForRef = useRef('');

  // Stable ref to latest values needed inside callbacks / effects
  const playDataRef = useRef(playData);
  const sessionRef = useRef(session);
  const visiblePageIndicesRef = useRef(visiblePageIndices);
  useEffect(() => { playDataRef.current = playData; }, [playData]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { visiblePageIndicesRef.current = visiblePageIndices; }, [visiblePageIndices]);

  // Maps queue item UUID (from HTTP 202) → { plotPageIdx, cacheKey, type: 'image'|'voice' }
  // Used to route queue:task-started events to the correct page subscriber
  const taskToPageRef = useRef(new Map());
  // Buffer for queue:task-started events that arrive before queuePageImage.then() fires
  const pendingChapterEventsRef = useRef([]);
  // Stable ref so initChapter's async loop can call queuePageSpeech after it's defined
  const queuePageSpeechRef = useRef(null);

  // Open a progress SSE subscription for a chapter page using the SSE task ID
  const subscribePageProgress = useCallback((sseTaskId, plotPageIdx, cacheKey) => {
    progressShow(sseTaskId, {
      onComplete: (result) => {
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
        setPageStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
        updateCacheEntry(cacheKey, { imageStatus: 'error' });
      },
      onCancelled: () => setPageStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' })),
    });
  }, [progressShow]);

  // Open a voice/speech SSE subscription for a chapter page
  const subscribeVoiceProgress = useCallback((sseTaskId, plotPageIdx, cacheKey) => {
    progressShow(sseTaskId, {
      onComplete: (result) => {
        if (result?.result?.audioUrl) {
          const url = result.result.audioUrl;
          setPageVoiceUrls(prev => ({ ...prev, [plotPageIdx]: url }));
          setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'complete' }));
          updateCacheEntry(cacheKey, { voiceUrl: url, voiceStatus: 'complete' });
          // Auto-play if this is the current page and not muted
          const sess = sessionRef.current;
          const vis = visiblePageIndicesRef.current;
          const currentPlotIdx = vis[sess.pageIndex];
          if (currentPlotIdx === plotPageIdx && !sess.muted) {
            globalAudioPlayer.play(url);
          }
        } else {
          setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
          updateCacheEntry(cacheKey, { voiceStatus: 'error' });
        }
      },
      onError: () => {
        setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
        updateCacheEntry(cacheKey, { voiceStatus: 'error' });
      },
      onCancelled: () => setPageVoiceStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' })),
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

      // Check if queue:task-started arrived before this .then() ran
      const earlyIdx = pendingChapterEventsRef.current.findIndex(e => e.id === queueItemId);
      if (earlyIdx !== -1) {
        const [earlyEvent] = pendingChapterEventsRef.current.splice(earlyIdx, 1);
        subscribePageProgress(earlyEvent.taskId, plotPageIdx, cacheKey);
      } else {
        // Store mapping so queue:task-started can find the page info when it arrives
        taskToPageRef.current.set(queueItemId, { plotPageIdx, cacheKey });
      }
    }).catch(err => {
      console.error('[AnyTalePlayPage] Failed to queue page image:', err);
      setPageStatuses(prev => ({ ...prev, [plotPageIdx]: 'error' }));
    });
  }, [subscribePageProgress]);

  // --- Dialog generation ---

  const queuePageDialog = useCallback(async (plotPageIdx, plot, sess, data, cacheKey, history = []) => {
    const page = plot.pages[plotPageIdx];
    const dialogPrompt = (page.dialogPrompt || '').trim();
    const personality = (sess.character.personality || '').trim();
    const locationAttrValue = Object.values(sess.location.attributeMap || {}).find(v => v) || '';
    const dialogConfig = data.config.dialog;

    console.log('[Dialog] page', plotPageIdx, { dialogPrompt, personality, locationAttrValue, dialogConfig: !!dialogConfig });

    if (!dialogPrompt || !personality || !locationAttrValue || !dialogConfig) {
      console.log('[Dialog] skipping page', plotPageIdx, { missingPrompt: !dialogPrompt, missingPersonality: !personality, missingLocation: !locationAttrValue, missingConfig: !dialogConfig });
      updateCacheEntry(cacheKey, { dialogText: null, dialogStatus: 'skipped' });
      setPageDialogTexts(prev => ({ ...prev, [plotPageIdx]: null }));
      return null;
    }

    updateCacheEntry(cacheKey, { dialogText: null, dialogStatus: 'generating' });

    const isStreaming = dialogConfig.stream === true;
    console.log('[Dialog] calling generateDialog for page', plotPageIdx, 'isStreaming:', isStreaming, 'generateDialog type:', typeof generateDialog);

    try {
      const text = await generateDialog({
        character: sess.character,
        locationAttributeValue: locationAttrValue,
        page,
        dialogConfig,
        history,
        onChunk: isStreaming ? (partial) => {
          setPageDialogTexts(prev => ({ ...prev, [plotPageIdx]: partial }));
        } : undefined,
      });
      console.log('[Dialog] page', plotPageIdx, 'result:', text);
      updateCacheEntry(cacheKey, { dialogText: text, dialogStatus: 'complete' });
      setPageDialogTexts(prev => ({ ...prev, [plotPageIdx]: text }));
      return text;
    } catch (err) {
      console.error('[Dialog] catch for page', plotPageIdx, err.name, err.message, err);
      updateCacheEntry(cacheKey, { dialogStatus: 'error' });
      // Treat error as no-dialog so isVoiceSettled returns true and the page can still show
      setPageDialogTexts(prev => ({ ...prev, [plotPageIdx]: null }));
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

  // Keep the ref in sync so queuePageDialog can call queuePageSpeech after definition
  useEffect(() => { queuePageSpeechRef.current = queuePageSpeech; }, [queuePageSpeech]);

  // --- Chapter initialization ---

  const initChapter = useCallback((plot, sess, data) => {
    dialogHistoryRef.current = [];

    const partsMap = new Map((data.parts || []).map(p => [p.uid, p]));
    const outfit = (data.outfits || []).find(o => o.uid === sess.outfitUid);
    const activeParts = buildActiveParts(sess, outfit ? outfit.parts : [], partsMap);

    const { visibleIndices, pageSlotStatuses: slotStatuses } = computeVisiblePages(
      activeParts,
      plot,
      data.config.slotRules || ''
    );

    setCurrentPlot(plot);
    setVisiblePageIndices(visibleIndices);
    setPageSlotStatuses(slotStatuses);

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
      } else {
        toQueueDialog.push({ plotPageIdx, cacheKey });
      }

      if (entry?.voiceStatus === 'complete' && entry.voiceUrl) {
        newVoiceUrls[plotPageIdx] = entry.voiceUrl;
        newVoiceStatuses[plotPageIdx] = 'complete';
      } else if (entry?.voiceStatus === 'skipped') {
        newVoiceStatuses[plotPageIdx] = 'skipped';
      }
      // voice for non-cached pages will be queued after dialog completes
    }

    setPageImageUrls(newImageUrls);
    setPageStatuses(newStatuses);
    setPageDialogTexts(newDialogTexts);
    setPageVoiceUrls(newVoiceUrls);
    setPageVoiceStatuses(newVoiceStatuses);

    // Build a set of pages that need image generation (for quick lookup below)
    const needsImage = new Set(toQueueImage.map(item => item.plotPageIdx));

    ;(async () => {
      console.log('[Queue] initChapter start — visibleIndices:', visibleIndices, 'toQueueDialog:', toQueueDialog.map(x => x.plotPageIdx), 'toQueueImage:', toQueueImage.map(x => x.plotPageIdx));

      // Step 1: all dialogs sequentially so each call includes prior-turn context
      for (const { plotPageIdx, cacheKey } of toQueueDialog) {
        console.log('[Queue] Step 1 — queuing dialog for page', plotPageIdx);
        const history = [...dialogHistoryRef.current];
        const text = await queuePageDialog(plotPageIdx, plot, sess, data, cacheKey, history);
        console.log('[Queue] Step 1 — dialog complete for page', plotPageIdx, '→', text ? `"${text.slice(0, 40)}…"` : 'null');
        const prompt = (plot.pages[plotPageIdx].dialogPrompt || '').trim();
        if (text && prompt) {
          dialogHistoryRef.current = [
            ...dialogHistoryRef.current,
            { role: 'user', content: prompt },
            { role: 'assistant', content: text },
          ];
        }
      }

      // Step 2+: for each page in visible order — image then TTS (if applicable)
      const voiceOn = !sess.muted && !!sess.character.voiceSampleUrl;
      console.log('[Queue] Step 2 start — voiceOn:', voiceOn);
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
          console.log('[Queue] Step 2 — queuing IMAGE for page', plotPageIdx);
          queuePageImage(plotPageIdx, plot, slotStatuses[plotPageIdx]);
        } else {
          console.log('[Queue] Step 2 — image already cached for page', plotPageIdx, '(skipping)');
        }

        if (voiceOn) {
          const entry = getCacheEntry(cacheKey);
          const dialogText = entry?.dialogText;
          const vs = entry?.voiceStatus;
          const voiceNeeded = dialogText && !['complete', 'generating', 'skipped', 'error'].includes(vs);
          console.log('[Queue] Step 2 — page', plotPageIdx, 'voiceNeeded:', voiceNeeded, '| dialogText:', dialogText ? `"${dialogText.slice(0, 30)}…"` : 'null', '| voiceStatus:', vs ?? 'undefined');
          if (voiceNeeded) {
            console.log('[Queue] Step 2 — queuing TTS for page', plotPageIdx);
            queuePageSpeechRef.current?.(plotPageIdx, dialogText, cacheKey);
          }
        }
      }
      console.log('[Queue] initChapter loop complete');
    })();
  }, [queuePageImage, queuePageDialog]);

  // Load chapter when phase is 'plot' and plot not yet loaded (or changed)
  useEffect(() => {
    if (session.phase !== 'plot') return;
    if (!session.currentPlotUid) return;
    if (!playData) return;
    if (currentPlot?.uid === session.currentPlotUid) return;

    fetchJson(`/anytale/plot/${session.currentPlotUid}`)
      .then(plot => initChapter(plot, session, playData))
      .catch(err => {
        console.error('[AnyTalePlayPage] Failed to load chapter:', err);
        updateSession({ phase: 'intro-main' });
      });
  }, [session.phase, session.currentPlotUid, playData, currentPlot?.uid, initChapter, updateSession]);

  // --- SSE subscriptions ---

  // Stable ref so the SSE handler can read current phase without re-subscribing
  const sessionPhaseRef = useRef(session.phase);
  useEffect(() => { sessionPhaseRef.current = session.phase; }, [session.phase]);

  useEffect(() => {
    return queueSSEManager.subscribe({
      'queue:task-started': ({ id: queueItemId, taskId: sseTaskId, source, clientId }) => {
        if (source !== 'anytale-play') return;
        if (clientId !== getClientId()) return;

        if (sessionPhaseRef.current === 'plot') {
          // Chapter page task (image or voice) — route via taskToPageRef
          const pageInfo = taskToPageRef.current.get(queueItemId);
          if (pageInfo) {
            taskToPageRef.current.delete(queueItemId);
            if (pageInfo.type === 'voice') {
              subscribeVoiceProgress(sseTaskId, pageInfo.plotPageIdx, pageInfo.cacheKey);
            } else {
              subscribePageProgress(sseTaskId, pageInfo.plotPageIdx, pageInfo.cacheKey);
            }
          } else {
            // .then() hasn't run yet — buffer for deferred processing
            pendingChapterEventsRef.current.push({ id: queueItemId, taskId: sseTaskId });
          }
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

  // Reconnect recovery: re-fetch queue status so any in-progress tasks are reflected
  useEffect(() => {
    return queueSSEManager.onConnect(() => {
      fetch('/queue/status')
        .then(r => r.json())
        .catch(err => console.error('[AnyTalePlayPage] Reconnect status fetch failed:', err));
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
          if (current.phase !== 'plot' && !current.introImageUrl) {
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

        const genres = playData.genres || [];
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
        };
        applySession(newSession);
        generateIntroImage(newSession, fullIntroPl, playData);
      })
      .catch(err => {
        console.error('[AnyTalePlayPage] Failed to fetch intro plot:', err);
        setError('Failed to load introduction plot. Please refresh.');
      });
  }, [playData, generateIntroImage, applySession]);

  // --- BGM control ---

  // Restore BGM playlist on session load when genre is already selected
  useEffect(() => {
    if (!audioUnlocked || !playData || !session.music?.genre) return;
    if (globalBgmPlayer.isPlaying()) return; // already playing from pick
    const genres = playData.genres || [];
    const genre = genres.find(g => g.name === session.music.genre);
    if (!genre || !genre.tracks?.length) return;
    const shuffled = randomPickN(genre.tracks, genre.tracks.length);
    globalBgmPlayer.setPlaylist(shuffled.map(t => ({ url: t.audioUrl, label: t.name })));
    globalBgmPlayer.setTransition({ mode: 'crossfade', durationSeconds: 2 });
    if (session.musicOn) {
      globalBgmPlayer.play().catch(() => {});
    }
  }, [audioUnlocked, playData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync BGM play/stop with session.musicOn
  useEffect(() => {
    if (session.musicOn) {
      if (!globalBgmPlayer.isPlaying()) {
        globalBgmPlayer.play().catch(() => {});
      }
    } else {
      if (globalBgmPlayer.isPlaying()) globalBgmPlayer.stop();
    }
  }, [session.musicOn]);

  // --- Voice playback ---

  // Play voice on page navigation if available and not muted
  useEffect(() => {
    if (session.phase !== 'plot' || !currentPlot) return;
    const plotPageIdx = visiblePageIndices[session.pageIndex];
    if (plotPageIdx === undefined) return;

    globalAudioPlayer.stop();

    const voiceUrl = pageVoiceUrls[plotPageIdx];
    if (voiceUrl && !session.muted) {
      globalAudioPlayer.play(voiceUrl);
    }
  }, [session.pageIndex, session.phase, currentPlot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle mute toggle: cancel TTS on mute; re-queue TTS and navigate on unmute
  useEffect(() => {
    if (session.phase !== 'plot' || !currentPlot) return;

    if (session.muted) {
      // Stop playback immediately
      globalAudioPlayer.stop();

      // Cancel all generating TTS tasks and mark them skipped
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
      // Re-queue TTS for pages that have dialog but no settled voice
      let earliestMissingIdx = null;
      for (let i = 0; i < visiblePageIndices.length; i++) {
        const plotPageIdx = visiblePageIndices[i];
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
        const dialogText = entry?.dialogText;
        const vs = entry?.voiceStatus;
        if (dialogText && !['complete', 'generating', 'error'].includes(vs)) {
          if (earliestMissingIdx === null) earliestMissingIdx = i;
          queuePageSpeechRef.current?.(plotPageIdx, dialogText, cacheKey);
        }
      }

      // Play current page voice immediately if already available
      const currentPlotIdx = visiblePageIndices[session.pageIndex];
      const currentVoiceUrl = pageVoiceUrls[currentPlotIdx];
      if (currentVoiceUrl) {
        globalAudioPlayer.play(currentVoiceUrl);
      } else if (earliestMissingIdx !== null && earliestMissingIdx < session.pageIndex) {
        // Navigate back to the earliest page waiting for voice
        updateSession({ pageIndex: earliestMissingIdx });
      }
    }
  }, [session.muted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play intro voice only after the intro image finishes loading and the screen becomes visible.
  // Only triggers on character change — outfit/location/music regenerations are ignored.
  useEffect(() => {
    if (session.phase !== 'intro-main' || !audioUnlocked || session.muted) return;
    if (!session.character.voiceSampleUrl || !session.character.introTranscript) return;
    if (isGenerating || !session.introImageUrl) return;
    if (introVoicePlayedForRef.current === session.character.uid) return;
    introVoicePlayedForRef.current = session.character.uid;
    globalAudioPlayer.play(session.character.voiceSampleUrl);
  }, [session.phase, session.character.uid, audioUnlocked, session.muted, isGenerating, session.introImageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamic voice reprioritization: when navigating to a page whose voice is generating,
  // move its queue item to position 1 (right after any currently-running task)
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
    if (nextVisIdx >= visiblePageIndices.length) {
      setIsAutoplay(false);
      return;
    }

    const nextPlotPageIdx = visiblePageIndices[nextVisIdx];
    if (pageStatuses[nextPlotPageIdx] !== 'complete') return;

    const timer = setTimeout(() => {
      updateSession({ pageIndex: nextVisIdx });
    }, CROSSFADE_MS + 100);

    return () => clearTimeout(timer);
  }, [isAutoplay, session.pageIndex, pageStatuses, visiblePageIndices, currentPlot, updateSession]);

  // --- Reset ---

  const handleReset = useCallback(() => {
    // Cancel all in-progress/queued play mode generations on the server
    fetch('/queue/items/source/anytale-play', { method: 'DELETE' })
      .catch(err => console.error('[AnyTalePlayPage] Failed to cancel play queue items:', err));

    // Stop audio players
    globalAudioPlayer.stop();
    globalBgmPlayer.stop();

    // Clear pending routing state so stale mappings don't survive the reset
    taskToPageRef.current.clear();
    pendingChapterEventsRef.current = [];
    dialogHistoryRef.current = [];

    // Wipe the entire client-side asset cache so stale images never resurface
    clearAllCache();

    clearSession();
    setSession(loadSession());
    clearPlayDataCache();
    setIntroPlot(null);
    setError(null);
    setIsGenerating(false);
    setCurrentPlot(null);
    setVisiblePageIndices([]);
    setPageSlotStatuses([]);
    setPageImageUrls({});
    setPageStatuses({});
    setPageDialogTexts({});
    setPageVoiceUrls({});
    setPageVoiceStatuses({});
    setIsAutoplay(false);
    setPlayData(null);
    loadPlayData()
      .then(data => setPlayData(data))
      .catch(err => {
        console.error('[AnyTalePlayPage] Failed to reload play data:', err);
        setError('Failed to reload data. Please refresh.');
      });
  }, []);

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
    updateSession({ phase: 'plot', currentPlotUid: session.preludePlotUid, pageIndex: 0 });
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
    const genres = playData?.genres || [];
    setGenreDraft(randomPickN(genres, 3));
    updateSession({ phase: 'music-pick' });
  }, [playData, updateSession]);

  const pickGenre = useCallback((genre) => {
    const tracks = genre.tracks || [];
    if (tracks.length > 0) {
      const shuffled = randomPickN(tracks, tracks.length);
      globalBgmPlayer.setPlaylist(shuffled.map(t => ({ url: t.audioUrl, label: t.name })));
      globalBgmPlayer.setTransition({ mode: 'crossfade', durationSeconds: 2 });
      globalBgmPlayer.play().catch(err => console.error('[AnyTalePlayPage] BGM play failed:', err));
    }
    updateSession({ music: { genre: genre.name }, phase: 'intro-mood' });
  }, [updateSession]);

  // --- Chapter navigation ---

  const goToPrev = useCallback(() => {
    setIsAutoplay(false);
    setSession(prev => {
      if (prev.pageIndex <= 0) return prev;
      const next = { ...prev, pageIndex: prev.pageIndex - 1 };
      saveSession(next);
      return next;
    });
  }, []);

  const goToNext = useCallback(() => {
    setSession(prev => {
      if (prev.pageIndex >= visiblePageIndices.length - 1) return prev;
      const next = { ...prev, pageIndex: prev.pageIndex + 1 };
      saveSession(next);
      return next;
    });
  }, [visiblePageIndices]);

  const startAutoplay = useCallback(() => setIsAutoplay(true), []);
  const stopAutoplay = useCallback(() => setIsAutoplay(false), []);

  // --- Render ---

  if (!audioUnlocked) {
    const handleStart = () => {
      setAudioUnlocked(true);
      // Start BGM immediately on user gesture if genre is ready
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
        backgroundUrl=${session.introImageUrl || ''}
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

  // ── Chapter (plot) phase ─────────────────────────────────────────────────
  if (phase === 'plot') {
    if (!currentPlot || visiblePageIndices.length === 0) {
      return html`<${PortraitPanel} mode="loading" />`;
    }

    const currentPlotPageIdx = visiblePageIndices[session.pageIndex] ?? visiblePageIndices[0];
    const currentImageUrl = pageImageUrls[currentPlotPageIdx];
    const currentDialogText = pageDialogTexts[currentPlotPageIdx] || '';

    const voiceApplicable = !session.muted && !!session.character.voiceSampleUrl;

    const isVoiceSettled = (plotIdx) => {
      const vs = pageVoiceStatuses[plotIdx];
      if (vs === 'complete' || vs === 'skipped' || vs === 'error') return true;
      if (pageDialogTexts[plotIdx] === null) return true;
      return false;
    };

    const currentPageReady = pageStatuses[currentPlotPageIdx] === 'complete' &&
      (!voiceApplicable || isVoiceSettled(currentPlotPageIdx));
    const loadedCount = visiblePageIndices.filter(i => {
      const imageReady = pageStatuses[i] === 'complete';
      if (!voiceApplicable) return imageReady;
      return imageReady && isVoiceSettled(i);
    }).length;
    const loadedPercent = visiblePageIndices.length > 0
      ? (loadedCount / visiblePageIndices.length) * 100 : 0;
    const currentPercent = visiblePageIndices.length > 0
      ? ((session.pageIndex + 1) / visiblePageIndices.length) * 100 : 0;

    // Chapter number = position of this plot in the full plots list (1-indexed)
    const chapterNum = (playData.plots || []).findIndex(p => p.uid === currentPlot.uid) + 1 || 1;

    const prevPlotPageIdx = session.pageIndex > 0 ? visiblePageIndices[session.pageIndex - 1] : null;
    const nextPlotPageIdx = session.pageIndex < visiblePageIndices.length - 1
      ? visiblePageIndices[session.pageIndex + 1] : null;

    const isPageReady = (plotIdx) =>
      pageStatuses[plotIdx] === 'complete' && (!voiceApplicable || isVoiceSettled(plotIdx));

    const canGoPrev = prevPlotPageIdx !== null && isPageReady(prevPlotPageIdx);
    const canGoNext = nextPlotPageIdx !== null && isPageReady(nextPlotPageIdx);

    return html`
      <${PortraitPanel}
        mode=${currentPageReady ? 'page' : 'loading'}
        backgroundUrl=${currentImageUrl || ''}
        bubbleText=${currentPageReady ? currentDialogText : ''}
        muted=${session.muted}
        musicEnabled=${session.musicOn}
        chapter=${chapterNum}
        page=${session.pageIndex + 1}
        loadedPercent=${loadedPercent}
        currentPercent=${currentPercent}
        isAutoplay=${isAutoplay}
        onPrev=${canGoPrev ? goToPrev : undefined}
        onPlay=${currentPageReady ? startAutoplay : undefined}
        onStop=${stopAutoplay}
        onNext=${canGoNext ? goToNext : undefined}
        onReset=${handleReset}
        onToggleMute=${() => updateSession({ muted: !session.muted })}
        onToggleMusic=${() => updateSession({ musicOn: !session.musicOn })}
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
        subtitle: char.personality || undefined,
        image: char.portraitUrl || undefined,
        onClick: () => pickCharacter(char),
      })),
      { text: 'Maybe someone else?', onClick: rerollChars },
    ];

  } else if (phase === 'outfit-pick') {
    bubbleText = 'Pick a different outfit.';
    onBack = () => updateSession({ phase: 'intro-mood' });
    decisions = [
      ...outfitDraft.map(outfit => ({
        text: outfit.name,
        image: outfit.renderUrl || undefined,
        onClick: () => pickOutfit(outfit),
      })),
      { text: 'Nevermind', onClick: () => updateSession({ phase: 'intro-mood' }) },
    ];

  } else if (phase === 'location-pick') {
    bubbleText = 'Where would you like to go?';
    onBack = () => updateSession({ phase: 'intro-mood' });
    decisions = locationDraft.map(loc => ({
      text: loc.name,
      onClick: () => pickLocation(loc),
    }));

  } else if (phase === 'music-pick') {
    bubbleText = 'What kind of music sets the mood?';
    onBack = () => updateSession({ phase: 'intro-mood' });
    decisions = genreDraft.map(genre => ({
      text: genre.name,
      onClick: () => pickGenre(genre),
    }));
  }

  return html`
    <${PortraitPanel}
      mode=${panelMode}
      backgroundUrl=${session.introImageUrl || ''}
      bubbleText=${bubbleText}
      bubbleType=${bubbleType}
      muted=${session.muted}
      musicEnabled=${session.musicOn}
      decisions=${decisions}
      onBack=${onBack}
      onReset=${handleReset}
      onToggleMute=${() => updateSession({ muted: !session.muted })}
      onToggleMusic=${() => updateSession({ musicOn: !session.musicOn })}
    />
  `;
}
