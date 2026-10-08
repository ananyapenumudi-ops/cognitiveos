// Runs the prototype model on the sample days and injects the figures into the documentation.
// node build.mjs  ->  documentation.html (then: node print.mjs documentation.html ../CognitiveOS-Documentation.pdf)
import { readFileSync, writeFileSync } from 'node:fs'
import { simulate, summary, PARAMS } from './model.mjs'
import * as days from './days.mjs'

const C = { intrinsic: '#2f5bd3', switching: '#e5452f', notifications: '#f2b233', openLoops: '#e0569b', deadline: '#7b4fc9', fatigue: '#2fa37a' }
const NAME = { intrinsic: 'Task complexity', switching: 'Switching & residue', notifications: 'Notifications', openLoops: 'Open loops', deadline: 'Deadline pressure', fatigue: 'Fatigue' }
const keys = Object.keys(PARAMS.w)
const f = (n) => n.toFixed(1)
const font = `.ax{font:500 2.4px 'DM Mono',monospace;fill:#6f6457}.zl{font:700 2.3px 'DM Mono',monospace;letter-spacing:.2px;paint-order:stroke;stroke:#fffaf2;stroke-width:.9px}`

// 3-minute centred mean, for display only; summaries use the raw trace
function smooth(tr) {
  return tr.map((p, i) => { const win = tr.slice(Math.max(0, i - 1), i + 2); const parts = {}; for (const k of keys) parts[k] = win.reduce((s, q) => s + q.parts[k], 0) / win.length; return { t: p.t, L: win.reduce((s, q) => s + q.L, 0) / win.length, parts } })
}

function chartFrame(w, h, yMax, inner) {
  const y = (v) => h - (v / yMax) * h
  const zones = [[0.3, 'FOCUS BAND', '#2fa37a'], [0.65, 'STRAINED', '#d98a1c'], [0.85, 'OVERLOADED', '#e5452f']]
  let s = `<rect x="0" y="0" width="${w}" height="${h}" fill="#fffaf2"/>`
  s += `<rect x="0" y="${f(y(0.65))}" width="${w}" height="${f(y(0.3) - y(0.65))}" fill="#2fa37a" opacity=".08"/>`
  s += `<rect x="0" y="0" width="${w}" height="${f(y(0.85))}" fill="#e5452f" opacity=".07"/>`
  s += inner(y)
  for (const [v, label, col] of zones) s += `<line x1="0" x2="${w}" y1="${f(y(v))}" y2="${f(y(v))}" stroke="${col}" stroke-width=".25" stroke-dasharray="1 .8"/><text x="${w - 1}" y="${f(y(v) - 0.8)}" text-anchor="end" class="zl" fill="${col}">${label} ≥ ${v}</text>`
  for (let hr = 0; hr <= 8; hr++) s += `<text x="${f((hr * 60 / 480) * w)}" y="${h + 3.4}" text-anchor="${hr === 0 ? 'start' : hr === 8 ? 'end' : 'middle'}" class="ax">${String(9 + hr).padStart(2, '0')}:00</text>`
  return s
}

function stacked(day, w = 170, h = 52) {
  const tr = smooth(simulate(day).trace), yMax = 1.25
  const x = (t) => (t / (tr.length - 1)) * w
  const blocks = day.blocks.filter((b) => b.kind !== 'work')
  return `<svg viewBox="-1 -1 ${w + 2} ${h + 12}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block"><style>${font}</style>` +
    chartFrame(w, h, yMax, (y) => {
      let s = '', base = tr.map(() => 0)
      for (const b of blocks) s += `<rect x="${f(x(b.from))}" y="${h}" width="${f(x(b.to) - x(b.from))}" height="2.2" fill="${b.kind === 'meeting' ? '#1c2240' : '#c9bba6'}"/>`
      for (const k of keys) {
        const top = tr.map((p, i) => base[i] + p.parts[k])
        const up = top.map((v, i) => `${f(x(i))},${f(y(Math.min(v, yMax)))}`).join(' ')
        const down = base.map((v, i) => `${f(x(i))},${f(y(Math.min(v, yMax)))}`).reverse().join(' ')
        s += `<polygon points="${up} ${down}" fill="${C[k]}" opacity=".92"/>`
        base = top
      }
      return s
    }) + `<text x="0" y="${h + 6.8}" class="ax">▬ meeting   <tspan fill="#a8987f">▬ break</tspan></text></svg>`
}

