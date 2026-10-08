import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DRIVERS, defaultParams } from '../params'
import { DaySchema, type Block, type Day } from '../schema'
import { alertArrivals, simulate } from '../simulate'

// Random valid days: a sequence of blocks with gaps, random alerts, loops and deadlines.
const blockArb = fc.record({
  len: fc.integer({ min: 5, max: 90 }),
  gap: fc.integer({ min: 0, max: 20 }),
  kind: fc.constantFrom<Block['kind']>('work', 'work', 'work', 'meeting', 'break'),
  task: fc.constantFrom('A', 'B', 'C', 'D'),
  c: fc.integer({ min: 1, max: 5 }),
})

const dayArb = fc
  .record({
    parts: fc.array(blockArb, { minLength: 1, maxLength: 14 }),
    alertsPerHour: fc.double({ min: 0, max: 40, noNaN: true }),
    actOnAlerts: fc.double({ min: 0, max: 1, noNaN: true }),
    batch: fc.boolean(),
    loops: fc.array(fc.record({ name: fc.constantFrom('A', 'B', 'C', 'D', 'E'), planned: fc.boolean() }), { maxLength: 8 }),
    deadlines: fc.array(fc.record({ task: fc.constantFrom('A', 'B', 'C'), at: fc.integer({ min: 0, max: 900 }), workLeft: fc.integer({ min: 0, max: 300 }) }), { maxLength: 3 }),
    seed: fc.integer(),
  })
  .map(({ parts, ...r }): Day => {
    let t = 0
    const blocks: Block[] = []
    for (const part of parts) {
      t += part.gap
      blocks.push({ from: t, to: t + part.len, task: part.kind === 'break' ? 'break' : part.task, kind: part.kind, c: part.c })
      t += part.len
    }
    return DaySchema.parse({
      id: 'r', title: 'random', startClock: 480, minutes: t, blocks, alertsPerHour: r.alertsPerHour, actOnAlerts: r.actOnAlerts,
      batchAt: r.batch ? [Math.floor(t / 3), Math.floor((2 * t) / 3)] : null, quiet: [], openTasks: r.loops, deadlines: r.deadlines, seed: r.seed,
    })
  })

const p = defaultParams()

describe('engine properties (docs §10)', () => {
  it('is deterministic: same day + seed gives an identical trace', () => {
    fc.assert(fc.property(dayArb, (day) => {
      const a = simulate(day)
      const b = simulate(structuredClone(day))
      expect(Array.from(a.load)).toEqual(Array.from(b.load))
      expect(a.events).toEqual(b.events)
    }), { numRuns: 200 })
  })

  it('shares add up: the six parts sum to the load at every minute', () => {
    fc.assert(fc.property(dayArb, (day) => {
      const tr = simulate(day)
      tr.load.forEach((L, t) => {
        const sum = DRIVERS.reduce((s, d) => s + (tr.parts[d][t] ?? 0), 0)
        expect(Math.abs(sum - L)).toBeLessThan(1e-9)
      })
    }), { numRuns: 200 })
  })

  it('is bounded: every driver stays in [0, cap]', () => {
    fc.assert(fc.property(dayArb, (day) => {
      const tr = simulate(day)
      for (const d of DRIVERS) for (const v of tr.raw[d]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(p.driverCap)
      }
      for (const L of tr.load) expect(Number.isFinite(L)).toBe(true)
    }), { numRuns: 200 })
  })

  it('more alerts never help: an extra ignored alert never lowers load at any minute', () => {
    fc.assert(fc.property(dayArb, fc.nat(), (d, k) => {
      const day = { ...d, actOnAlerts: 0, batchAt: null }
      const arrivals = alertArrivals(day)
      const extra = [...arrivals, k % day.minutes].sort((a, b) => a - b)
      const a = simulate(day, p, arrivals)
      const b = simulate(day, p, extra)
      a.load.forEach((L, t) => expect(b.load[t]!).toBeGreaterThanOrEqual(L - 1e-12))
    }), { numRuns: 300 })
  })

  it('plans never hurt: marking a task planned never raises load', () => {
    fc.assert(fc.property(dayArb, fc.nat(), (day, k) => {
      fc.pre(day.openTasks.some((o) => !o.planned))
      const unplanned = day.openTasks.flatMap((o, j) => (o.planned ? [] : [j]))
      const idx = unplanned[k % unplanned.length]
      const planned = { ...day, openTasks: day.openTasks.map((o, j) => (j === idx ? { ...o, planned: true } : o)) }
      const a = simulate(day)
      const b = simulate(planned)
      a.load.forEach((L, t) => expect(b.load[t]!).toBeLessThanOrEqual(L + 1e-12))
    }), { numRuns: 300 })
  })

  it('breaks never add fatigue: turning a work stretch into a break never raises fatigue at its end', () => {
    fc.assert(fc.property(dayArb, fc.nat(), (day, k) => {
      const works = day.blocks.filter((b) => b.kind === 'work')
      fc.pre(works.length > 0)
      const target = works[k % works.length]!
      const rested = { ...day, blocks: day.blocks.map((b) => (b === target ? { ...b, kind: 'break' as const, task: 'break' } : b)) }
      const end = target.to - 1
      expect(simulate(rested).raw.fatigue[end]!).toBeLessThanOrEqual(simulate(day).raw.fatigue[end]! + 1e-12)
    }), { numRuns: 300 })
  })

  it('runs a 16-hour day fast enough to re-simulate while dragging', () => {
    const day = DaySchema.parse({
      id: 'long', title: 'long', startClock: 360, minutes: 960, alertsPerHour: 30, actOnAlerts: 0.5, batchAt: null, quiet: [], openTasks: [], deadlines: [], seed: 1,
      blocks: Array.from({ length: 32 }, (_, i) => ({ from: i * 30, to: i * 30 + 28, task: `T${i % 5}`, kind: 'work', c: 1 + (i % 5) })),
    })
    simulate(day)
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) simulate(day)
    expect((performance.now() - t0) / 20).toBeLessThan(20)
  })
})
