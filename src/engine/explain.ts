import { DRIVERS, defaultParams, weights, zoneOf, type Driver, type Params, type Zone } from './params'
import { clock, type Day } from './schema'
import { INBOX, type Trace } from './simulate'

/**
 * "Why is load what it is at minute t?" Load is a sum, so the driver shares
 * are exact. Within switching and alerts we go one level deeper and credit
 * each earlier event with what it still contributes now.
 */
export interface Cause {
  driver: Driver
  text: string
  /** Contribution to load at this minute, in load units. */
  value: number
  at?: number
}

export interface Explanation {
  t: number
  load: number
  zone: Zone
  parts: { driver: Driver; value: number; share: number }[]
  causes: Cause[]
}

const name = (task: string) => (task === INBOX ? 'an alert' : task)

export function explain(trace: Trace, day: Day, t: number, p: Params = defaultParams()): Explanation {
  const w = weights(p)
  const load = trace.load[t] ?? 0
  const parts = DRIVERS.map((driver) => {
    const value = trace.parts[driver][t] ?? 0
    return { driver, value, share: load > 0 ? value / load : 0 }
  }).sort((a, b) => b.value - a.value)
  const causes: Cause[] = []

  // switching: each earlier switch, decayed to now; scaled if the driver hit its cap
  const sw = trace.events.flatMap((e) => {
    if (e.t > t || (e.type !== 'switch' && e.type !== 'resume')) return []
    const amp = e.spike * Math.exp(-(t - e.t) / p.tauSwitch) + (e.type === 'switch' ? e.residue * Math.exp(-(t - e.t) / p.tauResidue) : 0)
    const text = e.type === 'resume' ? `Came back to ${e.task} after a break at ${clock(day, e.t)}` : `Switched from ${name(e.from)} to ${name(e.to)} at ${clock(day, e.t)}${e.residue > 0 && t - e.t > p.tauSwitch ? ', still leaving residue' : ''}`
    return [{ driver: 'switching' as const, text, value: amp, at: e.t }]
  })
  const swRaw = sw.reduce((a, c) => a + c.value, 0)
  const swScale = swRaw > 0 ? (trace.raw.switching[t] ?? 0) / swRaw : 0
  causes.push(...sw.map((c) => ({ ...c, value: c.value * swScale * w.switching })))

  const al = trace.events.flatMap((e) => {
    if (e.t > t || e.type !== 'alert') return []
    const text = e.batched ? `A batch of ${e.count} alert${e.count > 1 ? 's' : ''} at ${clock(day, e.t)}` : `${e.count > 1 ? `${e.count} alerts` : 'An alert'} at ${clock(day, e.t)}${e.acted ? ', and you stopped to deal with it' : ''}`
    return [{ driver: 'alerts' as const, text, value: e.amp * Math.exp(-(t - e.t) / p.tauAlert), at: e.t }]
  })
  const alRaw = al.reduce((a, c) => a + c.value, 0)
  const alScale = alRaw > 0 ? (trace.raw.alerts[t] ?? 0) / alRaw : 0
  causes.push(...al.map((c) => ({ ...c, value: c.value * alScale * w.alerts })))

  const act = trace.activity[t]
  if (act) {
    const text = act.kind === 'inbox' ? 'Dealing with an alert' : act.kind === 'meeting' ? `In ${act.task} (complexity ${act.c})` : `Working on ${act.task} (complexity ${act.c})`
    causes.push({ driver: 'complexity', text, value: trace.parts.complexity[t] ?? 0 })
  }

  if (day.openTasks.length) {
    const planned = day.openTasks.filter((o) => o.planned).length
    causes.push({ driver: 'openLoops', text: `${day.openTasks.length} open tasks, ${planned === 0 ? 'none' : planned} with a written next step`, value: trace.parts.openLoops[t] ?? 0 })
  }

  const dl = day.deadlines
    .map((d, k) => ({ d, left: trace.workLeft[k]?.[t] ?? 0 }))
    .filter(({ d, left }) => left > 0 && d.at - t < p.deadlineHorizon)
    .sort((a, b) => b.left / Math.max(1, b.d.at - t) - a.left / Math.max(1, a.d.at - t))[0]
  if (dl && (trace.parts.deadline[t] ?? 0) > 0) {
    const to = dl.d.at - t
    const text = to <= 0 ? `${dl.d.task} is overdue with ${Math.round(dl.left)} min of work left` : `${dl.d.task} due ${clock(day, dl.d.at)}: ${Math.round(dl.left)} min of work left, ${to} min to go`
    causes.push({ driver: 'deadline', text, value: trace.parts.deadline[t] ?? 0 })
  }

  if ((trace.parts.fatigue[t] ?? 0) > 0) {
    let worked = 0
    let rest = 0
    for (let s = t - 1; s >= 0 && rest < 10; s--) {
      if (trace.activity[s]) [worked, rest] = [worked + 1, 0]
      else rest++
    }
    causes.push({ driver: 'fatigue', text: `${Math.round((trace.raw.fatigue[t] ?? 0) * 100)}% fatigued after ${worked} min without a 10-minute break`, value: trace.parts.fatigue[t] ?? 0 })
  }

  return { t, load, zone: zoneOf(load, p), parts, causes: causes.filter((c) => c.value > 0.004).sort((a, b) => b.value - a.value) }
}
