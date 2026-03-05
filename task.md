# Ambient Channel Audio Enhancements

## Goals

Replace the discrete distance slider with a generalized gain range, add a pan parameter with multiple modes, expand muffle and reverb into multi-preset selectors, and add old radio and underwater audio effects. All changes are client-side Web Audio API — no server changes needed.

## Tasks

- [x] Add muffle profiles to `MuffleEffect` — accept a profile string (`glass-window`, `thick-wall`, `outside-car`) that maps to a lowpass frequency target, replacing the hardcoded 2000 Hz. Default to `thick-wall` when active with no profile specified.
  - Test: Open brew editor, set muffle to each profile on a channel with a loop track, solo it, and verify each sounds progressively more muffled.

- [x] Add reverb profiles to `ReverbEffect` — accept a profile string (`small-room`, `church`, `opera-hall`) that maps to a `reverbTime` value. Reconstruct the `SimpleReverb` IR tail when the profile changes. Default to `church` when active with no profile specified.
  - Test: Open brew editor, set reverb to each profile on a channel, solo it, and verify reverb tail length increases.

- [x] Replace muffle toggle with a `Select` dropdown in `channel-form.mjs` — options: `Off`, `Glass Window`, `Thick Wall`, `Outside Car`. Map to `muffle: null | 'glass-window' | 'thick-wall' | 'outside-car'` on the channel data. Replace reverb toggle similarly with options: `Off`, `Small Room`, `Church`, `Opera Hall`. Map to `reverb: null | 'small-room' | 'church' | 'opera-hall'`.
  - Test: Open brew editor, create a channel, and verify both sliders default to `Off`. Switch each to different presets and verify the labels update.

- [x] Wire up muffle/reverb profile live updates — in `AmbientChannel`, replace `setMuffled(bool)` and `setReverb(bool)` with `setMuffle(profile)` and `setReverb(profile)` that accept profile strings (or `null` for off). Update `handleChannelLiveUpdate` in `brew-editor.mjs` to call the new methods. Add backward compat: old JSON `muffled: true` maps to `muffle: 'thick-wall'`, `reverb: true` maps to `reverb: 'church'`.
  - Test: Load an older brew JSON that uses `muffled: true`. Verify it loads without errors and muffle is heard. Toggle profiles during live preview and verify smooth transitions.

