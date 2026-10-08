import type { SourceId } from './sources'

/**
 * Every number the model uses, in one place, with where it comes from.
 * `standIn: true` means the literature motivates the mechanism but gives no
 * usable value at a one-minute scale, so we chose one; calibration replaces it.
 * The Model Card renders this file directly — keep `note` readable.
 */
export interface ParamSpec {
  value: number
  unit: string
  sources: SourceId[]
  standIn: boolean
  note: string
}

export const DRIVERS = ['complexity', 'switching', 'alerts', 'openLoops', 'deadline', 'fatigue'] as const
export type Driver = (typeof DRIVERS)[number]

export const DRIVER_INFO: Record<Driver, { name: string; color: string; blurb: string }> = {
  complexity: { name: 'Task complexity', color: '#2f5bd3', blurb: 'How much of the task has to be held in mind at once.' },
  switching: { name: 'Switching & residue', color: '#e5452f', blurb: 'Re-orienting after a switch, and thoughts left on the old task.' },
  alerts: { name: 'Notifications', color: '#f2b233', blurb: 'The pull of an alert, even one you ignore.' },
  openLoops: { name: 'Open loops', color: '#e0569b', blurb: 'Unfinished tasks that keep knocking.' },
  deadline: { name: 'Deadline pressure', color: '#7b4fc9', blurb: 'Work left compared with time left.' },
  fatigue: { name: 'Fatigue', color: '#2fa37a', blurb: 'Builds with time on task, drains during breaks.' },
}

