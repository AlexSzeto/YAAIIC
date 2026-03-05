/**
 * OldRadioEffect — bandpass filter + mild saturation to simulate a telephone/old-radio sound.
 *
 * Signal chain (wet): input → bandpass (~1800 Hz, Q ~0.7) → WaveShaper (soft clip) → wetGain → output
 * Dry path:           input → output
 *
 * Dry by default (wetGain = 0). Call setActive(true) to blend in the effect.
 */
export class OldRadioEffect {
  #input      // GainNode — entry point, splits into dry and wet
  #bandpass   // BiquadFilterNode — 300–3400 Hz pass band
  #shaper     // WaveShaperNode — mild soft-clip saturation
  #wetGain    // GainNode — wet mix level
  #output     // GainNode — merge point

  constructor(ctx) {
    this.#input   = ctx.createGain()
    this.#output  = ctx.createGain()

    // Bandpass filter centred at 1800 Hz, Q ~0.7 covers 300–3400 Hz
    this.#bandpass = ctx.createBiquadFilter()
    this.#bandpass.type = 'bandpass'
    this.#bandpass.frequency.value = 1800
    this.#bandpass.Q.value = 0.7

    // Soft-clip WaveShaper for gritty character
    this.#shaper = ctx.createWaveShaper()
    this.#shaper.curve = OldRadioEffect.#makeSaturationCurve(256)
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

  /** Mild soft-clipping curve — keeps quiet parts clean, gently clips louder transients. */
  static #makeSaturationCurve(samples) {
    const curve = new Float32Array(samples)
    const k = 8  // drive amount — keep low for a gentle effect
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1  // -1 … +1
      curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x))
    }
    return curve
  }

  get input()  { return this.#input }
  get output() { return this.#output }

  /**
   * Enable or disable the effect with an optional fade.
   * @param {boolean} active
   * @param {number} [duration=0] - Ramp duration in seconds (0 = instant)
   */
  setActive(active, duration = 0) {
    const target = active ? 1 : 0
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
