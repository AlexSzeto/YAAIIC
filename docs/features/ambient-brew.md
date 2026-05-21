# Ambient Brew Feature

Ambient Brew is a procedural soundscape editor. Users compose ambient audio "brews" from layered channels of event and loop tracks, each drawing from a library of sound sources (collections of audio clips with envelope controls). Brews can be previewed live or recorded to a WAV file.

## User Flow

```
Open/Create brew → Edit sound sources (global library)
→ Add channels → Add tracks per channel → Assign sources to tracks
→ Preview (live playback) OR Record (capture to WAV → upload)
→ Save brew
```

## Component Map

```
app-ui/brew-editor/
  brew-editor.mjs        — page root; owns all state, playback, recording
  channel-form.mjs       — single channel editor (effects, gain, track list)
  track-form.mjs         — single track editor (type, source refs, timing, pan)
  sound-source-form.mjs  — single sound source editor (clips, envelopes)
```

### Component communication

- `BrewEditor` owns the canonical `brew` object and `globalSources` array.
- `ChannelForm` and nested `TrackForm` receive their slice of data and call `onChange` with the updated object — fully controlled.
- `SoundSourceForm` additionally calls `onSourceLengthsChange({ [label]: effectiveDuration })` so the parent can cache effective durations.
- `sourceLengths` is passed back down to `TrackForm` to drive dynamic slider maximums (delay/duration limits depend on how long the assigned source is).
- Channel enabled/disabled state is runtime-only (stored in `channelStates` in `BrewEditor`, never persisted).

## Server Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/brews` | List all brews `[{ uid, name }]` |
| GET | `/api/brews/:uid` | Load full brew data |
| POST | `/api/brews` | Save brew; body: `{ uid, name, data }` |
| DELETE | `/api/brews/:uid` | Delete brew |
| GET | `/api/sound-sources` | List all global sources |
| POST | `/api/sound-sources` | Upsert source (matched by uid first, then label) |
| DELETE | `/api/sound-sources/:name` | Delete source by label (URL-decoded) |
| POST | `/upload/audio` | Upload recorded WAV (multipart); returns media entry |

Also calls the standard gallery and folder endpoints to resolve clip labels and manage output folder.

## Key Data Shapes

### Brew

```json
{
  "uid": 42,
  "label": "Coffee Shop Morning",
  "sources": [ ...SoundSource ],
  "channels": [ ...Channel ]
}
```

Brews are stored in `server/database/brew-data.json` as `{ uid, name, data }` where `data` is the brew object above.

### SoundSource

```json
{
  "uid": "...",
  "label": "rain-light",
  "clips": [
    { "url": "/media/audio_3.mp3", "label": "light rain", "start": 0, "end": 30 }
  ],
  "repeatCount": { "min": 1, "max": 3 },
  "repeatDelay": { "min": 2, "max": 8 },
  "attack": { "min": 0.5, "max": 2 },
  "decay": { "min": 0.5, "max": 2 }
}
```

Global sources live in `server/database/sound-sources.json`. Sources can also be embedded directly in a brew's `sources` array (brew-local sources), though most are global.

**Effective length** (used to set dynamic slider limits):
```
effectiveLength = longestClipDuration + repeatCount.max × repeatDelay.max
```
Calculated client-side by `SoundSourceForm` via `Audio.onloadedmetadata` and passed up to `BrewEditor` via `onSourceLengthsChange`. Not persisted.

### Channel

```json
{
  "label": "Ambience",
  "gain": 0.8,
  "muffle": "glass-window",
  "reverb": "small-room",
  "radio": "off",
  "underwater": "off",
  "tracks": [ ...Track ]
}
```

**Effect values:**
- `muffle`: `"off"` | `"glass-window"` | `"outside-car"` | `"thick-wall"`
- `reverb`: `"off"` | `"small-room"` | `"church"` | `"opera-hall"`
- `radio`: `"off"` | `"old-radio"` | `"walkie-talkie"`
- `underwater`: `"off"` | `"on"`

### Track — Loop type

```json
{
  "label": "Rain Loop",
  "type": "loop",
  "source": "rain-light",
  "duration": { "min": 20, "max": 40 },
  "gain": { "min": 0.5, "max": 0.8 },
  "pan": { "mode": "fixed", "value": 0 }
}
```

### Track — Event type

```json
{
  "label": "Thunder Crack",
  "type": "event",
  "clones": 1,
  "sources": ["thunder-close", "thunder-distant"],
  "delay": { "min": 5, "max": 20 },
  "delayAfterPrev": { "min": 3, "max": 10 },
  "gain": { "min": 0.6, "max": 1.0 },
  "pan": { "mode": "random", "min": -0.8, "max": 0.8 }
}
```

**Pan modes:**
- Loop tracks: `"fixed"` (single `value`) | `"random"` (`min`/`max` range)
- Event tracks: `"fixed"` | `"random"` | `"left-to-right"` | `"right-to-left"`

**Dynamic slider limits:**
- Event delay max: `longestSourceDuration × 10`, clamped 1–60s
- Loop duration max: assigned source's effective duration, clamped 4–60s

## Playback & Recording

Playback uses `AmbientCoffee` (from `public/js/lib/ambient-coffee.mjs`):

```js
coffee.loadBrew(brew)         // load sources and build audio graph
coffee.playBrew(label)        // fade in and start
coffee.cutInto(brew)          // hard cut (used for recording mode start)
coffee.stop()                 // fade out and stop
```

Live channel properties are updated during playback by calling methods on the coffee instance — gain, muffle, reverb, radio, underwater all take effect immediately without stopping.

**Recording flow:**
1. `cutInto(brew)` starts playback with no fade-in.
2. `MediaRecorder` captures the audio context destination stream.
3. On stop, recorded chunks are decoded from WebM to PCM WAV.
4. WAV blob is uploaded via `POST /upload/audio` (multipart).
5. Returned media entry appears in the gallery.

## Persistence

```
server/database/brew-data.json        — array of { uid, name, data }
server/database/sound-sources.json    — array of SoundSource (global library)
```

Legacy brews without UIDs are automatically assigned stable UIDs on first read by the service layer.