- [x] Replace distance with gain range — remove `AmbientChannel.distances` static map and `#distance` field. Add `#gainRange: { min, max }` (0.0–1.0). For loop tracks, randomly pick a gain value from the range on each new segment and smoothly ramp to it. For event tracks, pick a random gain value per event. Add `setGainRange({ min, max })` public method.
  - Test: Set gain min=0.1, max=0.9 on a loop channel. Solo it and verify volume noticeably varies between iterations. Set min=max=0.5 and verify constant volume.
  - 5.1. Fix `LoopingTrack.#playContinuousAmbience` crossfade overlap — replace `setValueCurveAtTime` entirely with `linearRampToValueAtTime`. Each segment picks a `gainStart` (the previous segment's `gainEnd`) and a new random `gainEnd` from `#gainRange`. Envelope: `0 → gainStart` over `crossfade` duration, `gainStart → gainEnd` linear ramp over the middle, `gainEnd → 0` over the final `crossfade` duration. If the segment is too short (crossfades would overlap), skip the middle ramp: `0 → gainEnd → 0`. `setGainRange` only affects the next `gainEnd` pick. Pan follows the same start/end pattern when added in a later task.

- [x] Replace distance `DiscreteSlider` with gain range inputs in `channel-form.mjs` — use the existing `RangeSlider` component (already used in `track-form.mjs`) with `minAllowed=0`, `maxAllowed=1`, `snap=0.01`. Label: "Gain". Update `createDefaultChannel()` in `brew-editor.mjs` to use `gain: { min: 0.5, max: 0.5 }` instead of `distance: 'medium'`. Wire `handleChannelLiveUpdate` to call `setGainRange`. Add backward compat: old JSON `distance` strings map to fixed gain ranges (`very-far` → `{0.1, 0.1}`, `far` → `{0.25, 0.25}`, `medium` → `{0.5, 0.5}`, `close` → `{0.75, 0.75}`).
  - Test: Create a new channel and verify the gain slider defaults to 0.5/0.5. Load an old brew with `distance: "far"`, verify it loads and the slider shows 0.25/0.25.

- [x] Fix default values for new tracks (currently set to 0-1) and old tracks (currently also set to 0-1 on load, no matter what the old settings were)

- [x] Gain range is not working for event based channels - it should pick a single gain value from its range per event audio played, and that gain should stay the same through the playback of that entire event. That event's internal envelop might adjust the volume further.

- [ ] Create `pan.mjs` with `PanEffect` class using the implementation of gain range as a reference for how they are handled during loops and events — wrap a `StereoPannerNode`. Expose `get input`, `get output`, `setActive(panConfig, duration)`, `connect(dest)`, `disconnect()`, `dispose()`. The `panConfig` is an object `{ mode, value?, min?, max? }` or `null` (center/off).
  - Test: Manually instantiate in browser console, connect to audio context destination, call `setActive({ mode: 'fixed', value: 1 })` and verify audio pans right.

- [ ] Add pan to `AmbientChannel` — insert `PanEffect` into the effect chain after reverb (priority: `muffle → reverb → pan`). Add `setPan(panConfig)` public method. For `fixed` mode: set static pan position. For `random` mode (event tracks): pick a random pan value from `[min, max]` per event. For `left-to-right` and `right-to-left` modes (event tracks): schedule a linear ramp from –1→+1 or +1→–1 spanning the event's full duration.
  - Test: Set pan to `fixed`, value=1.0 on a channel. Solo it, verify audio is in right ear only. Set to –1.0, verify left ear.

- [ ] Add pan UI to `channel-form.mjs` — add a `DiscreteSlider` for pan mode: `Off`, `Fixed`, `Random`, `Left → Right`, `Right → Left`. Conditionally show a numeric `Input` (–1 to +1) for fixed value, or a `RangeSlider` (–1 to +1) for random range. `Left → Right` and `Right → Left` require no extra inputs. Wire `handleChannelLiveUpdate` to call `setPan`. Update `createDefaultChannel()` to include `pan: null`. 
  - Test: Create a channel, verify pan defaults to Off. Switch to Fixed, value=0.5, and verify the input appears. Switch to Random and verify the range slider appears.

- [ ] Implement random pan per event and sweeping pan modes — in `EventTrack.#playEventLoops`, when the channel's pan mode is `random`, call `setPan` with a random value in `[min, max]` before each event. When mode is `left-to-right` or `right-to-left`, schedule a `linearRampToValueAtTime` from start position to end position over the event's duration.
  - Test: Set pan mode to `random` (range –1 to +1) on an event track. Solo and listen for several events. Verify pan position varies. Set to `left-to-right` on a long clip and verify it sweeps.

- [ ] Create `old-radio.mjs` with `OldRadioEffect` class — signal chain: input `GainNode` → `BiquadFilter` (bandpass, frequency ~1800 Hz, Q ~0.7 to cover 300–3400 Hz) → `WaveShaperNode` (mild saturation curve) → wet `GainNode` → output `GainNode`. Dry path: input → output. `setActive(active, duration)` ramps the wet gain. Expose `get input`, `get output`, `connect`, `disconnect`, `dispose`.
  - Test: Add `OldRadioEffect` to a playing channel. Toggle it on and verify audio sounds tinny/telephone-like.

- [ ] Create `underwater.mjs` with `UnderwaterEffect` class — signal chain: input `GainNode` → `BiquadFilter` (lowpass ~400 Hz) → `BiquadFilter` (peaking ~600 Hz, Q ~3, gain +6 dB for resonance) → wet `GainNode` → output `GainNode`. Dry path: input → output. `setActive(active, duration)` ramps the wet gain.
  - Test: Add `UnderwaterEffect` to a playing channel. Toggle it on and verify audio sounds heavily muffled and resonant.

- [ ] Add old radio and underwater to `AmbientChannel` — insert `OldRadioEffect` and `UnderwaterEffect` into the effect chain (priority: `muffle → reverb → old-radio → underwater → pan`). Add `setOldRadio(bool)` and `setUnderwater(bool)` public methods. Channel data includes `oldRadio: boolean` and `underwater: boolean` (default `false`).
  - Test: Open brew editor, toggle Old Radio on a channel during preview, verify the effect is audible. Do the same for Underwater.

- [ ] Add old radio and underwater toggle switches to `channel-form.mjs` — add two `ToggleSwitch` controls labeled "Old Radio" and "Underwater". Wire `handleChannelLiveUpdate` to call `setOldRadio` and `setUnderwater`. Update `createDefaultChannel()` to include `oldRadio: false, underwater: false`.
  - Test: Create a channel, verify both toggles default to off. Toggle each on and off during preview.

- [ ] Backward-compatibility smoke test — load a brew JSON that uses the old schema (`distance`, `muffled`, `reverb` as boolean). Verify it loads, plays, and all parameters map correctly. Save it and verify the new schema is written. Re-load and verify it still works.

## Implementation Details

### Channel Data Shape (New)

```json
{
  "label": "Ambient Wind",
  "gain": { "min": 0.2, "max": 0.35 },
  "muffle": "glass-window",
  "reverb": "church",
  "pan": { "mode": "random", "min": -0.5, "max": 0.5 },
  "oldRadio": false,
  "underwater": false,
  "tracks": []
}
```

### Backward Compatibility Migration (in `AmbientBrew.load()`)

Old `distance` string → `gain`: `very-far` → `{0.1, 0.1}`, `far` → `{0.25, 0.25}`, `medium` → `{0.5, 0.5}`, `close` → `{0.75, 0.75}`.

Old `muffled: true` → `muffle: 'thick-wall'`, `muffled: false` → `muffle: null`.

Old `reverb: true` → `reverb: 'church'`, `reverb: false` → `reverb: null`.

Missing `pan` → `pan: null`. Missing `oldRadio`/`underwater` → `false`.

### Effect Chain Priority

`muffle → reverb → old-radio → underwater → pan`

Frequency shaping first, spatial effects last. Pan is last because it should pan the fully processed signal.

### Muffle Profiles

| Profile | Lowpass Frequency |
|---|---|
| `glass-window` | 4000 Hz |
| `thick-wall` | 800 Hz |
| `outside-car` | 2000 Hz |

### Reverb Profiles

| Profile | Reverb Time (s) |
|---|---|
| `small-room` | 0.8 |
| `church` | 2.5 |
| `opera-hall` | 5.0 |

### Old Radio Effect

Bandpass filter centered at ~1800 Hz (Q ~0.7) to pass 300–3400 Hz, followed by a `WaveShaperNode` with a mild soft-clipping curve for gritty character. Dry/wet parallel paths with gain ramp.

### Underwater Effect

Lowpass filter at ~400 Hz followed by a peaking filter at ~600 Hz (Q ~3, gain +6 dB) for resonance. Dry/wet parallel paths with gain ramp.

### Pan Modes

| Mode | Behavior | Available On |
|---|---|---|
| `null` / `off` | Center (no panning) | All |
| `fixed` | Static position (–1 to +1) | All |
| `random` | Random value per event from `[min, max]` | Event tracks |
| `left-to-right` | Linear ramp –1 → +1 over event duration | Event tracks |
| `right-to-left` | Linear ramp +1 → –1 over event duration | Event tracks |

### Files Modified

- `public/js/ambrew/muffle.mjs` — add profile map and `setActive(profile, duration)`
- `public/js/ambrew/reverb.mjs` — add profile map, reconstruct `SimpleReverb` on profile change
- `public/js/ambrew/ambient-coffee.mjs` — replace distance with gain range, add pan/oldRadio/underwater to `AmbientChannel`, update effect chain, backward compat migration in `AmbientBrew.load()`
- `public/js/app-ui/brew-editor/channel-form.mjs` — replace distance slider, replace muffle/reverb toggles, add pan controls, add old radio/underwater toggles
- `public/js/app-ui/brew-editor/brew-editor.mjs` — update `createDefaultChannel()`, update `handleChannelLiveUpdate()`

### Files Created

- `public/js/ambrew/pan.mjs` — `PanEffect` class
- `public/js/ambrew/old-radio.mjs` — `OldRadioEffect` class
- `public/js/ambrew/underwater.mjs` — `UnderwaterEffect` class