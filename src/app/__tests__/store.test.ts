import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Day } from '../../engine/schema'
import { freeRange, gapAt, useStore } from '../store'

const noOverlap = (d: Day) => {
  const s = [...d.blocks].sort((a, b) => a.from - b.from)
  return s.every((b, i) => i === 0 || s[i - 1]!.to <= b.from)
}

describe('day editing', () => {
  beforeEach(() => useStore.getState().loadScenario('sample'))

  it('swapping neighbours keeps durations and the gap, and never overlaps', () => {
    const { day } = useStore.getState()
    fc.assert(
      fc.property(fc.integer({ min: 0, max: day.blocks.length - 1 }), (i) => {
        useStore.getState().reset()
        const before = useStore.getState().day
        const b = before.blocks[i]!
        const [, hi] = freeRange(before, i)
        const j = before.blocks.findIndex((o) => o.from === hi)
        fc.pre(j >= 0)
        const n = before.blocks[j]!
        useStore.getState().swap(i, j)
        const after = useStore.getState().day
        const b2 = after.blocks[i]!
        const n2 = after.blocks[j]!
        expect(b2.to - b2.from).toBe(b.to - b.from)
        expect(n2.to - n2.from).toBe(n.to - n.from)
        expect(n2.from).toBe(b.from)
        expect(b2.from - n2.to).toBe(n.from - b.to)
        expect(noOverlap(after)).toBe(true)
      }),
    )
  })

  it('free range and gaps respect every other block', () => {
    const { day } = useStore.getState()
    day.blocks.forEach((b, i) => {
      const [lo, hi] = freeRange(day, i)
      expect(lo).toBeLessThanOrEqual(b.from)
      expect(hi).toBeGreaterThanOrEqual(b.to)
    })
    expect(gapAt(day, 10)).toBeNull()
    const trimmed = { ...day, blocks: day.blocks.filter((b) => b.task !== 'Admin') }
    expect(gapAt(trimmed, 150)).toEqual([140, 180])
  })

  it('loading a scenario gives a fresh copy, so edits never leak into the library', () => {
    useStore.getState().updateBlock(0, { c: 1 })
    useStore.getState().loadScenario('s1')
    useStore.getState().loadScenario('sample')
    expect(useStore.getState().day.blocks[0]!.c).toBe(4)
  })
})
