import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
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
import { globalBgmPlayer } from '../../custom-ui/global-audio-player.mjs';
import {
  randomPickN,
  splitOptions,
  computeSlotState,
  checkSlotRequirements,
  buildPartForPrompt,
} from './play-utils.mjs';
import { resolveSlotStatuses, parseRules, applyRules } from '../anytale/slot-resolver.mjs';

export function AnyTalePlayPage() {
  const [, setTheme] = useState(currentTheme.value);
  useEffect(() => currentTheme.subscribe(setTheme), []);

  const { show: progressShow } = useProgress();

  const [playData, setPlayData] = useState(null);
  const [session, setSession] = useState(() => loadSession());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [introPlot, setIntroPlot] = useState(null);

  // Phase-specific draft state
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

  // --- Image generation (Tasks 3, 6, 7, 8) ---

  const generateIntroImage = useCallback((sess, introPl, data) => {
    const partsMap = new Map((data.parts || []).map(p => [p.uid, p]));
    const outfit = (data.outfits || []).find(o => o.uid === sess.outfitUid);

    // Build activeParts for slot visibility resolution (char parts always covering)
    const charActiveParts = (sess.character.parts || []).map(p => {
      const config = partsMap.get(p.partUid);
      return config ? { config: { type: config.type || [], isRevealing: false } } : null;
    }).filter(Boolean);

    const outfitActiveParts = (outfit ? outfit.parts : []).map(p => {
      const config = partsMap.get(p.partUid);
      return config ? { config: { type: config.type || [], isRevealing: p.isRevealing ?? false } } : null;
    }).filter(Boolean);

    // Pass the intro plot's pages so page 1 (index 0) actions affect slot visibility.
    const slotStatuses = resolveSlotStatuses([...charActiveParts, ...outfitActiveParts], introPl.pages || [], 0);
    const parsedRules = parseRules(data.config.slotRules || '');
    const visibility = applyRules(slotStatuses, parsedRules);

    // Build prompt parts, filtering by slot visibility
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
      // Location is not a body slot — mark its types visible so assemblePrompt's strict === true check passes
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
    }).catch(err => console.error('[AnyTalePlayPage] Failed to submit generation:', err));
  }, []);

  // SSE subscription: pick up task-started for anytale-play tasks (Task 3)
  useEffect(() => {
    return queueSSEManager.subscribe({
      'queue:task-started': ({ taskId, source, clientId }) => {
        if (source !== 'anytale-play') return;
        if (clientId !== getClientId()) return;
        setIsGenerating(true);
        progressShow(taskId, {
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
  }, [progressShow, updateSession]);

  // --- Bootstrap / restore on data load (Tasks 1, 2, 10) ---

  useEffect(() => {
    loadPlayData()
      .then(data => setPlayData(data))
      .catch(err => {
        console.error('[AnyTalePlayPage] Failed to load play data:', err);
        setError('Failed to load data. Please refresh.');
      });
  }, []);

  useEffect(() => {
    if (!playData) return;

    // Task 2: locate introduction plot by name from config
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

    // Fetch the full plot object — the list endpoint returns summaries only (no pages/actions).
    fetchJson(`/anytale/plot/${foundIntroPl.uid}`)
      .then(fullIntroPl => {
        setIntroPlot(fullIntroPl);

        // Task 10: restore existing session
        const current = loadSession();
        if (current.character.uid) {
          setSession(current);
          if (!current.introImageUrl) generateIntroImage(current, fullIntroPl, playData);
          return;
        }

        // Task 1: cold start bootstrap
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

  // --- Reset ---

  const handleReset = useCallback(() => {
    clearSession();
    clearPlayDataCache();
    setIntroPlot(null);
    setError(null);
    setIsGenerating(false);
    setPlayData(null); // re-triggers load → bootstrap
    loadPlayData()
      .then(data => setPlayData(data))
      .catch(err => {
        console.error('[AnyTalePlayPage] Failed to reload play data:', err);
        setError('Failed to reload data. Please refresh.');
      });
  }, []);

  // --- Phase transitions (Tasks 4–9) ---

  // Task 6: character change
  const enterCharacterPick = useCallback(() => {
    if (!playData) return;
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
          parts: char.parts || [],
        },
        outfitUid: outfit ? outfit.uid : '',
        slotState,
        phase: 'intro-main',
      };
      saveSession(next);
      generateIntroImage(next, introPlot, playData);
      return next;
    });
  }, [playData, introPlot, generateIntroImage]);

  // Task 4: intro main → mood
  const enterMood = useCallback(() => updateSession({ phase: 'intro-mood' }), [updateSession]);

  // Task 5 (begin tale): store intent, Rollout 4 will handle chapter entry
  const beginTale = useCallback(() => updateSession({ phase: 'plot' }), [updateSession]);

  // Task 7: outfit change — draw from full library
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

  // Task 8: location change — attributes auto-randomize on part selection
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

  // Task 9: music genre selection
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

  // --- Render ---

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
  const panelMode = isGenerating || !session.introImageUrl ? 'loading' : 'decision';

  let decisions = [];
  let bubbleText = '';
  let onBack = null;

  // Task 4: introduction main page
  if (phase === 'intro-main' && panelMode === 'decision') {
    bubbleText = session.character.name ? `Hello, I'm ${session.character.name}.` : '';
    decisions = [
      { text: 'Let me meet someone else', onClick: enterCharacterPick },
      { text: "The mood isn't right", onClick: enterMood },
      { text: 'Begin the tale', onClick: beginTale },
    ];

  // Task 5: introduction mood page
  } else if (phase === 'intro-mood') {
    bubbleText = 'What would you like to change?';
    onBack = () => updateSession({ phase: 'intro-main' });
    decisions = [
      { text: 'Maybe try on a different outfit?', onClick: enterOutfitPick },
      { text: "Let's go somewhere else.", onClick: enterLocationPick },
      { text: "Let's listen to something different.", onClick: enterMusicPick },
    ];

  // Task 6: character change flow
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

  // Task 7: outfit change flow
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

  // Task 8: location change flow (auto-randomizes attributes on pick)
  } else if (phase === 'location-pick') {
    bubbleText = 'Where would you like to go?';
    onBack = () => updateSession({ phase: 'intro-mood' });
    decisions = locationDraft.map(loc => ({
      text: loc.name,
      onClick: () => pickLocation(loc),
    }));

  // Task 9: music genre selection
  } else if (phase === 'music-pick') {
    bubbleText = 'What kind of music sets the mood?';
    onBack = () => updateSession({ phase: 'intro-mood' });
    decisions = genreDraft.map(genre => ({
      text: genre.name,
      onClick: () => pickGenre(genre),
    }));

  // Rollout 4 placeholder
  } else if (phase === 'plot') {
    bubbleText = 'The tale begins… (coming in the next update)';
    onBack = () => updateSession({ phase: 'intro-main' });
  }

  return html`
    <${PortraitPanel}
      mode=${panelMode}
      backgroundUrl=${session.introImageUrl || ''}
      bubbleText=${bubbleText}
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
