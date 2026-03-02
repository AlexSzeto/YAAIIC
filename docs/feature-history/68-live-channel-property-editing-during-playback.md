# Live Channel Property Editing During Playback

## Goal
Allow users to modify a channel's `distance`, `muffled`, and `reverb` properties while a brew preview is playing and hear the changes immediately via smooth audio transitions. Each channel also gains a runtime-only on/off toggle and a solo button, replacing the existing per-channel preview buttons.

## Tasks

- [x] Rename ambrew files to `.mjs`: `ambient-coffee.js` → `ambient-coffee.mjs`, `reverb.js` → `reverb.mjs`; create `muffle.mjs`; update the import in `brew-editor.mjs`
- [x] Rework `AmbientChannel` signal chain so all three properties can be transitioned at runtime
- [x] Add `PROPERTY_TRANSITION_DURATION` constant and live setter methods to `AmbientChannel`
- [x] Expose channel lookup on `AmbientBrew` and `AmbientCoffee`
- [x] Wire live `distance`, `muffled`, and `reverb` updates from `brew-editor.mjs` to the audio engine during active playback
- [x] Add runtime channel enable/disable state to `brew-editor.mjs` and wire it to `setEnabled`
- [x] Implement solo logic in `brew-editor.mjs`
- [x] Update `ChannelForm` UI: add on/off toggle switch and solo button, remove per-channel preview buttons

## Implementation Details

### Why the signal chain must be reworked

Currently, `AmbientChannel` only wires the muffle filter and reverb node into the chain when those properties are `true` at construction time. Because `AudioNode` connections are static, there is no way to add or remove a node after playback has started. Additionally, the connections are hardcoded — adding a new effect requires understanding and modifying the entire topology rather than slotting the effect into a defined position.

The new design treats every effect as a fully self-contained class with an identical interface. The channel maintains an ordered array of active effects and rebuilds connections when the array changes. This makes adding or removing effects a one-line operation and keeps every effect independently testable.

---

### Effect interface (identical signature for every effect)

All effect classes share the same API. No effect knows anything about the channel or about other effects.

```js
class AudioEffect {
  constructor(ctx)              // creates all internal AudioNodes
  get input()                   // AudioNode — where incoming signal is connected
  get output()                  // AudioNode — where outgoing signal comes from
  setActive(active, duration?)  // enable/disable; ramps relevant AudioParam
  connect(destination)          // output.connect(destination)
  disconnect()                  // output.disconnect()
  dispose()                     // full cleanup: disconnect all internal nodes
}
```

Each effect lives in its own file under `public/js/ambrew/`:

| File | Class exported | Notes |
|---|---|---|
| `muffle.mjs` | `MuffleEffect` | New file |
| `reverb.mjs` | `ReverbEffect` | Renamed from `reverb.js` — `SimpleReverb` and its audio utilities stay in the file as internal helpers; `ReverbEffect` becomes the sole export |
| `ambient-coffee.mjs` | `AmbientCoffee`, `AmbientChannel` | Renamed from `ambient-coffee.js` |

`ambient-coffee.mjs` imports both effects:

```js
import { MuffleEffect } from './muffle.mjs'
import { ReverbEffect } from './reverb.mjs'
```

`brew-editor.mjs` updates its import to match the rename:

```js
import { AmbientCoffee } from '../../ambrew/ambient-coffee.mjs'
```

---

### `EFFECT_CHAIN_PRIORITY` constant

Add as a module-level constant at the top of `ambient-coffee.mjs`:

```js
const EFFECT_CHAIN_PRIORITY = ['muffle', 'reverb']
```

This array defines the canonical order of effects from source to output. Frequency-shaping effects (`muffle`) precede spatial/temporal effects (`reverb`) so that the reverb tail is processed through the same muffle — the physically correct and perceptually cleaner result. Inserting any future effect (e.g. `'pitch'`, `'compress'`) is a matter of placing its key at the right position in this array.

---

### `MuffleEffect` — `public/js/ambrew/muffle.mjs`

Internally a single `BiquadFilter` (lowpass). Transparent by default (`frequency = 20 000 Hz`).

```js
class MuffleEffect {
  #filter

  constructor(ctx) {
    this.#filter = ctx.createBiquadFilter()
    this.#filter.type = 'lowpass'
    this.#filter.frequency.value = 20000   // transparent / off
  }

  get input()  { return this.#filter }
  get output() { return this.#filter }

  setActive(active, duration = 0) {
    const target = active ? 2000 : 20000
    if (duration > 0) {
      this.#filter.frequency.linearRampToValueAtTime(
        target,
        AmbientCoffee.audioContext.currentTime + duration
      )
    } else {
      this.#filter.frequency.setValueAtTime(target, AmbientCoffee.audioContext.currentTime)
    }
  }

  connect(dest) { this.#filter.connect(dest) }
  disconnect()  { this.#filter.disconnect() }
  dispose()     { this.disconnect() }
}
```

