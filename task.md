# Live Channel Property Editing During Playback

## Goal
Allow users to modify a channel's `distance`, `muffled`, and `reverb` properties while a brew preview is playing and hear the changes immediately via smooth audio transitions. Each channel also gains a runtime-only on/off toggle and a solo button, replacing the existing per-channel preview buttons.

## Tasks

- [ ] Rework `AmbientChannel` signal chain so all three properties can be transitioned at runtime
- [ ] Add `PROPERTY_TRANSITION_DURATION` constant and live setter methods to `AmbientChannel`
- [ ] Expose channel lookup on `AmbientBrew` and `AmbientCoffee`
- [ ] Wire live `distance`, `muffled`, and `reverb` updates from `brew-editor.mjs` to the audio engine during active playback
- [ ] Add runtime channel enable/disable state to `brew-editor.mjs` and wire it to `setEnabled`
- [ ] Implement solo logic in `brew-editor.mjs`
- [ ] Update `ChannelForm` UI: add on/off toggle switch and solo button, remove per-channel preview buttons

## Implementation Details

### Why the signal chain must be reworked

Currently, `AmbientChannel` only wires the muffle filter and reverb node into the chain when those properties are `true` at construction time. Because `AudioNode` connections are static, there is no way to add or remove a node after playback has started. To support live transitions, both effects must always be present in the graph — just set to a neutral/transparent state when inactive.

---

### New `AmbientChannel` signal chain

All tracks connect to `#muffleFilter`. Its output splits into two parallel paths that both feed into `#output`:

```
tracks
  └─> #muffleFilter  (BiquadFilter, lowpass)
        ├─> #output               (dry path — direct)
        └─> #reverbNode           (ConvolverNode / SimpleReverb)
              └─> #reverbWetGain  (GainNode)
                    └─> #output
```

**Neutral / off states:**
- `muffled = false` → `#muffleFilter.frequency = 20000` (above hearing, transparent)
- `reverb = false` → `#reverbWetGain.gain = 0` (wet path silent)
- `enabled = false` → `#output.gain = 0` (whole channel silent)

The `#output` GainNode's value is always driven by the combination of `enabled` and `distance`:
- enabled: `gain = AmbientChannel.distances[distance]`
- disabled: `gain = 0` (distance is remembered internally so it can be restored)

---

### `PROPERTY_TRANSITION_DURATION` constant

Add as a static constant on `AmbientChannel` at the top of `ambient-coffee.js`:

```js
static PROPERTY_TRANSITION_DURATION = 0.25  // seconds
```

This single value controls the ramp duration for all three AudioParam transitions.

---

### New setter methods on `AmbientChannel`

Each method uses `linearRampToValueAtTime` on the relevant `AudioParam`. They are safe to call at any time (before or during playback); if called before `playInto()`, the param value is set immediately instead.

```js
setDistance(distance)   // ramps #output.gain to distances[distance] (only if enabled)
setMuffled(muffled)     // ramps #muffleFilter.frequency: 2000 (muffled) or 20000 (clear)
setReverb(reverb)       // ramps #reverbWetGain.gain: 1 (wet) or 0 (dry)
setEnabled(enabled)     // ramps #output.gain: 0 (off) or distances[#distance] (on)
```

`setEnabled(false)` does NOT change `#distance` — it stores the current distance so that `setEnabled(true)` restores the correct gain level.

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
