import { DRIVERS, defaultParams, weights, type Driver, type Params } from './params'
import { Rng } from './rng'
import type { Block, Day } from './schema'

/**
 * The load model from section 03 of the documentation. One tick = one minute.
 * Pure and deterministic: same day + same params → identical trace. No DOM,
 * no Date, no Math.random — this file also runs inside the Web Worker.
 */

export type SimEvent =
  | { t: number; type: 'switch'; from: string; to: string; spike: number; residue: number }
  | { t: number; type: 'resume'; task: string; spike: number }
  | { t: number; type: 'alert'; count: number; amp: number; acted: boolean; batched: boolean }

export interface Activity {
  task: string
  c: number
  kind: 'work' | 'meeting' | 'inbox'
}

export interface Trace {
  minutes: number
  load: Float64Array
  /** Weighted contribution of each driver; they sum to `load`. */
  parts: Record<Driver, Float64Array>
  /** Unweighted driver values (0 … driverCap). */
  raw: Record<Driver, Float64Array>
  /** What the person is doing each minute; null = break or nothing scheduled. */
  activity: (Activity | null)[]
  /** Minutes of work still needed per deadline, sampled each minute. */
  workLeft: Float64Array[]
  events: SimEvent[]
  /** Minutes at which alerts arrived (before batching or quiet windows). */
  arrivals: number[]
}

export const INBOX = 'inbox'

/** Alert arrival minutes for a day, from its seed (Poisson per minute). */
export function alertArrivals(day: Day): number[] {
  const rng = new Rng(day.seed).fork('alerts')
  const lambda = day.alertsPerHour / 60
  const out: number[] = []
  const limit = Math.exp(-lambda)
  for (let t = 0; t < day.minutes; t++) {
    // Knuth's method: count uniforms until their product drops below e^-λ
    let p = rng.next()
    while (p > limit) {
      out.push(t)
      p *= rng.next()
    }
  }
  return out
}

interface Delivery {
  count: number
  batched: boolean
  arrivals: number[]
}

function deliveries(day: Day, arrivals: number[]): Map<number, Delivery> {
  const out = new Map<number, Delivery>()
  const last = day.minutes - 1
  const batches = day.batchAt ? [...day.batchAt].sort((a, b) => a - b) : null
  for (const t of arrivals) {
    let at = t
    let batched = false
    const quiet = day.quiet.find(([a, b]) => t >= a && t < b)
    if (quiet) {
      at = Math.min(quiet[1], last)
      batched = true
    } else if (batches) {
      at = Math.min(batches.find((b) => b >= t) ?? last, last)
      batched = true
    }
    const d = out.get(at) ?? { count: 0, batched, arrivals: [] }
    d.count++
    d.batched ||= batched
    d.arrivals.push(t)
    out.set(at, d)
  }
  return out
}

function blockIndex(day: Day): Int32Array {
  const idx = new Int32Array(day.minutes).fill(-1)
  day.blocks.forEach((b, i) => {
    for (let t = Math.max(0, b.from); t < Math.min(b.to, day.minutes); t++) idx[t] = i
  })
  return idx
}

/** A task is finished when the block being left is its last block of the day. */
function isLastBlock(day: Day, block: Block): boolean {
  return !day.blocks.some((b) => b.task === block.task && b.kind !== 'break' && b.from >= block.to)
}

