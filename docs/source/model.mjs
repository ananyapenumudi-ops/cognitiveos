// Prototype of the CognitiveOS load model, used to draw the figures in the documentation.
// One tick = one simulated minute. Deterministic: same day + same seed -> same trace.
// Every coefficient is a stand-in to be calibrated (see section 03 of the doc).

export const PARAMS = {
  w: { intrinsic: 0.34, switching: 0.30, notifications: 0.16, openLoops: 0.14, deadline: 0.14, fatigue: 0.22 },
  switchSpike: 1.0, tauSwitch: 3,      // min: immediate cost of re-orienting (Monsell 2003)
  residue: 0.75, tauResidue: 12,       // min: attention residue from an unfinished task (Leroy 2009)
  notifSpike: 0.55, tauNotif: 1.5,     // min: cost of an unattended alert (Stothart et al. 2015)
  attendP: 0.35, inboxMin: 3,          // share of alerts acted on; minutes away when they are
  kappaLoops: 4, planRelief: 0.5,      // open-loop saturation; relief from a written plan (Masicampo & Baumeister 2011)
  deadlineHorizon: 240,                // min: deadlines further away than this exert no pressure
  fatigueRate: 1 / 260, tauRecover: 14 // time-on-task build-up and recovery during breaks (Boksem & Tops 2008)
}

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) }

// day: { minutes, blocks: [{from, to, task, c (1-5), kind: 'work'|'meeting'|'break'}],
//        alertsPerHour, batchAt: [minutes] | null, openLoops, planned, deadlines: [{at, workLeft}] }
export function simulate(day, P = PARAMS, seed = 7) {
  const rand = rng(seed)
  const alerts = []
  for (let t = 0; t < day.minutes; t++) if (rand() < day.alertsPerHour / 60) alerts.push(t)
  const delivered = new Map()
  if (day.batchAt) for (const t of alerts) { const b = day.batchAt.find((x) => x >= t) ?? day.minutes - 1; delivered.set(b, (delivered.get(b) || 0) + 1) }
  else for (const t of alerts) delivered.set(t, (delivered.get(t) || 0) + 1)

  const blockAt = (t) => day.blocks.find((b) => t >= b.from && t < b.to) || { kind: 'break', c: 0 }
  let F = 0, prev = null, switches = [], residues = [], notifs = [], away = 0, events = []
  const out = []
  for (let t = 0; t < day.minutes; t++) {
    const b = blockAt(t)
    if (b.kind !== 'break' && prev && prev.task !== b.task && prev.kind !== 'break') {
      switches.push(t); if (prev.c) residues.push([t, prev.c / 5]); events.push({ t, type: 'switch' })
    }
    if (b.kind !== 'break' && prev && prev.kind === 'break' && t > 0) switches.push(t) // re-entry, no residue
    const n = delivered.get(t) || 0
    if (n && b.kind !== 'break') {
      notifs.push([t, day.batchAt ? Math.min(1.6, 0.6 + 0.2 * n) : n])
      const acted = day.batchAt ? true : rand() < P.attendP
      if (acted) { away = P.inboxMin; switches.push(t); residues.push([t + P.inboxMin, b.c / 5 * 0.6]); events.push({ t, type: 'inbox' }) }
    }
    const decay = (list, tau, k) => list.reduce((s, [t0, a = 1]) => (t >= t0 ? s + k * a * Math.exp(-(t - t0) / tau) : s), 0)
    const working = b.kind !== 'break'
    const x = {
      intrinsic: working ? (away > 0 ? 0.2 : b.c / 5) : 0,
      switching: Math.min(1.2, switches.reduce((s, t0) => (t >= t0 ? s + P.switchSpike * Math.exp(-(t - t0) / P.tauSwitch) : s), 0) + decay(residues, P.tauResidue, P.residue)),
      notifications: Math.min(1.2, decay(notifs, P.tauNotif, P.notifSpike)),
      openLoops: (1 - Math.exp(-day.openLoops / P.kappaLoops)) * (day.planned ? 1 - P.planRelief : 1) * (working ? 1 : 0.5),
      deadline: Math.max(0, ...day.deadlines.map((d) => { const left = d.at - t; return left > 0 && left < P.deadlineHorizon ? Math.min(1, d.workLeft / left) * (1 - left / P.deadlineHorizon) * 1.6 : 0 })),
      fatigue: F,
    }
    const parts = Object.fromEntries(Object.entries(x).map(([k, v]) => [k, P.w[k] * v]))
    const L = Object.values(parts).reduce((a, v) => a + v, 0)
    F = working ? Math.min(1, F + P.fatigueRate * (0.4 + L) * (1 - F)) : F * Math.exp(-1 / P.tauRecover)
    if (away > 0) away--
    prev = b
    out.push({ t, L, parts })
  }
  return { trace: out, alerts: alerts.length, events }
}

export const ZONES = [[0, 0.3, 'Under-loaded'], [0.3, 0.65, 'Focus band'], [0.65, 0.85, 'Strained'], [0.85, 9, 'Overloaded']]
export function summary(res) {
  const tr = res.trace, n = tr.length
  const mins = ZONES.map(([a, b, name]) => [name, tr.filter((p) => p.L >= a && p.L < b).length])
  const share = {}; for (const k of Object.keys(PARAMS.w)) share[k] = tr.reduce((s, p) => s + p.parts[k], 0)
  const tot = Object.values(share).reduce((a, v) => a + v, 0)
  for (const k in share) share[k] /= tot
  return { mean: tr.reduce((s, p) => s + p.L, 0) / n, peak: Math.max(...tr.map((p) => p.L)), mins: Object.fromEntries(mins), share }
}
