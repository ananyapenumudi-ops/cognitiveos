import { useState } from 'react'
import { explain } from '../engine/explain'
import { DRIVERS, DRIVER_INFO, ZONES, ZONE_INFO, defaultParams } from '../engine/params'
import { clock, type Block, type Day } from '../engine/schema'
import type { Trace } from '../engine/simulate'
import type { Summary } from '../engine/summary'
import { useStore } from './store'

const P = defaultParams()
/** "Why is it this?" — exact causes behind the load at the cursor. */
export function Why({ trace, day }: { trace: Trace; day: Day }) {
  const cursor = useStore((s) => s.cursor)
  const ex = explain(trace, day, cursor, P)
  const top = ex.causes.slice(0, 6)
  const rest = ex.causes.slice(6).reduce((s, c) => s + c.value, 0)
  return (
    <section className="card why" aria-live="polite">
      <header>
        <span className="tag">why?</span>
        <h3>
          {clock(day, cursor)} is <em style={{ color: ZONE_INFO[ex.zone].color }}>{ZONE_INFO[ex.zone].name.toLowerCase()}</em>
        </h3>
      </header>
      {top.length === 0 ? (
        <p className="muted">Nothing is loading this minute.</p>
      ) : (
        <ol>
          {top.map((c, k) => (
            <li key={k}>
              <i style={{ background: DRIVER_INFO[c.driver].color }} />
              <span>{c.text}</span>
              <b>+{c.value.toFixed(2)}</b>
            </li>
          ))}
          {rest > 0.004 && (
            <li className="muted">
              <i />
              <span>{ex.causes.length - 6} smaller causes</span>
              <b>+{rest.toFixed(2)}</b>
            </li>
          )}
        </ol>
      )}
      <p className="foot">Exact: load is a sum, so these add up to {ex.load.toFixed(2)}.</p>
    </section>
  )
}

/** Minutes per zone and each driver's share of the day. */
export function DaySummary({ sum }: { sum: Summary }) {
  const r = 34
  const circ = 2 * Math.PI * r
  const offsets = DRIVERS.map((_, i) => DRIVERS.slice(0, i).reduce((s, d) => s + sum.share[d] * circ, 0))
  return (
    <section className="card summary">
      <div className="zones">
        {ZONES.map((z) => (
          <div key={z} style={{ ['--z' as string]: ZONE_INFO[z].color }}>
            <b>{sum.zoneMinutes[z]}</b>
            <span>min {ZONE_INFO[z].name.toLowerCase()}</span>
          </div>
        ))}
      </div>
      <div className="share">
        <svg viewBox="0 0 90 90" aria-hidden>
          {DRIVERS.map((d, i) => (
            <circle key={d} cx="45" cy="45" r={r} fill="none" stroke={DRIVER_INFO[d].color} strokeWidth="13" strokeDasharray={`${Math.max(0, sum.share[d] * circ - 1)} ${circ}`} strokeDashoffset={-(offsets[i] ?? 0)} transform="rotate(-90 45 45)" />
          ))}
          <text x="45" y="43" textAnchor="middle" className="donut-big">
            {sum.mean.toFixed(2)}
          </text>
          <text x="45" y="55" textAnchor="middle" className="donut-small">
            MEAN LOAD
          </text>
        </svg>
        <ul>
          {[...DRIVERS]
            .sort((a, b) => sum.share[b] - sum.share[a])
            .map((d) => (
              <li key={d}>
                <i style={{ background: DRIVER_INFO[d].color }} />
                {DRIVER_INFO[d].name}
                <b>{Math.round(sum.share[d] * 100)}%</b>
              </li>
            ))}
        </ul>
      </div>
    </section>
  )
}

