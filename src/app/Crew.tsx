import { useEffect, useRef } from 'react'
import { CREW, drawCharacter } from '../characters/characters'
import { DRIVERS, DRIVER_INFO, ZONE_INFO, defaultParams, zoneOf } from '../engine/params'
import { clock, type Day } from '../engine/schema'
import type { Trace } from '../engine/simulate'
import { useStore } from './store'

const P = defaultParams()

/**
 * The crew at the cursor minute: each mascot grows with its driver's share of
 * load and gets more frazzled as that share rises. Replaces a bar chart with
 * something you can read at a glance; the exact numbers sit underneath.
 */
export function CrewPanel({ trace, day }: { trace: Trace; day: Day }) {
  const cursor = useStore((s) => s.cursor)
  const canvas = useRef<HTMLCanvasElement>(null)
  const values = DRIVERS.map((d) => trace.parts[d][cursor] ?? 0)
  const load = trace.load[cursor] ?? 0
  const zone = zoneOf(load, P)
  const act = trace.activity[cursor]
  const loudest = DRIVERS[values.indexOf(Math.max(...values))]!

  // redraw on every frame so the crew blinks and breathes; sizes ease towards their targets
  const target = useRef(values)
  useEffect(() => {
    target.current = values
  })
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const shown = target.current.slice()
    let raf = 0
    const draw = (now: number) => {
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== w * devicePixelRatio) [c.width, c.height] = [w * devicePixelRatio, h * devicePixelRatio]
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const t = now / 1000
      DRIVERS.forEach((d, i) => {
        shown[i] = shown[i]! + ((target.current[i] ?? 0) - shown[i]!) * (reduced ? 1 : 0.12)
        const v = shown[i]!
        const size = Math.min(h - 8, 46 + Math.sqrt(v / 0.35) * 62)
        const x = (w / DRIVERS.length) * (i + 0.5)
        const blink = !reduced && (t + i * 0.73) % 3.6 < 0.12 ? 1 : 0
        drawCharacter(ctx, d, x, h - 4, size, { mood: Math.min(1, v / 0.3), step: reduced ? 0 : Math.sin(t * 1.6 + i) * 0.08 + 0.25, blink })
      })
      raf = requestAnimationFrame(draw) // keeps following the cursor; with reduced motion there is just no blinking or bobbing
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section className="card crew" aria-label="Load at the selected minute">
      <div className="readout">
        <span className="clock">{clock(day, cursor)}</span>
        <b className="big">{load.toFixed(2)}</b>
        <span className="zone-pill" style={{ background: ZONE_INFO[zone].color }}>
          {ZONE_INFO[zone].name}
        </span>
        <p className="doing">{act ? (act.kind === 'inbox' ? 'Dealing with an alert' : `${act.kind === 'meeting' ? 'In' : 'Working on'} ${act.task}`) : 'On a break'}</p>
      </div>
      <p className="loudest">
        Loudest right now: <b style={{ color: DRIVER_INFO[loudest].color }}>{CREW[loudest].name}</b> <span>({DRIVER_INFO[loudest].name.toLowerCase()})</span>
      </p>
      <canvas ref={canvas} className="crew-canvas" aria-hidden />
      <ul className="drivers">
        {DRIVERS.map((d, i) => (
          <li key={d}>
            <i style={{ background: DRIVER_INFO[d].color }} />
            <span>
              <b>{CREW[d].name}</b> {DRIVER_INFO[d].name.toLowerCase()}
            </span>
            <span className="bar">
              <span style={{ width: `${Math.min(100, ((values[i] ?? 0) / 0.45) * 100)}%`, background: DRIVER_INFO[d].color }} />
            </span>
            <b className="v">{(values[i] ?? 0).toFixed(2)}</b>
          </li>
        ))}
      </ul>
    </section>
  )
}