export function simulate(day: Day, p: Params = defaultParams(), arrivals: number[] = alertArrivals(day)): Trace {
  const n = day.minutes
  const w = weights(p)
  const cap = p.driverCap
  const raw = Object.fromEntries(DRIVERS.map((d) => [d, new Float64Array(n)])) as Record<Driver, Float64Array>
  const parts = Object.fromEntries(DRIVERS.map((d) => [d, new Float64Array(n)])) as Record<Driver, Float64Array>
  const load = new Float64Array(n)
  const activity: (Activity | null)[] = new Array<Activity | null>(n).fill(null)
  const workLeft = day.deadlines.map(() => new Float64Array(n))
  const events: SimEvent[] = []

  const idx = blockIndex(day)
  const delivered = deliveries(day, arrivals)
  const decaySwitch = Math.exp(-1 / p.tauSwitch)
  const decayResidue = Math.exp(-1 / p.tauResidue)
  const decayAlert = Math.exp(-1 / p.tauAlert)
  const recover = Math.exp(-1 / p.tauRecover)

  const planned = day.openTasks.filter((o) => o.planned).length
  const loops = day.openTasks.length === 0 ? 0 : (1 - Math.exp(-day.openTasks.length / p.kappaLoops)) * (1 - (p.planRelief * planned) / day.openTasks.length)
  const done = day.deadlines.map(() => 0)

  let spikeAcc = 0
  let residueAcc = 0
  let alertAcc = 0
  let fatigue = 0
  let awayUntil = -1
  let prev: Activity | null = null
  let prevBlock: Block | null = null
  let lastWork: Activity | null = null

  for (let t = 0; t < n; t++) {
    const bi = idx[t] ?? -1
    const block = bi >= 0 ? (day.blocks[bi] ?? null) : null
    const busy = block !== null && block.kind !== 'break'

    // 1 · alerts delivered this minute
    const d = delivered.get(t)
    if (d && busy) {
      let acted: boolean
      let amp: number
      if (d.batched) {
        amp = Math.min(1.6, 0.6 + p.batchSpike * d.count)
        acted = true // a batch is a deliberate look at everything that arrived
      } else {
        amp = p.alertSpike * d.count
        acted = d.arrivals.some((a, i) => new Rng(day.seed).fork(`act:${a}:${i}`).chance(day.actOnAlerts))
      }
      alertAcc += amp
      if (acted && t >= awayUntil) awayUntil = t + p.inboxMin
      events.push({ t, type: 'alert', count: d.count, amp, acted, batched: d.batched })
    }

    // 2 · what the person is doing now
    const now: Activity | null = !busy ? null : t < awayUntil ? { task: INBOX, c: p.inboxComplexity, kind: 'inbox' } : { task: block.task, c: block.c, kind: block.kind === 'meeting' ? 'meeting' : 'work' }
    activity[t] = now

    // 3 · switches: a change of task between consecutive busy minutes, or re-entry after a break
    if (now && prev && now.task !== prev.task) {
      // a detour to an alert leaves the task unfinished: you are coming back to it
      const finished = prev.kind === 'inbox' || (now.kind !== 'inbox' && prevBlock !== null && prevBlock.task === prev.task && isLastBlock(day, prevBlock))
      const residue = p.residue * (prev.c / 5) * (finished ? p.residueFinished : 1)
      spikeAcc += p.switchSpike
      residueAcc += residue
      events.push({ t, type: 'switch', from: prev.task, to: now.task, spike: p.switchSpike, residue })
    } else if (now && !prev && lastWork) {
      const spike = lastWork.task === now.task ? p.switchSpike * p.resumeSpike : p.switchSpike
      spikeAcc += spike
      if (lastWork.task === now.task) events.push({ t, type: 'resume', task: now.task, spike })
      else events.push({ t, type: 'switch', from: lastWork.task, to: now.task, spike, residue: 0 })
    }

    // 4 · drivers
    const deadline = day.deadlines.reduce((m, dl, k) => {
      const left = dl.workLeft - (done[k] ?? 0)
      const wl = workLeft[k]
      if (wl) wl[t] = Math.max(0, left)
      if (left <= 0) return m
      const timeLeft = dl.at - t
      if (timeLeft <= 0) return cap
      if (timeLeft >= p.deadlineHorizon) return m
      return Math.max(m, (left / timeLeft) * (1 - timeLeft / p.deadlineHorizon) * p.deadlineGain)
    }, 0)
    const x: Record<Driver, number> = {
      complexity: now ? now.c / 5 : 0,
      switching: spikeAcc + residueAcc,
      alerts: alertAcc,
      openLoops: busy ? loops : loops * p.idleLoops,
      deadline,
      fatigue,
    }
    let total = 0
    for (const k of DRIVERS) {
      const v = Math.min(cap, x[k])
      raw[k][t] = v
      parts[k][t] = w[k] * v
      total += w[k] * v
    }
    load[t] = total

    // 5 · advance state to the next minute
    fatigue = busy ? Math.min(1, fatigue + p.fatigueRate * (p.fatigueBase + total) * (1 - fatigue)) : fatigue * recover
    if (now && now.kind !== 'inbox') day.deadlines.forEach((dl, k) => { if (dl.task === now.task) done[k] = (done[k] ?? 0) + 1 })
    spikeAcc *= decaySwitch
    residueAcc *= decayResidue
    alertAcc *= decayAlert
    if (now) lastWork = now.kind === 'inbox' ? lastWork : now
    prev = now
    prevBlock = block
  }

  return { minutes: n, load, parts, raw, activity, workLeft, events, arrivals }
}
