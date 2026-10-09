import { area, curveMonotoneX } from 'd3-shape'
import { useMemo, type KeyboardEvent, type PointerEvent } from 'react'
import { DRIVERS, DRIVER_INFO, ZONE_INFO, defaultParams, type Driver } from '../engine/params'
import { clock, type Day } from '../engine/schema'
import type { Trace } from '../engine/simulate'
import { GUTTER } from './layout'
import { useStore } from './store'

const H = 200
const Y_MAX = 1.3
const P = defaultParams()
const ZONES: [number, string, string][] = [
  [P.zoneFocus, 'focus', ZONE_INFO.focus.color],
  [P.zoneStrained, 'strained', ZONE_INFO.strained.color],
  [P.zoneOverloaded, 'overloaded', ZONE_INFO.overloaded.color],
]

/** 3-minute centred mean, for display only: single alerts would otherwise turn the chart into noise. */
function smoothed(trace: Trace) {
  const n = trace.minutes
  return Array.from({ length: n }, (_, t) => {
    const out = {} as Record<Driver, number>
    for (const d of DRIVERS) {
      const a = trace.parts[d]
      let s = 0
      let c = 0
      for (let k = Math.max(0, t - 1); k <= Math.min(n - 1, t + 1); k++) [s, c] = [s + (a[k] ?? 0), c + 1]
      out[d] = s / c
    }
    return out
  })
}

export function LoadChart({ trace, day, width }: { trace: Trace; day: Day; width: number }) {
  const cursor = useStore((s) => s.cursor)
  const setCursor = useStore((s) => s.setCursor)
  const track = Math.max(200, width - GUTTER)
  const x = (t: number) => (t / Math.max(1, trace.minutes)) * track
  const y = (v: number) => H - (Math.min(v, Y_MAX) / Y_MAX) * H

  const layers = useMemo(() => {
    const rows = smoothed(trace)
    const stack: [number, number][][] = []
    const base = rows.map(() => 0)
    for (const d of DRIVERS) {
      stack.push(rows.map((r, t) => [base[t]!, (base[t] = base[t]! + r[d])]))
    }
    return DRIVERS.map((d, k) => {
      const path = area<[number, number]>()
        .x((_, t) => (t / Math.max(1, trace.minutes)) * track)
        .y0((p) => H - (Math.min(p[0], Y_MAX) / Y_MAX) * H)
        .y1((p) => H - (Math.min(p[1], Y_MAX) / Y_MAX) * H)
        .curve(curveMonotoneX)(stack[k]!)
      return { d, path: path ?? '' }
    })
  }, [trace, track])

  const switches = trace.events.filter((e) => e.type === 'switch' || e.type === 'resume')
  const alerts = trace.events.filter((e) => e.type === 'alert')

  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setCursor(((e.clientX - r.left - GUTTER) / track) * trace.minutes)
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 15 : 1
    if (e.key === 'ArrowLeft') setCursor(cursor - step)
    else if (e.key === 'ArrowRight') setCursor(cursor + step)
    else if (e.key === 'Home') setCursor(0)
    else if (e.key === 'End') setCursor(trace.minutes - 1)
    else return
    e.preventDefault()
  }

  const load = trace.load[cursor] ?? 0
  return (
    <svg
      className="chart"
      width={GUTTER + track}
      height={H + 46}
      role="slider"
      tabIndex={0}
      aria-label="Load over the day. Arrow keys move the cursor one minute, shift+arrows fifteen."
      aria-valuemin={0}
      aria-valuemax={trace.minutes - 1}
      aria-valuenow={cursor}
      aria-valuetext={`${clock(day, cursor)}, load ${load.toFixed(2)}`}
      onPointerMove={(e) => e.buttons === 1 && fromPointer(e)}
      onPointerDown={fromPointer}
      onKeyDown={onKey}
    >
      <g className="axis-labels">
        <text x={0} y={y(1) + 4}>load 1.0</text>
        {ZONES.map(([v, name, col]) => (
          <text key={name} x={0} y={y(v) + 4} fill={col}>
            {name} {v}
          </text>
        ))}
      </g>
      <g transform={`translate(${GUTTER},0)`}>
        <rect width={track} height={H} rx={14} className="plot-bg" />
        <rect y={y(P.zoneStrained)} width={track} height={y(P.zoneFocus) - y(P.zoneStrained)} fill={ZONE_INFO.focus.color} opacity={0.08} />
        <rect y={0} width={track} height={y(P.zoneOverloaded)} fill={ZONE_INFO.overloaded.color} opacity={0.07} rx={14} />
        {layers.map((l) => (
          <path key={l.d} d={l.path} fill={DRIVER_INFO[l.d].color} opacity={0.94} />
        ))}
        {ZONES.map(([v, name, col]) => (
          <line key={name} x1={0} x2={track} y1={y(v)} y2={y(v)} stroke={col} strokeDasharray="5 5" strokeWidth={1.3} />
        ))}
        {/* event rail: switches as red ticks, alerts as yellow dots (filled when acted on) */}
        <g transform={`translate(0,${H + 10})`}>
          <line x2={track} stroke="rgba(28,34,64,.15)" />
          {switches.map((e, k) => (
            <line key={k} x1={x(e.t)} x2={x(e.t)} y1={-5} y2={5} stroke="#d81e2c" strokeWidth={1.5} />
          ))}
          {alerts.map((e, k) =>
            e.type === 'alert' ? <circle key={k} cx={x(e.t)} cy={14} r={e.batched ? 4.5 : 3} fill={e.acted ? '#f2b632' : '#fdf6ea'} stroke="#1b1b1b" strokeWidth={1.2} /> : null,
          )}
        </g>
        <g className="cursor" transform={`translate(${x(cursor)},0)`}>
          <line y1={-4} y2={H + 30} />
          <circle cy={y(load)} r={6} />
        </g>
      </g>
      <g className="axis-labels">
        <text x={0} y={H + 14}>switches</text>
        <text x={0} y={H + 28}>alerts</text>
      </g>
    </svg>
  )
}
