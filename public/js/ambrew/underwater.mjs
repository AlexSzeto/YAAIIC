/**
 * UnderwaterEffect — lowpass + peaking filter to simulate a muffled, resonant underwater sound.
 *
 * Signal chain (wet): input → lowpass (~400 Hz) → peaking (~600 Hz, Q 3, +6 dB) → wetGain → output
 * Dry path:           input → output
 *
 * Dry by default (wetGain = 0). Call setActive(true) to blend in the effect.
 */
export class UnderwaterEffect {
  #input      // GainNode — entry point, splits into dry and wet
  #lowpass    // BiquadFilterNode — heavy low-cut for underwater muffle
  #peaking    // BiquadFilterNode — resonant bump around 600 Hz
  #wetGain    // GainNode — wet mix level
  #output     // GainNode — merge point

  constructor(ctx) {
    this.#input  = ctx.createGain()
    this.#output = ctx.createGain()

    // Strong lowpass to cut everything above ~400 Hz
    this.#lowpass = ctx.createBiquadFilter()
    this.#lowpass.type = 'lowpass'
    this.#lowpass.frequency.value = 400

    // Peaking filter for the characteristic underwater resonance
    this.#peaking = ctx.createBiquadFilter()
    this.#peaking.type = 'peaking'
    this.#peaking.frequency.value = 600
    this.#peaking.Q.value = 3
    this.#peaking.gain.value = 6  // +6 dB boost

    this.#wetGain = ctx.createGain()
    this.#wetGain.gain.value = 0  // dry by default

    // Dry path
    this.#input.connect(this.#output)
    // Wet path
    this.#input.connect(this.#lowpass)
    this.#lowpass.connect(this.#peaking)
    this.#peaking.connect(this.#wetGain)
    this.#wetGain.connect(this.#output)
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