/** Edit the selected block. */
export function Inspector({ day }: { day: Day }) {
  const selected = useStore((s) => s.selected)
  const { updateBlock, removeBlock, select } = useStore.getState()
  const b = selected === null ? undefined : day.blocks[selected]
  if (selected === null || !b) return <p className="inspector empty">Select a block to edit it.</p>
  const set = (patch: Partial<Block>) => updateBlock(selected, patch)
  return (
    <div className="inspector" role="group" aria-label="Selected block">
      {b.kind === 'break' ? (
        <b className="name">Break</b>
      ) : (
        <input className="name" value={b.task} aria-label="Task name" onChange={(e) => e.target.value && set({ task: e.target.value })} />
      )}
      <span className="mono">
        {clock(day, b.from)}–{clock(day, b.to)} · {b.to - b.from} min
      </span>
      <div className="seg" role="radiogroup" aria-label="Kind">
        {(['work', 'meeting', 'break'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={b.kind === k} className={b.kind === k ? 'on' : ''} onClick={() => set(k === 'break' ? { kind: k, task: 'break' } : { kind: k, task: b.kind === 'break' ? 'New task' : b.task })}>
            {k}
          </button>
        ))}
      </div>
      {b.kind !== 'break' && (
        <div className="seg cx" role="radiogroup" aria-label="Complexity">
          {[1, 2, 3, 4, 5].map((c) => (
            <button key={c} type="button" role="radio" aria-checked={b.c === c} className={b.c === c ? 'on' : ''} onClick={() => set({ c })} title={['sorting email', 'routine', 'focused', 'hard', 'debugging a race condition'][c - 1]}>
              c{c}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="ghost danger" onClick={() => removeBlock(selected)}>
        Delete
      </button>
      <button type="button" className="ghost" onClick={() => select(null)} aria-label="Close inspector">
        ✕
      </button>
    </div>
  )
}

/** Alerts, open tasks and deadlines: everything that loads the day besides the blocks. */
export function Noise({ day }: { day: Day }) {
  const patchDay = useStore((s) => s.patchDay)
  const [newLoop, setNewLoop] = useState('')
  const tasks = [...new Set(day.blocks.filter((b) => b.kind === 'work').map((b) => b.task))]
  const batchEvery = day.batchAt && day.batchAt.length > 1 ? day.batchAt[0]! : day.batchAt ? -1 : 0
  const setBatch = (every: number) => {
    if (!every) return patchDay({ batchAt: null })
    const at: number[] = []
    for (let t = every; t < day.minutes - 1; t += every) at.push(t)
    patchDay({ batchAt: [...at, day.minutes - 1] })
  }
  const toClock = (m: number) => clock(day, m)
  const fromClock = (v: string) => {
    const [h, m] = v.split(':').map(Number)
    let rel = (h ?? 0) * 60 + (m ?? 0) - day.startClock
    if (rel < -60) rel += 1440
    return rel
  }
  return (
    <section className="card noise">
      <h3>The noise</h3>
      <label className="range">
        <span>
          Alerts per hour <b>{Math.round(day.alertsPerHour)}</b>
        </span>
        <input type="range" min={0} max={60} value={day.alertsPerHour} onChange={(e) => patchDay({ alertsPerHour: Number(e.target.value) })} />
      </label>
      <label className="range">
        <span>
          You stop for <b>{Math.round(day.actOnAlerts * 100)}%</b> of them
        </span>
        <input type="range" min={0} max={100} value={Math.round(day.actOnAlerts * 100)} onChange={(e) => patchDay({ actOnAlerts: Number(e.target.value) / 100 })} />
      </label>
      <div className="row">
        <span>Deliver alerts</span>
        <div className="seg" role="radiogroup" aria-label="Alert delivery">
          {[
            [0, 'as they come'],
            [60, 'hourly'],
            [120, 'every 2 h'],
          ].map(([v, name]) => (
            <button key={v} type="button" role="radio" aria-checked={batchEvery === v} className={batchEvery === v ? 'on' : ''} onClick={() => setBatch(v as number)}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <h4>
        Open tasks <span className="muted">click to mark planned</span>
      </h4>
      <div className="chips">
        {day.openTasks.map((o, i) => (
          <span key={`${o.name}-${i}`} className={`chip${o.planned ? ' planned' : ''}`}>
            <button type="button" aria-pressed={o.planned} onClick={() => patchDay({ openTasks: day.openTasks.map((x, k) => (k === i ? { ...x, planned: !x.planned } : x)) })} title={o.planned ? 'Has a written next step' : 'No next step written yet'}>
              {o.planned ? '✓ ' : '○ '}
              {o.name}
            </button>
            <button type="button" className="x" aria-label={`Remove ${o.name}`} onClick={() => patchDay({ openTasks: day.openTasks.filter((_, k) => k !== i) })}>
              ×
            </button>
          </span>
        ))}
        <input
          className="chip-input"
          placeholder="+ add"
          aria-label="Add an open task"
          value={newLoop}
          onChange={(e) => setNewLoop(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newLoop.trim()) {
              patchDay({ openTasks: [...day.openTasks, { name: newLoop.trim(), planned: false }] })
              setNewLoop('')
            }
          }}
        />
      </div>

      <h4>Deadlines</h4>
      {day.deadlines.map((d, i) => (
        <div className="deadline" key={i}>
          <select aria-label="Task" value={d.task} onChange={(e) => patchDay({ deadlines: day.deadlines.map((x, k) => (k === i ? { ...x, task: e.target.value } : x)) })}>
            {[...new Set([d.task, ...tasks])].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <label>
            due
            <input type="time" value={toClock(d.at)} onChange={(e) => e.target.value && patchDay({ deadlines: day.deadlines.map((x, k) => (k === i ? { ...x, at: fromClock(e.target.value) } : x)) })} />
          </label>
          <label>
            <input type="number" min={0} step={10} value={d.workLeft} onChange={(e) => patchDay({ deadlines: day.deadlines.map((x, k) => (k === i ? { ...x, workLeft: Math.max(0, Number(e.target.value)) } : x)) })} />
            min left
          </label>
          <button type="button" className="x" aria-label="Remove deadline" onClick={() => patchDay({ deadlines: day.deadlines.filter((_, k) => k !== i) })}>
            ×
          </button>
        </div>
      ))}
      {tasks.length > 0 && (
        <button type="button" className="ghost small" onClick={() => patchDay({ deadlines: [...day.deadlines, { task: tasks[0]!, at: day.minutes, workLeft: 60 }] })}>
          + deadline
        </button>
      )}
    </section>
  )
}
