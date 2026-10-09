import { create } from 'zustand'
import type { Block, Day } from '../engine/schema'
import { SAMPLE, SCENARIOS, type Scenario } from '../scenarios'

export const LIBRARY: Scenario[] = [SAMPLE, ...SCENARIOS]

export const SNAP = 5

interface State {
  scenario: Scenario
  day: Day
  /** Index into day.blocks of the selected block. */
  selected: number | null
  /** The minute the dashboard is looking at. */
  cursor: number
  loadScenario: (id: string) => void
  reset: () => void
  patchDay: (patch: Partial<Day>) => void
  updateBlock: (i: number, patch: Partial<Block>) => void
  addBlock: (b: Block) => void
  removeBlock: (i: number) => void
  /** Swap block i with the adjacent block j, keeping the gap between them. */
  swap: (i: number, j: number) => void
  select: (i: number | null) => void
  setCursor: (t: number) => void
}

const fresh = (s: Scenario) => structuredClone(s.day)

export const useStore = create<State>((set, get) => ({
  scenario: SAMPLE,
  day: fresh(SAMPLE),
  selected: null,
  cursor: 125,
  loadScenario: (id) => {
    const s = LIBRARY.find((x) => x.id === id) ?? SAMPLE
    set({ scenario: s, day: fresh(s), selected: null, cursor: Math.min(get().cursor, s.day.minutes - 1) })
  },
  reset: () => set({ day: fresh(get().scenario), selected: null }),
  patchDay: (patch) => set({ day: { ...get().day, ...patch } }),
  updateBlock: (i, patch) => set({ day: { ...get().day, blocks: get().day.blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)) } }),
  addBlock: (b) => {
    const blocks = [...get().day.blocks, b]
    set({ day: { ...get().day, blocks }, selected: blocks.length - 1 })
  },
  removeBlock: (i) => set({ day: { ...get().day, blocks: get().day.blocks.filter((_, k) => k !== i) }, selected: null }),
  swap: (i, j) => {
    const blocks = [...get().day.blocks]
    const a = blocks[i]
    const b = blocks[j]
    if (!a || !b) return
    const [first, second] = a.from < b.from ? [a, b] : [b, a]
    const gap = second.from - first.to
    const start = first.from
    const secondLen = second.to - second.from
    const firstLen = first.to - first.from
    const movedSecond = { ...second, from: start, to: start + secondLen }
    const movedFirst = { ...first, from: start + secondLen + gap, to: start + secondLen + gap + firstLen }
    blocks[i] = a === first ? movedFirst : movedSecond
    blocks[j] = b === first ? movedFirst : movedSecond
    set({ day: { ...get().day, blocks } })
  },
  select: (i) => set({ selected: i }),
  setCursor: (t) => set({ cursor: Math.max(0, Math.min(get().day.minutes - 1, Math.round(t))) }),
}))

/** The free stretch of the day around block i (no two blocks can overlap: you can't do two things at once). */
export function freeRange(day: Day, i: number): [number, number] {
  const b = day.blocks[i]
  if (!b) return [0, day.minutes]
  let lo = 0
  let hi = day.minutes
  day.blocks.forEach((o, k) => {
    if (k === i) return
    if (o.to <= b.from) lo = Math.max(lo, o.to)
    if (o.from >= b.to) hi = Math.min(hi, o.from)
  })
  return [lo, hi]
}

/** The free gap containing minute t, or null if t is inside a block. */
export function gapAt(day: Day, t: number): [number, number] | null {
  if (day.blocks.some((b) => t >= b.from && t < b.to)) return null
  let lo = 0
  let hi = day.minutes
  for (const b of day.blocks) {
    if (b.to <= t) lo = Math.max(lo, b.to)
    if (b.from > t) hi = Math.min(hi, b.from)
  }
  return [lo, hi]
}
