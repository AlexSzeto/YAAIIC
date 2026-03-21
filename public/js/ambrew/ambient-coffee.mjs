import { MuffleEffect } from './muffle.mjs'
import { ReverbEffect } from './reverb.mjs'
import { RadioEffect } from './radio.mjs'
import { UnderwaterEffect } from './underwater.mjs'

// Defines canonical order of effects from source → output.
// Frequency-shaping first (muffle, old-radio, underwater), then spatial/temporal (reverb).
// Pan and gain-range are per-track concerns, not channel-level effects.
const EFFECT_CHAIN_PRIORITY = ['muffle', 'reverb', 'radio', 'underwater']

export class Range {
  /** @type {number} */
  min
  /** @type {number} */
  max

  static fromData(data, defaultMin, defaultMax) {
    let min, max
    if (!!data && typeof data === 'object') {
      min = data.min ?? defaultMin
      max = data.max ?? defaultMax
    } else {
      min = defaultMin
      max = defaultMax
    }
    return new Range(min, max)
  }

  constructor(min = 0, max = 0) {
    this.min = min
    this.max = max
  }

  get random() {
    return Math.random() * (this.max - this.min) + this.min
  }
}

class NonRepeatingPicker {
  #prev = -1

  /**
   *
   * @param {Array} array An array of elements to pick from
   * @returns {any} A non-repeating random element from the array
   */
  random(array) {
    let index = Math.floor(Math.random() * (array.length - 1))
    if (index === this.#prev) {
      index = (index + 1) % array.length
    }
    this.#prev = index
    return array[index]
  }
}

export class SoundClip {
  /** @type {string} */
  #url = null
  /** @type {boolean} */
  #loaded = false
  /** @type {AudioBuffer} */
  #buffer = null
  /** @type {number|null} seconds, or null for buffer start */
  #start = null
  /** @type {number|null} seconds, or null for buffer end */
  #end = null

  /**
   *
   * @param {string} url
   */
  constructor(url = null) {
    this.#loaded = false
    this.#url = url
  }

  get url() {
    return this.#url
  }

  get loaded() {
    return this.#loaded
  }

  get buffer() {
    return this.#buffer
  }

  get duration() {
    if (!this.#buffer) return 0
    return (this.#end ?? this.#buffer.duration) - (this.#start ?? 0)
  }

  get startOffset() {
    return this.#start ?? 0
  }

  get endOffset() {
    return this.#end
  }

  get effectiveDuration() {
    return (this.#end ?? this.#buffer.duration) - this.startOffset
  }

  setOffsets(start, end) {
    this.#start = start ?? null
    this.#end   = end   ?? null
  }

  load(url = null) {
    if (this.#loaded) {
      if (this.#url === url) {
        return Promise.resolve()
      } else {
        this.unload()
      }
    }
    if (!url && !this.#url) {
      return Promise.reject(new Error('No URL provided'))
    } else if (!!url) {
      this.#url = url
    }

    return new Promise((resolve, reject) => {
      fetch(this.#url)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => {
          AmbientCoffee.audioContext.decodeAudioData(
            arrayBuffer,
            (buffer) => {
              this.#buffer = buffer
              this.#loaded = true
              resolve()
            },
            reject
          )
        })
        .catch(reject)
    })
  }

  unload() {
    this.#buffer.stop()
    this.#buffer.disconnect()

    this.#buffer = null
    this.#loaded = false
  }
}

/**
 * @interface LabeledObject
 */
class LabeledObject {
  /** @type {string} */
  label
}

/**
 * @class SoundSource
 * @implements LabeledObject
 */
export class SoundSource {
  /** @type {string} */
  label

  /** @type {SoundClip[]} */
  #clips = []

  /** @type {Range} Number of clips played per event */
  repeatCount

  /** @type {Range} Delay between end and start of repeats in seconds */
  repeatDelay

  /** @type {Range} Attack (fade in time) in seconds */
  attack

  /** @type {Range} Decay (fade out time) in seconds */
  decay

  /**
   *
   * @param {string} label
   * @param {SoundClip[]} clips
   * @param {Object} options
   * @param {Range} options.repeatCount
   * @param {Range} options.repeatDelay
   * @param {Range} options.attack
   * @param {Range} options.decay
   *
   */
  constructor(
    label,
    clips,
    { repeatCount = null, repeatDelay = null, attack = null, decay = null } = {}
  ) {
    this.label = label
    this.#clips = clips
    this.repeatCount = Range.fromData(repeatCount, 1, 1)
    this.repeatDelay = Range.fromData(repeatDelay, 0, 0)
    this.attack = Range.fromData(attack, 0, 0)
    this.decay = Range.fromData(decay, 0, 0)
  }

  /**
   * @returns {Range}
   * @readonly
   */
  get duration() {
    return this.#clips.reduce((range, clip) => {
      range.min = Math.min(range.min, clip.duration)
      range.max = Math.max(range.max, clip.duration)
      return range
    }, new Range(Number.MAX_VALUE, Number.MIN_VALUE))
  }