---

### `ReverbEffect` — `public/js/ambrew/reverb.mjs`

`reverb.mjs` (renamed from `reverb.js`) already contains `SimpleReverb` and its supporting audio utilities (`Noise`, `AmpEnvelope`, etc.). `ReverbEffect` is added to the bottom of the same file as the new `export`; `SimpleReverb` is retained as a non-exported internal helper. The existing `SimpleReverb` class and utilities are left untouched.

`ReverbEffect` wraps `SimpleReverb` with a parallel dry path. The `input` GainNode splits the signal: one branch goes straight to `output` (dry), the other passes through the convolver and a `wetGain` before reaching `output`. Dry by default (`wetGain = 0`).

```js
class ReverbEffect {
  #input    // GainNode — split point
  #reverb   // SimpleReverb
  #wetGain  // GainNode — wet mix level
  #output   // GainNode — merge point

  constructor(ctx) {
    this.#input   = ctx.createGain()
    this.#reverb  = new SimpleReverb(ctx, { seconds: 2.5, decay: 2 })
    this.#wetGain = ctx.createGain()
    this.#wetGain.gain.value = 0   // dry / off
    this.#output  = ctx.createGain()

    // dry path
    this.#input.connect(this.#output)
    // wet path
    this.#input.connect(this.#reverb.input)
    this.#reverb.output.connect(this.#wetGain)
    this.#wetGain.connect(this.#output)
  }

  get input()  { return this.#input }
  get output() { return this.#output }

  setActive(active, duration = 0) {
    const target = active ? 1 : 0
    if (duration > 0) {
      this.#wetGain.gain.linearRampToValueAtTime(
        target,
        AmbientCoffee.audioContext.currentTime + duration
      )
    } else {
      this.#wetGain.gain.setValueAtTime(target, AmbientCoffee.audioContext.currentTime)
    }
  }

  connect(dest) { this.#output.connect(dest) }
  disconnect()  { this.#output.disconnect() }

  dispose() {
    this.#input.disconnect()
    this.#reverb.disconnect?.()
    this.disconnect()
  }
}
```

---

### `PROPERTY_TRANSITION_DURATION` constant

Add as a static constant on `AmbientChannel`:

```js
static PROPERTY_TRANSITION_DURATION = 0.25  // seconds
```

This single value is passed as the `duration` argument to every `setActive` call and to the output gain ramp, keeping all transitions perceptually consistent.

---

### Effect chain inside `AmbientChannel`

`AmbientChannel` owns an effects `Map` keyed by priority name and a derived `#chain` array ordered by `EFFECT_CHAIN_PRIORITY`. Whenever the array changes, `#rebuildChain()` rewires all nodes.

```js
#effects = new Map()   // name → AudioEffect instance
#chain   = []          // ordered subset of #effects, rebuilt on change
#output                // GainNode — distance/enable control, always last
```

**Initialisation** — both effects are always created and added:

```js
this.#effects.set('muffle', new MuffleEffect(ctx))
this.#effects.set('reverb', new ReverbEffect(ctx))
this.#rebuildChain()
```

**`#rebuildChain()`** — call after any add/remove:

```js
#rebuildChain() {
  // 1. tear down old wiring
  for (const track of this.#tracks) track.disconnect()
  for (const effect of this.#chain) effect.disconnect()

  // 2. build ordered array from priority list (skip missing entries)
  this.#chain = EFFECT_CHAIN_PRIORITY
    .filter(name => this.#effects.has(name))
    .map(name => this.#effects.get(name))

  // 3. wire: tracks → effect[0] → effect[1] → … → #output
  const first = this.#chain[0]?.input ?? this.#output
  for (const track of this.#tracks) track.connect(first)
  for (let i = 0; i < this.#chain.length; i++) {
    const dest = this.#chain[i + 1]?.input ?? this.#output
    this.#chain[i].connect(dest)
  }
}
```

**Signal chain diagram** (both effects active):

```
tracks
  └─> MuffleEffect.input  (BiquadFilter lowpass, 20 000 Hz = transparent)
        └─> ReverbEffect.input  (GainNode split)
              ├─> ReverbEffect.output  (dry path, direct)
              └─> SimpleReverb → wetGain (0 = dry)
                    └─> ReverbEffect.output
                          └─> #output  (GainNode, distance/enable control)
```

**Neutral / off states (no chain rebuild needed for property toggles):**
- `muffled = false` → `MuffleEffect.frequency = 20 000` (transparent)
- `reverb  = false` → `ReverbEffect.wetGain   = 0` (dry)
- `enabled = false` → `#output.gain            = 0` (whole channel silent)