function compare(a, b, w = 170, h = 30) {
  const ta = smooth(simulate(a).trace), tb = smooth(simulate(b).trace), yMax = 1.25
  const x = (t) => (t / (ta.length - 1)) * w
  const line = (tr, y) => tr.map((p, i) => `${f(x(i))},${f(y(Math.min(p.L, yMax)))}`).join(' ')
  return `<svg viewBox="-1 -1 ${w + 2} ${h + 5}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block"><style>${font}</style>` +
    chartFrame(w, h, yMax, (y) => `<polyline points="${line(ta, y)}" fill="none" stroke="#1c2240" stroke-width=".35" opacity=".55"/><polyline points="${line(tb, y)}" fill="none" stroke="#2f5bd3" stroke-width=".6"/>`) + '</svg>'
}

function donut(day, size = 40) {
  const s = summary(simulate(day)).share, r = 15, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r
  let off = 0, out = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">`
  for (const k of keys) {
    const len = s[k] * circ
    out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C[k]}" stroke-width="6.5" stroke-dasharray="${f(len - 0.4)} ${f(circ)}" stroke-dashoffset="${f(-off)}" transform="rotate(-90 ${cx} ${cy})"/>`
    off += len
  }
  return out + `<text x="${cx}" y="${cy - 1}" text-anchor="middle" style="font:800 6px 'Big Shoulders Display',sans-serif;fill:#1c2240">LOAD</text><text x="${cx}" y="${cy + 4}" text-anchor="middle" style="font:500 2.6px 'DM Mono',monospace;fill:#6f6457">BY DRIVER</text></svg>`
}

const base = summary(simulate(days.baseline))
const legend = keys.map((k) => `<li><i style="background:${C[k]}"></i>${NAME[k]}<b>${Math.round(base.share[k] * 100)}%</b></li>`).join('')
const scen = [['baseline', 'As planned', 'The sample day: three meetings, four tasks, alerts as they arrive'], ['batched', 'Batch alerts', 'Notifications held and delivered 4× a day (Fitz et al. 2019)'],
  ['planned', 'Write plans', 'A written next step for every open task (Masicampo &amp; Baumeister 2011)'], ['clustered', 'Cluster meetings', 'All meetings after lunch, deep work in long morning blocks'], ['combined', 'All three', 'Clustered meetings + batched alerts + written plans']]
const rows = scen.map(([k, name, what]) => {
  const s = summary(simulate(days[k]))
  const d = k === 'baseline' ? '' : `<span class="delta">${Math.round((s.mean / base.mean - 1) * 100)}%</span>`
  return `<tr><td><b>${name}</b><br><span class="small">${what}</span></td><td class="num">${s.mean.toFixed(2)} ${d}</td><td class="num">${s.peak.toFixed(2)}</td><td class="num">${s.mins['Focus band']}</td><td class="num">${s.mins.Strained}</td><td class="num">${s.mins.Overloaded}</td><td class="num">${s.mins['Under-loaded']}</td></tr>`
}).join('')

let html = readFileSync('documentation.src.html', 'utf8')
const sub = { FIG_LOAD: stacked(days.baseline), FIG_WHATIF: compare(days.baseline, days.combined), FIG_DONUT: donut(days.baseline), LEGEND: legend, WHATIF_ROWS: rows,
  BASE_MEAN: base.mean.toFixed(2), BASE_OVER: base.mins.Overloaded, BASE_SWITCH: Math.round(base.share.switching * 100), ALERTS: simulate(days.baseline).alerts }
for (const [k, v] of Object.entries(sub)) html = html.replaceAll(`{{${k}}}`, v)
writeFileSync('documentation.html', html)
console.log('built documentation.html', Object.fromEntries(Object.entries(sub).filter(([k]) => !k.startsWith('FIG') && k !== 'LEGEND' && k !== 'WHATIF_ROWS')))
