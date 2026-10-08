import { DRIVERS, ZONES, zoneOf, defaultParams, type Driver, type Params, type Zone } from './params'
import type { Trace } from './simulate'

export interface Summary {
  mean: number
  peak: number
  peakAt: number
  zoneMinutes: Record<Zone, number>
  /** Each driver's share of all load over the day (sums to 1). */
  share: Record<Driver, number>
  switches: number
  alertsDelivered: number
  alertsActed: number
  busyMinutes: number
}

export function summarize(trace: Trace, p: Params = defaultParams()): Summary {
  const zoneMinutes = Object.fromEntries(ZONES.map((z) => [z, 0])) as Record<Zone, number>
  let sum = 0
  let peak = -Infinity
  let peakAt = 0
  trace.load.forEach((L, t) => {
    sum += L
    if (L > peak) [peak, peakAt] = [L, t]
    zoneMinutes[zoneOf(L, p)]++
  })
  const totals = Object.fromEntries(DRIVERS.map((d) => [d, trace.parts[d].reduce((a, v) => a + v, 0)])) as Record<Driver, number>
  const share = Object.fromEntries(DRIVERS.map((d) => [d, sum > 0 ? totals[d] / sum : 0])) as Record<Driver, number>
  const alerts = trace.events.filter((e) => e.type === 'alert')
  return {
    mean: trace.minutes ? sum / trace.minutes : 0,
    peak: Math.max(0, peak),
    peakAt,
    zoneMinutes,
    share,
    switches: trace.events.filter((e) => e.type === 'switch').length,
    alertsDelivered: alerts.reduce((a, e) => a + e.count, 0),
    alertsActed: alerts.filter((e) => e.acted).length,
    busyMinutes: trace.activity.filter(Boolean).length,
  }
}
