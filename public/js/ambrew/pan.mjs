/**
 * PanEffect — wraps a StereoPannerNode.
 *
 * Handles 'fixed' mode directly (static pan position) and center/off (pan = 0).
 * 'random', 'left-to-right', and 'right-to-left' modes are managed per-event
 * by EventTrack (see ambient-coffee.mjs) — this class only resets to center for
 * those modes so the shared panner starts at a known position.
 */
export class PanEffect {
  /** @type {StereoPannerNode} */
  #panner

  constructor(ctx) {
    this.#panner = ctx.createStereoPanner()
    this.#panner.pan.value = 0  // center / off
  }

  get input()  { return this.#panner }
  get output() { return this.#panner }

  /**
   * Set the pan position based on panConfig.
   * @param {{ mode: string, value?: number, min?: number, max?: number }|null} panConfig
   * @param {number} [duration=0] - Ramp duration in seconds (0 = immediate)
   */
  setActive(panConfig, duration = 0) {
    const ctx = this.#panner.context
    // Only 'fixed' mode sets a static position here; all other modes center the
    // shared panner and rely on EventTrack to schedule per-event pan changes.
    const target = panConfig?.mode === 'fixed' ? (panConfig.value ?? 0) : 0
    if (duration > 0) {
      this.#panner.pan.linearRampToValueAtTime(target, ctx.currentTime + duration)
    } else {
      this.#panner.pan.setValueAtTime(target, ctx.currentTime)
    }
  }

  connect(dest) { this.#panner.connect(dest) }
  disconnect()  { this.#panner.disconnect() }
  dispose()     { this.disconnect() }
}
