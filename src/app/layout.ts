import type { Block } from '../engine/schema'

/** Shared horizontal layout: a label gutter, then the day scaled to the remaining width. */
export const GUTTER = 112

/** Work blocks get deeper teal with complexity 1–5. */
export const SHADES = ['#8db3ad', '#6ea39e', '#4f8c88', '#3a7a78', '#2f6b6b']

export function blockColor(b: Block): string {
  if (b.kind === 'meeting') return '#1b1b1b'
  if (b.kind === 'break') return 'transparent'
  return SHADES[b.c - 1] ?? SHADES[2]!
}
