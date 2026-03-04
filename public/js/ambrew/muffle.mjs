const MUFFLE_PROFILES = {
  'glass-window': 4000,
  'outside-car':  2000,
  'thick-wall':    800,
}

export class MuffleEffect {
  #filter

  constructor(ctx) {
    this.#filter = ctx.createBiquadFilter()
    this.#filter.type = 'lowpass'
    this.#filter.frequency.value = 20000   // transparent / off
  }

  get input()  { return this.#filter }
  get output() { return this.#filter }

  /** @param {string|null} profile - profile key or null/falsy for off. Defaults to 'thick-wall' when truthy but unrecognized. */
  setActive(profile, duration = 0) {
    const target = profile ? (MUFFLE_PROFILES[profile] ?? MUFFLE_PROFILES['thick-wall']) : 20000
    const ctx = this.#filter.context
    if (duration > 0) {
      this.#filter.frequency.linearRampToValueAtTime(target, ctx.currentTime + duration)
    } else {
      this.#filter.frequency.setValueAtTime(target, ctx.currentTime)
    }
  }

  connect(dest) { this.#filter.connect(dest) }
  disconnect()  { this.#filter.disconnect() }
  dispose()     { this.disconnect() }
}
