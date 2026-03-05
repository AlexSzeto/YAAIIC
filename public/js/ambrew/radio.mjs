/**
 * RadioEffect — bandpass filter + saturation, with two profile variants.
 *
 * Signal chain (wet): input → bandpass → WaveShaper (soft clip) → wetGain → output
 * Dry path:           input → output
 *
 * Profiles:
 *   'old-radio'    — 1800 Hz centre, Q 0.7 (wide telephone band), k=16
 *   'walkie-talkie' — 1200 Hz centre, Q 2.0 (narrower, more cupped), k=32
 */

const RADIO_PROFILES = {
  'old-radio':     { frequency: 1800, q: 2.0,  drive: 24,  gain: 0.8 },
  'walkie-talkie': { frequency: 1000, q: 4.0,  drive: 128, gain: 0.2 },
}

export class RadioEffect {
  #input      // GainNode — entry point, splits into dry and wet
  #bandpass   // BiquadFilterNode
  #shaper     // WaveShaperNode
  #wetGain    // GainNode — wet mix level (also carries per-profile gain compensation)
  #output     // GainNode — merge point

  constructor(ctx) {
    this.#input   = ctx.createGain()
    this.#output  = ctx.createGain()

    this.#bandpass = ctx.createBiquadFilter()
    this.#bandpass.type = 'bandpass'
    // Initialise to old-radio defaults; profile is applied on first setActive call
    this.#bandpass.frequency.value = RADIO_PROFILES['old-radio'].frequency
    this.#bandpass.Q.value         = RADIO_PROFILES['old-radio'].q

    this.#shaper = ctx.createWaveShaper()
    this.#shaper.curve = RadioEffect.#makeSaturationCurve(256, RADIO_PROFILES['old-radio'].drive)
    this.#shaper.oversample = '2x'

    this.#wetGain = ctx.createGain()
    this.#wetGain.gain.value = 0  // dry by default

    // Dry path
    this.#input.connect(this.#output)
    // Wet path
    this.#input.connect(this.#bandpass)
    this.#bandpass.connect(this.#shaper)
    this.#shaper.connect(this.#wetGain)
    this.#wetGain.connect(this.#output)
  }

  static #makeSaturationCurve(samples, k) {
    const curve = new Float32Array(samples)
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1  // -1 … +1
      curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x))
    }
    return curve
  }

  get input()  { return this.#input }
  get output() { return this.#output }

  /**
   * Apply a radio profile (or disable).
   * @param {string|null} profile - 'old-radio' | 'walkie-talkie' | null/falsy for off
   * @param {number} [duration=0] - Ramp duration in seconds for the wet gain
   */
  setActive(profile, duration = 0) {
    const p = profile ? (RADIO_PROFILES[profile] ?? RADIO_PROFILES['old-radio']) : null
    if (p) {
      this.#bandpass.frequency.value = p.frequency
      this.#bandpass.Q.value         = p.q
      this.#shaper.curve = RadioEffect.#makeSaturationCurve(256, p.drive)
    }

    const target = p ? p.gain : 0
    const ctx = this.#wetGain.context
    if (duration > 0) {
      this.#wetGain.gain.linearRampToValueAtTime(target, ctx.currentTime + duration)
    } else {
      this.#wetGain.gain.setValueAtTime(target, ctx.currentTime)
    }
  }

  connect(dest)  { this.#output.connect(dest) }
  disconnect()   { this.#output.disconnect() }
  dispose()      { this.#input.disconnect(); this.disconnect() }
}
