/**
 * Critically damped spring (damping ratio 1). It starts from the current value and velocity,
 * so a new call can interrupt a running one without a jump. Returns a function that stops it.
 */
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

/** Where a release at `velocity` (px/s) would come to rest, using exponential deceleration. */
export const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate)

/** Resistance that grows the further a drag goes past its limit. */
export const rubberband = (overshoot: number, size: number, k = 0.55) => (overshoot * size * k) / (size + k * Math.abs(overshoot))