export const PARAM_SPECS = {
  // ── weights: how much each driver counts towards load ──
  wComplexity: { value: 0.34, unit: 'weight', sources: ['sweller1988', 'sweller1998', 'cowan2001'], standIn: true, note: 'Weight of intrinsic task load. The largest single weight: the work itself should dominate a calm day.' },
  wSwitching: { value: 0.3, unit: 'weight', sources: ['monsell2003', 'leroy2009'], standIn: true, note: 'Weight of switch spikes plus attention residue.' },
  wAlerts: { value: 0.16, unit: 'weight', sources: ['stothart2015'], standIn: true, note: 'Weight of the short pull of each alert. Acted-on alerts also count as switches.' },
  wOpenLoops: { value: 0.14, unit: 'weight', sources: ['masicampo2011'], standIn: true, note: 'Weight of background load from unfinished tasks.' },
  wDeadline: { value: 0.14, unit: 'weight', sources: ['hart1988', 'mark2008'], standIn: true, note: 'Weight of temporal demand (one of the six NASA-TLX dimensions).' },
  wFatigue: { value: 0.22, unit: 'weight', sources: ['boksem2008'], standIn: true, note: 'Weight of accumulated fatigue.' },

  // ── switching ──
  switchSpike: { value: 1, unit: 'driver units', sources: ['rogers1995', 'rubinstein2001'], standIn: true, note: 'Immediate cost of re-orienting at a switch. Lab switch costs are hundreds of milliseconds; at a one-minute step this stands for re-finding your place.' },
  tauSwitch: { value: 3, unit: 'min', sources: ['monsell2003'], standIn: true, note: 'How fast the switch spike fades.' },
  resumeSpike: { value: 0.5, unit: '× switchSpike', sources: ['altmann2002'], standIn: true, note: 'Coming back from a break to the same task: the goal must be re-activated, but there is no residue from another task.' },
  residue: { value: 0.75, unit: 'driver units', sources: ['leroy2009'], standIn: true, note: 'Attention residue after leaving a task, scaled by that task\'s complexity ÷ 5.' },
  residueFinished: { value: 0.4, unit: '× residue', sources: ['leroy2009'], standIn: true, note: 'Residue is weaker when the task you left is finished (its last block of the day).' },
  tauResidue: { value: 12, unit: 'min', sources: ['leroy2009'], standIn: true, note: 'How fast residue fades.' },

  // ── notifications ──
  alertSpike: { value: 0.55, unit: 'driver units', sources: ['stothart2015'], standIn: true, note: 'Pull of one alert you do not act on.' },
  tauAlert: { value: 1.5, unit: 'min', sources: ['stothart2015'], standIn: true, note: 'How fast that pull fades.' },
  batchSpike: { value: 0.2, unit: 'per alert', sources: ['fitz2019'], standIn: true, note: 'A batch is one look at many alerts: base 0.6 plus this per alert, capped at 1.6.' },
  inboxMin: { value: 3, unit: 'min', sources: ['mark2005'], standIn: true, note: 'Length of the detour when you act on an alert.' },
  inboxComplexity: { value: 1, unit: '1–5', sources: [], standIn: true, note: 'Complexity of dealing with an alert (a quick reply).' },

  // ── open loops ──
  kappaLoops: { value: 4, unit: 'tasks', sources: ['masicampo2011', 'cowan2001'], standIn: true, note: 'Open-loop load is 1 − e^(−n/κ): it saturates, and κ = 4 echoes working-memory capacity.' },
  planRelief: { value: 0.5, unit: 'fraction', sources: ['masicampo2011'], standIn: true, note: 'Share of an open task\'s pull removed by writing a concrete next step.' },
  idleLoops: { value: 0.5, unit: 'fraction', sources: [], standIn: true, note: 'Open loops still pull during breaks, at this fraction.' },

  // ── deadlines ──
  deadlineHorizon: { value: 240, unit: 'min', sources: ['mark2008'], standIn: true, note: 'Deadlines further away than this exert no pressure.' },
  deadlineGain: { value: 1.6, unit: '×', sources: [], standIn: true, note: 'Scales (work left ÷ time left) × closeness into driver units.' },

  // ── fatigue ──
  fatigueRate: { value: 1 / 260, unit: 'per min', sources: ['boksem2008'], standIn: true, note: 'Fatigue growth while working, faster under higher load.' },
  fatigueBase: { value: 0.4, unit: 'driver units', sources: ['boksem2008'], standIn: true, note: 'Fatigue grows even under light load.' },
  tauRecover: { value: 14, unit: 'min', sources: ['ariga2011'], standIn: true, note: 'How fast fatigue drains during a break.' },

  // ── bounds and zones ──
  driverCap: { value: 1.2, unit: 'driver units', sources: [], standIn: false, note: 'No driver can exceed this, so one runaway input cannot dominate.' },
  zoneFocus: { value: 0.3, unit: 'load', sources: ['yerkes1908', 'teigen1994'], standIn: true, note: 'Below this a minute counts as under-loaded. The bands are a display convention, not a law.' },
  zoneStrained: { value: 0.65, unit: 'load', sources: ['yerkes1908', 'teigen1994'], standIn: true, note: 'At or above this, strained.' },
  zoneOverloaded: { value: 0.85, unit: 'load', sources: ['yerkes1908', 'teigen1994'], standIn: true, note: 'At or above this, overloaded.' },
} as const satisfies Record<string, ParamSpec>

export type ParamKey = keyof typeof PARAM_SPECS
export type Params = Record<ParamKey, number>

export function defaultParams(): Params {
  return Object.fromEntries(Object.entries(PARAM_SPECS).map(([k, s]) => [k, s.value])) as Params
}

export function weights(p: Params): Record<Driver, number> {
  return { complexity: p.wComplexity, switching: p.wSwitching, alerts: p.wAlerts, openLoops: p.wOpenLoops, deadline: p.wDeadline, fatigue: p.wFatigue }
}

export const ZONES = ['under', 'focus', 'strained', 'overloaded'] as const
export type Zone = (typeof ZONES)[number]

export const ZONE_INFO: Record<Zone, { name: string; color: string }> = {
  under: { name: 'Under-loaded', color: '#c9bba6' },
  focus: { name: 'Focus band', color: '#2fa37a' },
  strained: { name: 'Strained', color: '#e8902a' },
  overloaded: { name: 'Overloaded', color: '#e5452f' },
}

export function zoneOf(load: number, p: Params): Zone {
  if (load >= p.zoneOverloaded) return 'overloaded'
  if (load >= p.zoneStrained) return 'strained'
  if (load >= p.zoneFocus) return 'focus'
  return 'under'
}
