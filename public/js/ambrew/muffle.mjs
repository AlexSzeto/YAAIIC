export class MuffleEffect {
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
