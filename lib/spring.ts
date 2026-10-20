export function springTo(from: number, to: number, velocity: number, response: number, onFrame: (value: number) => void, onDone?: () => void) {
  const w = (2 * Math.PI) / response
  let x = from
  let v = velocity
  let last = performance.now()
  let raf = 0
  let alive = true
  const tick = (now: number) => {
    if (!alive) return
    let dt = Math.min((now - last) / 1000, 0.032)
    last = now
    while (dt > 0) {
      const h = Math.min(1 / 240, dt)
      v += (-w * w * (x - to) - 2 * w * v) * h
      x += v * h
      dt -= h
    }
    if (Math.abs(x - to) < 0.3 && Math.abs(v) < 5) { onFrame(to); onDone?.(); return }
    onFrame(x)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => { alive = false; cancelAnimationFrame(raf) }
}

export const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate)

export const rubberband = (overshoot: number, size: number, k = 0.55) => (overshoot * size * k) / (size + k * Math.abs(overshoot))
