import { describe, expect, it } from 'vitest'
import { explain } from '../explain'
import { clusterMeetings } from '../levers'
import { defaultParams } from '../params'
import type { Day } from '../schema'
import { simulate, type Trace } from '../simulate'
import { summarize } from '../summary'
import { SAMPLE, SCENARIOS } from '../../scenarios'

const p = defaultParams()
const run = (d: Day) => {
  const trace = simulate(d)
  return { trace, sum: summarize(trace, p) }
}
const mean = (a: Float64Array, from: number, to: number) => a.slice(from, to).reduce((s, v) => s + v, 0) / (to - from)
const byId = (id: string) => SCENARIOS.find((s) => s.id === id)!

describe('scenario library (docs §06): each lever does what its card says', () => {
  it('sample day: all three levers cut mean load by a fifth and nearly remove overload', () => {
    const a = run(SAMPLE.day).sum
    const b = run(SAMPLE.lever.apply(SAMPLE.day)).sum
    expect(b.mean).toBeLessThan(a.mean * 0.8)
    expect(b.zoneMinutes.overloaded).toBeLessThan(a.zoneMinutes.overloaded / 10)
  })

  it('S1 exam week: batching cuts switching without raising deadline pressure', () => {
    const s = byId('s1')
    const a = run(s.day).trace
    const b = run(s.lever.apply(s.day)).trace
    expect(mean(b.parts.switching, 0, s.day.minutes)).toBeLessThan(mean(a.parts.switching, 0, s.day.minutes))
    expect(mean(b.parts.deadline, 0, s.day.minutes)).toBeLessThanOrEqual(mean(a.parts.deadline, 0, s.day.minutes) + 1e-9)
  })

  it('S2 maker: clustering trades switches for fatigue; breaks win part of it back', () => {
    const s = byId('s2')
    const morning = (tr: Trace) => ({ switching: mean(tr.parts.switching, 0, 190), fatigue: mean(tr.raw.fatigue, 0, 190) })
    const before = morning(run(s.day).trace)
    const clusteredOnly = morning(run(clusterMeetings()(s.day)).trace)
    const after = morning(run(s.lever.apply(s.day)).trace)
    expect(clusteredOnly.switching).toBeLessThan(before.switching)
    expect(clusteredOnly.fatigue).toBeGreaterThan(before.fatigue)
    expect(after.switching).toBeLessThan(before.switching)
    expect(after.fatigue).toBeLessThan(clusteredOnly.fatigue)
  })

  it('S3 pager: load is lower while the pager is handed over', () => {
    const s = byId('s3')
    const a = run(s.day).trace
    const b = run(s.lever.apply(s.day)).trace
    expect(mean(b.load, 60, 179)).toBeLessThan(mean(a.load, 60, 179) * 0.85)
  })

  it('S4 juggler: plans halve open-loop load and leave switching untouched', () => {
    const s = byId('s4')
    const a = run(s.day).trace
    const b = run(s.lever.apply(s.day)).trace
    expect(mean(b.parts.openLoops, 0, s.day.minutes)).toBeCloseTo(mean(a.parts.openLoops, 0, s.day.minutes) / 2, 6)
    expect(Array.from(b.parts.switching)).toEqual(Array.from(a.parts.switching))
  })

  it('S5 marathon: breaks keep fatigue lower at the end, for 20–30 minutes of lost work', () => {
    const s = byId('s5')
    const a = run(s.day)
    const b = run(s.lever.apply(s.day))
    expect(b.trace.raw.fatigue[299]!).toBeLessThan(a.trace.raw.fatigue[299]!)
    const lost = a.sum.busyMinutes - b.sum.busyMinutes
    expect(lost).toBeGreaterThanOrEqual(20)
    expect(lost).toBeLessThanOrEqual(30)
  })

  it('S6 crunch: dropping a client lowers deadline pressure and open loops', () => {
    const s = byId('s6')
    const a = run(s.day).trace
    const b = run(s.lever.apply(s.day)).trace
    expect(mean(b.parts.deadline, 0, s.day.minutes)).toBeLessThan(mean(a.parts.deadline, 0, s.day.minutes))
    expect(mean(b.parts.openLoops, 0, s.day.minutes)).toBeLessThan(mean(a.parts.openLoops, 0, s.day.minutes))
  })
})

describe('explain', () => {
  it('names the switch behind a switching spike, and its causes never exceed the load', () => {
    const tr = simulate(SAMPLE.day)
    const sw = tr.events.find((e) => e.type === 'switch' && e.from === 'Stand-up' && e.to === 'Code')!
    const ex = explain(tr, SAMPLE.day, sw.t + 1, p)
    expect(ex.causes.some((c) => c.driver === 'switching' && c.text.includes('Stand-up') && c.text.includes('Code'))).toBe(true)
    for (let t = 0; t < tr.minutes; t += 7) {
      const e = explain(tr, SAMPLE.day, t, p)
      expect(e.causes.reduce((s, c) => s + c.value, 0)).toBeLessThanOrEqual(e.load + 1e-9)
    }
  })
})