  /**
   * @returns {SoundClip[]}
   * @readonly
   */
  get clips() {
    return this.#clips
  }
  /**
   * plays the clip multiple times according to repeatCount and repeatDelay,
   * and uses the attack and decay times to envelope the entire sequence.
   * Each clip is drawn randomly from the source clips and played in full.
   * @param {AudioNode} destination
   * @param {number} when
   * @returns {number} Duration of the play event
   */
  repeatInto(destination, when) {
    const repeats = this.repeatCount.random
    const envelope = AmbientCoffee.audioContext.createGain()
    envelope.connect(destination)

    const start = when
    const pick = new NonRepeatingPicker()
    for (let i = 0; i < repeats; i++) {
      const clip = pick.random(this.#clips)

      const bufferSource = AmbientCoffee.audioContext.createBufferSource()
      bufferSource.buffer = clip.buffer
      bufferSource.connect(envelope)
      bufferSource.start(when, clip.startOffset, clip.effectiveDuration)

      when += this.repeatDelay.random + clip.effectiveDuration
    }

    let attack = this.attack.random
    let decay = this.decay.random

    const envelopeLength = attack + decay
    const playLength = when - start
    if (playLength < envelopeLength) {
      attack = (playLength * attack) / envelopeLength
      decay = (playLength * decay) / envelopeLength
    }

    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(1, start + attack)
    envelope.gain.linearRampToValueAtTime(1, start + playLength - decay)
    envelope.gain.linearRampToValueAtTime(0, start + playLength)

    return playLength
  }

  /**
   * picks a random clip from the source clips and plays a segment of it into the destination.
   * The inner offset is randomly chosen within the clip's duration.
   * repeat and envelope values are ignored.
   * @param {AudioNode} destination
   * @param {number} when
   * @param {number} duration
   * @returns
   */
  playSegmentInto(destination, when, duration) {
    const pick = new NonRepeatingPicker()
    const clip = pick.random(this.#clips)
    const available = clip.effectiveDuration
    duration = Math.min(duration, available)
    const offset = clip.startOffset + Math.random() * (available - duration)

    const bufferSource = AmbientCoffee.audioContext.createBufferSource()
    bufferSource.buffer = clip.buffer
    bufferSource.connect(destination)
    bufferSource.start(when, offset, duration)

    return duration
  }
}

/**
 * @interface AmbientTrack
 */
class AmbientTrack {
  playInto(destinationNode) {}
  disconnect() {}
}

/**
 * @class EventTrack
 * @implements AmbientTrack, LabeledObject
 */
export class EventTrack {
  /** @type {string} */
  label

  /** @type {string} */
  type = 'event'

  /** @type {SoundSource[]} */
  #sources = []

  /** @type {Range} */
  #eventDelay

  /** @type {boolean} */
  #delayAfterPrev

  /** @type {NonRepeatingPicker} */
  #eventSourcePicker = new NonRepeatingPicker()

  /** @type {number} */
  #eventTimeHandler = -1

  /** @type {GainNode} */
  #gain

  /** @type {StereoPannerNode|null} */
  #panner = null

  /** @type {boolean} */
  #playing = false

  /** @type {Range|null} */
  #gainRange = null

  /** @type {{ mode: string, value?: number, min?: number, max?: number }|null} */
  #panConfig = null

  /**
   * @param {string} label
   * @param {SoundSource[]} sources
   * @param {Object} options
   * @param {Range} [options.delay]
   * @param {boolean} [options.delayAfterPrev]
   * @param {{ min: number, max: number }|null} [options.gain]
   * @param {{ mode: string, value?: number, min?: number, max?: number }|null} [options.pan]
   */
  constructor(label, sources, { delay = null, delayAfterPrev = true, gain = null, pan = null } = {}) {
    this.label = label
    this.#sources = sources
    this.#eventDelay = Range.fromData(delay, 0, 0)
    this.#delayAfterPrev = delayAfterPrev
    this.#gainRange = Range.fromData(gain, 0.5, 0.5)
    this.#panConfig = pan ?? null
    if (
      this.#eventDelay.min === 0 &&
      this.#eventDelay.max === 0 &&
      !this.#delayAfterPrev
    ) {
      this.#delayAfterPrev = true
    }
  }

  /** @param {{ min: number, max: number }|Range|null} data */
  setGainRange(data) { this.#gainRange = Range.fromData(data, 0.5, 0.5) }

  /**
   * Updates the pan configuration. For fixed/off: updates the shared panner immediately.
   * For random/sweep modes: the change takes effect on the next event.
   * @param {{ mode: string, value?: number, min?: number, max?: number }|null} panConfig
   */
  setPanConfig(panConfig) {
    this.#panConfig = panConfig ?? null
    if (!this.#panner) return
    // For fixed/off modes we can update the shared panner in-place.
    // Dynamic modes are handled per-event so we just reset to centre here.
    const mode = this.#panConfig?.mode
    if (mode !== 'random' && mode !== 'left-to-right' && mode !== 'right-to-left') {
      const target = mode === 'fixed' ? (this.#panConfig.value ?? 0) : 0
      this.#panner.pan.cancelScheduledValues(this.#panner.context.currentTime)
      this.#panner.pan.setValueAtTime(target, this.#panner.context.currentTime)
    }
  }

  #playEventLoops() {
    const source = this.#eventSourcePicker.random(this.#sources)
    const delay = this.#eventDelay.random
    const when = this.#gain.context.currentTime + delay

    // Per-event gain node — random gain applies only to this event so concurrent
    // clones and the internal envelope inside repeatInto are unaffected.
    const eventGain = AmbientCoffee.audioContext.createGain()
    eventGain.gain.setValueAtTime(this.#gainRange.random, when)

    const panMode = this.#panConfig?.mode
    const useDynamicPan = panMode === 'random' || panMode === 'left-to-right' || panMode === 'right-to-left'

    let eventPanner = null
    if (useDynamicPan) {
      // Insert a per-event panner between eventGain and #gain so concurrent events
      // from clones each have independent pan positions.
      eventPanner = AmbientCoffee.audioContext.createStereoPanner()
      eventGain.connect(eventPanner)
      eventPanner.connect(this.#gain)
    } else {
      eventGain.connect(this.#gain)
    }

    const duration = source.repeatInto(eventGain, when)

    if (useDynamicPan && eventPanner) {
      if (panMode === 'random') {
        const min = this.#panConfig.min ?? -1
        const max = this.#panConfig.max ?? 1
        eventPanner.pan.setValueAtTime(min + Math.random() * (max - min), when)
      } else if (panMode === 'left-to-right') {
        eventPanner.pan.setValueAtTime(-1, when)
        eventPanner.pan.linearRampToValueAtTime(1, when + duration)
      } else if (panMode === 'right-to-left') {
        eventPanner.pan.setValueAtTime(1, when)
        eventPanner.pan.linearRampToValueAtTime(-1, when + duration)
      }
      setTimeout(() => { eventPanner.disconnect(); eventGain.disconnect() }, (delay + duration + 1) * 1000)
    } else {
      setTimeout(() => eventGain.disconnect(), (delay + duration + 1) * 1000)
    }

    this.#eventTimeHandler = setTimeout(
      this.#playEventLoops.bind(this),
      (this.#delayAfterPrev ? duration + delay : delay) * 1000
    )
  }

  playInto(destination) {
    if (this.#playing) {
      this.disconnect()
    }
    this.#gain = AmbientCoffee.audioContext.createGain()
    this.#panner = AmbientCoffee.audioContext.createStereoPanner()
    // Apply initial pan config (fixed/off sets the panner; dynamic modes leave it at 0)
    const mode = this.#panConfig?.mode
    if (mode === 'fixed') {
      this.#panner.pan.value = this.#panConfig.value ?? 0
    }
    this.#gain.connect(this.#panner)
    this.#panner.connect(destination)
    this.#playing = true
    this.#playEventLoops()
  }

  disconnect() {
    if (!this.#playing) {
      return
    }
    clearTimeout(this.#eventTimeHandler)
    this.#eventTimeHandler = -1
    this.#panner.disconnect()
    this.#gain.disconnect()
    this.#playing = false
  }
}

/**
 * @class LoopingTrack
 * @implements AmbientTrack, LabeledObject
 */
export class LoopingTrack {
  static defaultCrossFadeDuration = 2
  /** Minimum loop segment duration (s) required for equal-power crossfades to not overlap. */
  static minSegmentDuration = 2 * LoopingTrack.defaultCrossFadeDuration

  static #equalPowerCrossfadeInCurve = ((resolution) =>
    new Float32Array(resolution).map((_, i) =>
      Math.sin((i / (resolution - 1)) * 0.5 * Math.PI)
    ))(64)
  static #equalPowerCrossfadeOutCurve = LoopingTrack.#equalPowerCrossfadeInCurve.slice().reverse()

  /** @type {string} */
  label

  /** @type {string} */
  type = 'loop'

  /** @type {SoundSource} */
  #source

  /** @type {Range} */
  #duration

  /** @type {number} */
  #crossfadeDuration

  /** @type {number} */
  #eventTimeHandler = -1

  /** @type {GainNode} */
  #gain

  /** @type {StereoPannerNode|null} */
  #panner = null

  /** @type {boolean} */
  #playing = false

  /** @type {Range} */
  #gainRange

  /** @type {{ mode: string, value?: number, min?: number, max?: number }|null} */
  #panConfig = null

  /** @type {number|null} Ending gain of the previous segment, used as starting gain for the next. */
  #currentGain = null

  /** @type {number|null} Ending pan of the previous segment, used as starting pan for the next. */
  #currentPan = null

  /**
   * @param {string} label
   * @param {SoundSource} source
   * @param {Object} options
   * @param {{ min: number, max: number }|null} [options.duration]
   * @param {{ min: number, max: number }|null} [options.gain]
   * @param {{ mode: string, value?: number, min?: number, max?: number }|null} [options.pan]
   */
  constructor(label, source, { duration = null, gain = null, pan = null } = {}) {
    this.label = label
    this.#source = source
    this.#duration = Range.fromData(
      duration,
      source.duration.min,
      source.duration.max
    )
    this.#crossfadeDuration = Math.min(
      LoopingTrack.defaultCrossFadeDuration,
      source.duration.min / 2
    )
    this.#gainRange = Range.fromData(gain, 0.5, 0.5)
    this.#panConfig = pan ?? null
  }

  /** @param {{ min: number, max: number }|Range|null} data */
  setGainRange(data) { this.#gainRange = Range.fromData(data, 0.5, 0.5) }

  /**
   * Updates the pan configuration. Fixed, random, and off modes are supported for loop tracks.
   * @param {{ mode: string, value?: number, min?: number, max?: number }|null} panConfig
   */
  setPanConfig(panConfig) {
    this.#panConfig = panConfig ?? null
    this.#currentPan = null // reset so next segment picks a fresh value in the new range
    if (!this.#panner) return
    if (this.#panConfig?.mode === 'fixed') {
      const target = this.#panConfig.value ?? 0
      this.#panner.pan.cancelScheduledValues(this.#panner.context.currentTime)
      this.#panner.pan.setValueAtTime(target, this.#panner.context.currentTime)
    } else if (this.#panConfig?.mode !== 'random') {
      // Off — cancel any scheduled ramp and centre immediately
      this.#panner.pan.cancelScheduledValues(this.#panner.context.currentTime)
      this.#panner.pan.setValueAtTime(0, this.#panner.context.currentTime)
    }
    // For 'random', the running ramp continues until the next segment boundary
  }

  #playContinuousAmbience() {
    const ctx = AmbientCoffee.audioContext
    const when = this.#gain.context.currentTime
    const duration = Math.max(this.#crossfadeDuration * 2, this.#duration.random)

    // Node 1: equal-power crossfade shape (0 → 1 → 1 → 0)
    const crossFadeGain = ctx.createGain()
    this.#source.playSegmentInto(crossFadeGain, when, duration)
    crossFadeGain.gain.setValueAtTime(0, when)
    crossFadeGain.gain.setValueCurveAtTime(LoopingTrack.#equalPowerCrossfadeInCurve, when, this.#crossfadeDuration)
    crossFadeGain.gain.setValueCurveAtTime(LoopingTrack.#equalPowerCrossfadeOutCurve, when + duration - this.#crossfadeDuration, this.#crossfadeDuration)

    // Node 2: gain ramp from gainStart to gainEnd over the full segment duration
    const gainStart = this.#currentGain ?? this.#gainRange.random
    const gainEnd = this.#gainRange.random
    this.#currentGain = gainEnd
    const gainRampGain = ctx.createGain()
    gainRampGain.gain.setValueAtTime(gainStart, when)
    gainRampGain.gain.linearRampToValueAtTime(gainEnd, when + duration)

    crossFadeGain.connect(gainRampGain)
    gainRampGain.connect(this.#gain)

    // Pan ramp: random mode sweeps from previous end to a new random end each segment
    if (this.#panConfig?.mode === 'random') {
      const min = this.#panConfig.min ?? -1
      const max = this.#panConfig.max ?? 1
      const panStart = this.#currentPan ?? (min + Math.random() * (max - min))
      const panEnd = min + Math.random() * (max - min)
      this.#currentPan = panEnd
      this.#panner.pan.setValueAtTime(panStart, when)
      this.#panner.pan.linearRampToValueAtTime(panEnd, when + duration)
    }

    this.#eventTimeHandler = setTimeout(this.#playContinuousAmbience.bind(this), (duration - this.#crossfadeDuration) * 1000)
  }

  playInto(destination) {
    if (this.#playing) {
      this.disconnect()
    }
    this.#currentGain = null
    this.#currentPan = null
    this.#gain = AmbientCoffee.audioContext.createGain()
    this.#panner = AmbientCoffee.audioContext.createStereoPanner()
    // Apply initial pan for fixed mode; random mode sets values per-segment in #playContinuousAmbience
    if (this.#panConfig?.mode === 'fixed') {
      this.#panner.pan.value = this.#panConfig.value ?? 0
    }
    this.#gain.connect(this.#panner)
    this.#panner.connect(destination)
    this.#playing = true
    this.#playContinuousAmbience()
  }

  disconnect() {
    if (!this.#playing) {
      return
    }
    clearTimeout(this.#eventTimeHandler)
    this.#eventTimeHandler = -1
    this.#panner.disconnect()
    this.#gain.disconnect()
    this.#playing = false
  }
}

/**
 * @class AmbientChannel
 * @implements AmbientTrack, LabeledObject
 */
const DISTANCE_GAIN_MAP = {
  'very-far': { min: 0.1,  max: 0.1  },
  'far':      { min: 0.25, max: 0.25 },
  'medium':   { min: 0.5,  max: 0.5  },
  'close':    { min: 0.75, max: 0.75 },
}

export class AmbientChannel {
  /** Duration (seconds) for all property transition ramps. */
  static PROPERTY_TRANSITION_DURATION = 0.25

  /** @type {string} */
  label

  /** @type {AmbientTrack[]} */
  #tracks = []

  /** @type {boolean} */
  #playing = false

  /** @type {Map<string, object>} name → AudioEffect instance */
  #effects = new Map()

  /** @type {object[]} ordered subset of #effects, rebuilt on change */
  #chain = []

  /** @type {AudioNode} entry point of the chain (first effect's input, or #output) */
  #first

  /** @type {GainNode} enable/disable control — always last in chain */
  #output

  /** @type {boolean} */
  #enabled = true

  /** @type {number} master volume (0–1) applied to #output */
  #gain = 0.5

  constructor(
    label,
    tracks,
    { gain = null, distance, muffle = null, muffled, reverb = null, radio = null, oldRadio = false, underwater = false } = {}
  ) {
    this.label = label
    this.#tracks = tracks

    // Backward compat: distance string → single gain value
    if (gain === null && distance) {
      const mapped = DISTANCE_GAIN_MAP[distance]
      gain = mapped ? (mapped.min + mapped.max) / 2 : 0.5
    }
    // Backward compat: old gain range object → midpoint
    if (typeof gain === 'object' && gain !== null) {
      gain = ((gain.min ?? 0.5) + (gain.max ?? 0.5)) / 2
    }
    this.#gain = gain ?? 0.5

    // Backward compat: old boolean muffle/reverb fields → profile strings
    if (muffle === null && muffled === true)  muffle = 'thick-wall'
    if (typeof reverb === 'boolean')          reverb = reverb ? 'church' : null
    // Backward compat: old boolean oldRadio field → radio profile
    if (!radio && oldRadio === true)          radio  = 'old-radio'

    const ctx = AmbientCoffee.audioContext
    this.#output = ctx.createGain()
    this.#output.gain.value = this.#gain

    this.#effects.set('muffle', new MuffleEffect(ctx))
    this.#effects.set('reverb', new ReverbEffect(ctx))
    this.#effects.set('radio', new RadioEffect(ctx))
    this.#effects.set('underwater', new UnderwaterEffect(ctx))
    this.#rebuildChain()

    // Apply initial property states without transition
    if (muffle)    this.#effects.get('muffle').setActive(muffle)
    if (reverb)    this.#effects.get('reverb').setActive(reverb)
    if (radio)     this.#effects.get('radio').setActive(radio)
    if (underwater) this.#effects.get('underwater').setActive(true)
  }

  #rebuildChain() {
    // Disconnect existing chain wiring
    for (const effect of this.#chain) effect.disconnect()

    // Build ordered array from priority list (skip missing entries)
    this.#chain = EFFECT_CHAIN_PRIORITY
      .filter(name => this.#effects.has(name))
      .map(name => this.#effects.get(name))

    // Wire: effect[0] → effect[1] → … → #output
    this.#first = this.#chain[0]?.input ?? this.#output
    for (let i = 0; i < this.#chain.length; i++) {
      const dest = this.#chain[i + 1]?.input ?? this.#output
      this.#chain[i].connect(dest)
    }
  }

  /**
   * Sets the master channel volume with a smooth ramp.
   * @param {number} value - 0.0 to 1.0
   */
  setGain(value) {
    this.#gain = value
    if (this.#enabled) {
      const ctx = AmbientCoffee.audioContext
      this.#output.gain.linearRampToValueAtTime(value, ctx.currentTime + AmbientChannel.PROPERTY_TRANSITION_DURATION)
    }
  }

  /**
   * Sets the muffle profile with a smooth transition.
   * @param {string|null} profile - 'glass-window' | 'thick-wall' | 'outside-car' | null (off)
   */
  setMuffle(profile) {
    this.#effects.get('muffle')?.setActive(profile, AmbientChannel.PROPERTY_TRANSITION_DURATION)
  }

  /**
   * Sets the reverb profile with a smooth transition.
   * @param {string|null} profile - 'small-room' | 'church' | 'opera-hall' | null (off)
   */
  setReverb(profile) {
    this.#effects.get('reverb')?.setActive(profile, AmbientChannel.PROPERTY_TRANSITION_DURATION)
  }

  /**
   * Sets the radio effect profile with a smooth transition.
   * @param {string|null} profile - 'old-radio' | 'walkie-talkie' | null (off)
   */
  setRadio(profile) {
    this.#effects.get('radio')?.setActive(profile, AmbientChannel.PROPERTY_TRANSITION_DURATION)
  }

  /**
   * Enables or disables the underwater effect with a smooth transition.
   * @param {boolean} active
   */
  setUnderwater(active) {
    this.#effects.get('underwater')?.setActive(active, AmbientChannel.PROPERTY_TRANSITION_DURATION)
  }

  /**
   * Enables or disables this channel by ramping the output gain.
   * When re-enabling, ramps back to the current #gain value (not 1.0).
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.#enabled = enabled
    const target = enabled ? this.#gain : 0
    const ctx = AmbientCoffee.audioContext
    this.#output.gain.linearRampToValueAtTime(
      target,
      ctx.currentTime + AmbientChannel.PROPERTY_TRANSITION_DURATION
    )
  }

  /**
   * Returns the track at the given index, or null if out of range.
   * Used by brew-editor for per-track live updates during preview.
   * @param {number} index
   * @returns {EventTrack|LoopingTrack|null}
   */
  getTrack(index) {
    return this.#tracks[index] ?? null
  }

  playInto(destination) {
    if (this.#playing) {
      this.disconnect()
    }
    this.#tracks.forEach((track) => track.playInto(this.#first))
    this.#output.connect(destination)
    this.#playing = true
  }

  disconnect() {
    if (!this.#playing) {
      return
    }
    this.#tracks.forEach((track) => track.disconnect())
    this.#output.disconnect()
    this.#playing = false
  }
}

/**
 * @class AmbientBrew
 * @implements LabeledObject
 */
class AmbientBrew {
  /** @type {string} */
  label

  /** @type {AmbientChannel[]} */
  #channels = []

  /** @type {GainNode} */
  #fade = AmbientCoffee.audioContext.createGain()

  /** @type {number} */
  #fadeDuration

  /** @type {boolean} */
  #playing = false

  constructor(fadeDuration = 2) {
    this.#fadeDuration = fadeDuration
    this.#fade.gain.value = 0
  }

  #fixBaseUrl(url) {
    if (url.length > 0 && !url.endsWith('/')) {
      return url + '/'
    } else {
      return url
    }
  }

  /**
   * Loads an ambient brew into the player using a brew definition object.
   * @param {Object} recipe An ambient brew definition, preferrably deserialized from JSON
   * @returns {Promise} A promise that resolves when the brew is loaded
   */
  async load(recipe) {
    this.label = recipe.label
    const mediaUrl =
      recipe.mediaUrl !== null ? this.#fixBaseUrl(recipe.mediaUrl) : './'

    return new Promise((resolve, reject) => {
      const clipLibrary = []
      const loadingClips = []
      const fullURL = (url) => mediaUrl + url

      const insertClip = (clipData) => {
        const url = typeof clipData === 'string' ? clipData : clipData.url
        const start = typeof clipData === 'object' ? (clipData.start ?? null) : null
        const end = typeof clipData === 'object' ? (clipData.end ?? null) : null
        const alreadyAdded = clipLibrary.find(
          (c) => c.url === fullURL(url) && c.startOffset === (start ?? 0) && c.endOffset === end
        )
        if (!alreadyAdded) {
          const clip = new SoundClip()
          if (start != null || end != null) {
            clip.setOffsets(start, end)
          }
          clipLibrary.push(clip)
          loadingClips.push(clip.load(fullURL(url)))
        }
      }

      recipe.sources = recipe.sources.map(({ clips, ...rest }) => {
        clips = clips
          .map((data) => {
            if (
              typeof data === 'object' &&
              !!data.prefix &&
              !!data.min &&
              !!data.max
            ) {
              const padding = data.padding ?? 0
              const extension = data.extension ?? 'mp3'
              const unpack = []
              for (let i = data.min; i <= data.max; i++) {
                unpack.push(
                  `${data.prefix}${i
                    .toString()
                    .padStart(padding, '0')}.${extension}`
                )
              }
              return unpack
            } else if (typeof data === 'object' && data.url) {
              return [data]  // preserve full object so start/end survive
            } else if (typeof data === 'string') {
              return [data]
            }
            return []
          })
          .flat()
        clips.forEach(insertClip)
        return { clips, ...rest }
      })
      const fetchClip = (clipData) => {
        const url = typeof clipData === 'string' ? clipData : clipData.url
        const start = typeof clipData === 'object' ? (clipData.start ?? null) : null
        const end = typeof clipData === 'object' ? (clipData.end ?? null) : null
        return clipLibrary.find(
          (clip) => clip.url === fullURL(url) && clip.startOffset === (start ?? 0) && clip.endOffset === end
        )
      }

      Promise.all(loadingClips)
        .then(() => {
          const sources = recipe.sources.map(
            ({ label, clips, ...props }) =>
              new SoundSource(label, clips.map(fetchClip), props)
          )
          const fetchSource = (label) =>
            sources.find((source) => source.label === label)

          const channels = recipe.channels.map(
            ({ label, tracks, ...channelProps }) =>
              new AmbientChannel(
                label,
                tracks.reduce(
                  (ambientTracks, { label, type, clones, ...trackProps }) => {
                    clones = clones ?? 1
                    for (let i = 0; i < clones; i++) {
                      switch (type) {
                        case 'event':
                          ambientTracks.push(
                            new EventTrack(
                              label,
                              trackProps.sources.map(fetchSource),
                              trackProps
                            )
                          )
                          break
                        case 'loop':
                          ambientTracks.push(
                            new LoopingTrack(
                              label,
                              fetchSource(trackProps.source),
                              trackProps
                            )
                          )
                          break
                        default:
                          reject(new Error(`Unknown track type: ${type}`))
                      }
                    }
                    return ambientTracks
                  },
                  []
                ),
                channelProps
              )
          )
          this.label = recipe.label
          this.#channels = channels
          resolve()
        })
        .catch(reject)
    })
  }

  /**
   * Returns the AmbientChannel with the given label, or null if not found.
   * @param {string} label
   * @returns {AmbientChannel|null}
   */
  getChannel(label) {
    return this.#channels.find(ch => ch.label === label) ?? null
  }

  /**
   *
   * @param {AudioNode} destination
   */
  fadeInto(destination) {
    if (this.#playing) {
      this.disconnect()
    }
    this.#channels.forEach((channel) => channel.playInto(this.#fade))
    this.#fade.connect(destination)
    this.#fade.gain.linearRampToValueAtTime(
      1,
      this.#fade.context.currentTime + this.#fadeDuration
    )
    this.#playing = true
  }

  disconnect() {
    this.#channels.forEach((channel) => channel.disconnect())
  }

  fadeOut() {
    return new Promise((resolve) => {
      this.#fade.gain.linearRampToValueAtTime(
        0,
        this.#fade.context.currentTime + this.#fadeDuration
      )
      setTimeout(() => {
        this.disconnect()
        resolve()
      }, this.#fadeDuration * 1000)
    })
  }
}

/** A player for ambient brews - a collection of sound clips and definitions on
 * when, where, and how to play them, to create a dynamic ambient soundscape.
 *
 * The player provides a reusable AudioContext, but does not connect directly to
 * it by default. Instead, it provides a master gain node that can be connect to
 * the AudioContext for direct playback or another node for more processing.
 *
 * @class AmbientCoffee
 */
export class AmbientCoffee {
  /** @type {AudioContext} */
  static audioContext = new AudioContext()

  /** @type {AmbientBrew[]} */
  #brews = []

  /** @type string */
  #baseUrl = ''

  /** @type {AmbientBrew} */
  #brewing = null

  /** @type {GainNode} */
  #master = AmbientCoffee.audioContext.createGain()

  /**
   *
   * @param {string} [baseUrl=''] The default base URL that all brew clips reference.
   */
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
    this.#master.connect(AmbientCoffee.audioContext.destination)
  }

  /** @type {string} */
  set baseUrl(url) {
    this.#baseUrl = url
  }

  /**
   * @returns {AudioParam}
   */
  get gain() {
    return this.#master.gain
  }

  /**
   * Loads an ambient brew into the player using a brew definition object.
   * @param {Object} recipe An ambient brew definition, preferrably deserialized from JSON
   * @returns {Promise} A promise that resolves when the brew is loaded
   */
  async loadBrew(recipe) {
    const brew = new AmbientBrew()
    if (!recipe.mediaUrl) {
      recipe.mediaUrl = this.#baseUrl
    }
    const loadBrew = brew.load(recipe)
    loadBrew.then(() => this.#brews.push(brew))
    return loadBrew
  }

  /**
   *
   * @param {string} label The label of a loaded ambient brew
   * @returns
   */
  playBrew(label) {
    const nextBrew = this.#brews.find((brew) => brew.label === label)
    if (!nextBrew) {
      console.error(`Brew not found: ${label}`)
      return
    }

    if (this.#brewing) {
      this.#brewing.fadeOut().then(() => {
        this.#brewing = nextBrew
        this.#brewing.fadeInto(this.#master)
      })
    } else {
      this.#brewing = nextBrew
      this.#brewing.fadeInto(this.#master)
    }
  }

  /**
   * Immediately stops and disconnects the currently playing brew.
   * Safe to call even when nothing is playing.
   */
  stop() {
    if (this.#brewing) {
      this.#brewing.disconnect()
      this.#brewing = null
    }
  }

  connect(destination) {
    this.#master.connect(destination)
  }

  /**
   * Returns the AmbientChannel with the given label from the currently playing brew.
   * Returns null if no brew is playing or the channel is not found.
   * @param {string} label
   * @returns {AmbientChannel|null}
   */
  getChannel(label) {
    return this.#brewing?.getChannel(label) ?? null
  }

  /**
   * Immediately silences any currently playing brew (zeroes master gain) and
   * begins playing the supplied recipe at full volume — a hard cut with no
   * crossfade.  Use this when starting a timed recording so the recorder
   * captures audio from the very first moment.
   *
   * @param {Object} recipe An ambient brew definition (same format as loadBrew)
   * @returns {Promise} Resolves when the recipe has been loaded and playback started
   */
  async cutInto(recipe) {
    // Silence the current output immediately
    this.#master.gain.value = 0

    await this.loadBrew(recipe)
    this.playBrew(recipe.label)

    // Restore full volume immediately (no fade)
    this.#master.gain.value = 1
  }
}