---

### Setter methods on `AmbientChannel`

Each method delegates to the relevant effect's `setActive()` or ramps `#output.gain` directly. Safe to call before or during playback.

```js
setDistance(distance)  // ramps #output.gain to distances[distance] (only if enabled)
setMuffled(muffled)    // calls muffleEffect.setActive(muffled, PROPERTY_TRANSITION_DURATION)
setReverb(reverb)      // calls reverbEffect.setActive(reverb,  PROPERTY_TRANSITION_DURATION)
setEnabled(enabled)    // ramps #output.gain: 0 (off) or distances[#distance] (on)
```

`setEnabled(false)` does NOT change `#distance` — it remembers the current distance so `setEnabled(true)` restores the correct gain level.

---

### Channel lookup API

`AmbientBrew` and `AmbientCoffee` each gain a `getChannel(label)` method:

```js
// AmbientBrew
getChannel(label) → AmbientChannel | null

// AmbientCoffee (delegates to #brewing)
getChannel(label) → AmbientChannel | null
```

This is the bridge between the React UI and the live audio graph.

---

### Runtime channel state in `brew-editor.mjs`

Add a new state variable (separate from brew data — never saved):

```js
const [channelStates, setChannelStates] = useState({})
// Shape: { [channelLabel]: { enabled: boolean } }
// Defaults: all channels enabled
```

**Reset policy:** `channelStates` resets to `{}` when a new brew preview starts (inside `startPreview`). This ensures all channels are audible at the start of each new session.

**Helper to read enabled state (with default):**
```js
const isChannelEnabled = (label) => channelStates[label]?.enabled ?? true
```

---

### Live update handler in `brew-editor.mjs`

A new `handleChannelLiveUpdate(channelLabel, updatedChannel, prevChannel)` function is called from the per-channel `onChange` handler, before `handleChannelsChange`. It compares only the three live-editable properties and calls the appropriate setter if a change is detected:

```js
function handleChannelLiveUpdate(label, next, prev) {
  if (!isPlaying || !coffeeRef.current) return
  const ch = coffeeRef.current.getChannel(label)
  if (!ch) return
  if (next.distance !== prev.distance) ch.setDistance(next.distance)
  if (next.muffled  !== prev.muffled)  ch.setMuffled(next.muffled)
  if (next.reverb   !== prev.reverb)   ch.setReverb(next.reverb)
}
```

This keeps all audio-engine concerns out of `ChannelForm`.

---

### Enable/disable and solo handlers in `brew-editor.mjs`

```js
function handleChannelEnabled(label, enabled) {
  setChannelStates(prev => ({ ...prev, [label]: { ...prev[label], enabled } }))
  coffeeRef.current?.getChannel(label)?.setEnabled(enabled)
}

function handleChannelSolo(label) {
  const allLabels = (brew?.channels || []).map(ch => ch.label)
  const next = {}
  allLabels.forEach(l => {
    next[l] = { enabled: l === label }
    coffeeRef.current?.getChannel(l)?.setEnabled(l === label)
  })
  setChannelStates(next)
}
```

Solo mutes every channel and then enables only the target, using the same `setEnabled` path as the toggle — no special-casing needed.

---

### Updated `ChannelForm` props

| Prop | Type | Notes |
|---|---|---|
| `enabled` | `boolean` | Runtime enabled state. Default `true`. |
| `onEnabledChange` | `(enabled: boolean) => void` | Called when toggle is flipped. |
| `onSolo` | `() => void` | Called when Solo button is clicked. |
| `onPreview` | _(removed)_ | No longer needed. |
| `onStop` | _(removed)_ | No longer needed. |
| `isPlaying` | _(removed)_ | No longer needed after preview buttons are gone. |

The on/off `ToggleSwitch` and `Solo` `Button` join the existing row of controls (Muffled, Reverb, Distance) inside the channel form. They are always visible.

**Manual test after final task:**
1. Open the Brew Editor and load a brew with at least two channels.
2. Click **Preview** in the action bar.
3. While audio plays, toggle **Muffled** on a channel — the sound should gradually become muffled over ~2 seconds.
4. Toggle **Reverb** — reverb should fade in/out over ~2 seconds.
5. Change **Distance** — volume should ramp smoothly.
6. Toggle a channel's on/off switch — the channel should fade out/in over ~2 seconds.
7. Click **Solo** on a channel — all other channels should fade out, leaving only the soloed channel.
8. Click **Stop**. Start **Preview** again — all channels should be enabled (solo/mute state resets).
9. Confirm there are no per-channel Preview/Stop buttons remaining in the channel form.
