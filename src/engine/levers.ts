import type { Block, Day } from './schema'

/**
 * What-if levers. Each is a pure function from one day to another: it never
 * edits the user's day, so levers can be stacked, reordered and credited one
 * at a time. Total work per task is preserved unless the lever says otherwise.
 */
export type Lever = (day: Day) => Day

export interface LeverSpec {
  id: string
  name: string
  blurb: string
  source?: string
  apply: Lever
}

type Slot = Omit<Block, 'from' | 'to'> | null

function toSlots(day: Day): Slot[] {
  const slots: Slot[] = new Array<Slot>(day.minutes).fill(null)
  for (const { from, to, ...rest } of day.blocks) for (let t = from; t < Math.min(to, day.minutes); t++) slots[t] = rest
  return slots
}

function fromSlots(slots: Slot[]): Block[] {
  const blocks: Block[] = []
  slots.forEach((s, t) => {
    const last = blocks[blocks.length - 1]
    if (!s) return
    if (last && last.to === t && last.task === s.task && last.kind === s.kind && last.c === s.c) last.to = t + 1
    else blocks.push({ ...s, from: t, to: t + 1 })
  })
  return blocks
}

/** Hold alerts and deliver them every `every` minutes (and at the end of the day). */
export const batchAlerts = (every = 120): Lever => (day) => {
  const at: number[] = []
  for (let t = every; t < day.minutes - 1; t += every) at.push(t)
  return { ...day, batchAt: [...at, day.minutes - 1] }
}

/** Write a concrete next step for every open task. */
export const writePlans: Lever = (day) => ({ ...day, openTasks: day.openTasks.map((o) => ({ ...o, planned: true })) })

/** Halve how often alerts arrive (e.g. muting group chats). */
export const halveAlerts: Lever = (day) => ({ ...day, alertsPerHour: day.alertsPerHour / 2 })

/** Hold alerts during a window and deliver them together when it ends (pager handed over). */
export const quietWindow = (from: number, to: number): Lever => (day) => ({ ...day, quiet: [...day.quiet, [from, to]] })

/**
 * Remove a task: its open loop and deadline go. Its blocks become free time,
 * or, with `giveTo`, time spent on that task instead (renegotiating frees hours).
 */
export const dropTask = (task: string, giveTo?: string): Lever => (day) => ({
  ...day,
  blocks: giveTo ? day.blocks.map((b) => (b.task === task ? { ...b, task: giveTo } : b)) : day.blocks.filter((b) => b.task !== task),
  openTasks: day.openTasks.filter((o) => o.name !== task),
  deadlines: day.deadlines.filter((d) => d.task !== task),
})

/**
 * Move every meeting into one run starting at `at` (default: the end of the
 * first break after mid-day). Breaks stay put; work fills the remaining time
 * in its original order, so blocks of the same task end up next to each other.
 */
export const clusterMeetings = (at?: number): Lever => (day) => {
  const slots = toSlots(day)
  const meetings = slots.filter((s) => s?.kind === 'meeting')
  const work = slots.filter((s) => s?.kind === 'work')
  const idle = slots.filter((s) => s === null).length
  const isBreak = slots.map((s) => s?.kind === 'break')
  const mid = Math.floor(day.minutes / 2) - 60
  const breakEnd = day.blocks.filter((b) => b.kind === 'break' && b.to > mid).sort((a, b) => a.to - b.to)[0]?.to
  let t = Math.min(at ?? breakEnd ?? mid, day.minutes - 1)
  const out: Slot[] = slots.map((s) => (s?.kind === 'break' ? s : null))
  for (const m of meetings) {
    while (t < day.minutes && isBreak[t]) t++
    if (t >= day.minutes) break
    out[t++] = m
  }
  // remaining minutes: work first, then whatever idle time the day had
  const fill = [...work, ...new Array<Slot>(idle).fill(null)]
  let k = 0
  for (let s = 0; s < day.minutes; s++) if (!isBreak[s] && out[s] === null) out[s] = fill[k++] ?? null
  return { ...day, blocks: fromSlots(out) }
}

/** After `every` minutes of unbroken work, take a `length`-minute break (that work is lost, not moved). */
export const addBreaks = (every = 50, length = 5): Lever => (day) => {
  const slots = toSlots(day)
  let run = 0
  for (let t = 0; t < slots.length; t++) {
    const s = slots[t]
    if (!s || s.kind === 'break') { run = 0; continue }
    if (++run > every) {
      for (let k = t; k < Math.min(t + length, slots.length) && slots[k]?.kind !== 'break'; k++) slots[k] = { task: 'break', kind: 'break', c: 1 }
      run = 0
      t += length - 1
    }
  }
  return { ...day, blocks: fromSlots(slots) }
}

export const compose = (...levers: Lever[]): Lever => (day) => levers.reduce((d, l) => l(d), day)

/** The general-purpose levers offered for every day in the What-If Lab. */
export const COMMON_LEVERS: LeverSpec[] = [
  { id: 'batch', name: 'Batch alerts', blurb: 'Hold notifications and deliver them every 2 hours.', source: 'Fitz et al. 2019', apply: batchAlerts(120) },
  { id: 'plans', name: 'Write plans', blurb: 'A written next step for every open task.', source: 'Masicampo & Baumeister 2011', apply: writePlans },
  { id: 'cluster', name: 'Cluster meetings', blurb: 'All meetings in one run after lunch; work fills the rest.', apply: clusterMeetings() },
  { id: 'breaks', name: 'Take breaks', blurb: '5 minutes off after every 50 minutes of work.', source: 'Ariga & Lleras 2011', apply: addBreaks(50, 5) },
  { id: 'mute', name: 'Mute half the alerts', blurb: 'Turn off the noisier half of your notifications.', source: 'Stothart et al. 2015', apply: halveAlerts },
]
