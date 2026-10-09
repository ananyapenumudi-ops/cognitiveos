import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { clock, type Block, type Day } from '../engine/schema'
import { GUTTER, blockColor } from './layout'
import { SNAP, freeRange, gapAt, useStore } from './store'

interface Lane {
  task: string
  kind: Block['kind']
}

function lanes(day: Day): Lane[] {
  const seen = new Map<string, Lane>()
  for (const b of [...day.blocks].sort((a, z) => a.from - z.from)) if (b.kind !== 'break' && !seen.has(b.task)) seen.set(b.task, { task: b.task, kind: b.kind })
  return [...seen.values(), { task: 'break', kind: 'break' }]
}

type Drag = { i: number; mode: 'move' | 'left' | 'right'; x0: number; from0: number; to0: number; moved: boolean }

const snap = (m: number) => Math.round(m / SNAP) * SNAP

export function Timeline({ width }: { width: number }) {
  const day = useStore((s) => s.day)
  const selected = useStore((s) => s.selected)
  const cursor = useStore((s) => s.cursor)
  const { updateBlock, addBlock, removeBlock, select, setCursor } = useStore.getState()
  const drag = useRef<Drag | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const track = Math.max(200, width - GUTTER)
  const ppm = track / day.minutes
  const x = (t: number) => t * ppm
  const rows = lanes(day)
  const hours: number[] = []
  for (let m = (60 - (day.startClock % 60)) % 60; m <= day.minutes; m += 60) hours.push(m)

  const onDown = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    const b = day.blocks[i]!
    const r = e.currentTarget.getBoundingClientRect()
    const edge = Math.min(10, r.width / 4)
    const mode = e.clientX - r.left < edge ? 'left' : r.right - e.clientX < edge ? 'right' : 'move'
    drag.current = { i, mode, x0: e.clientX, from0: b.from, to0: b.to, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
    select(i)
  }
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    const now = useStore.getState().day // handlers can fire faster than React re-renders
    const dm = snap((e.clientX - d.x0) / ppm)
    if (dm !== 0) d.moved = true
    const [lo, hi] = freeRange(now, d.i)
    const dur = d.to0 - d.from0
    if (d.mode === 'move') {
      const want = d.from0 + dm
      // dragged past the middle of a neighbour that blocks the way: swap with it
      const nb = want + dur > hi ? now.blocks.findIndex((o) => o.from === hi) : want < lo ? now.blocks.findIndex((o) => o.to === lo) : -1
      const o = now.blocks[nb]
      if (o && (want > lo ? want + dur > o.from + (o.to - o.from) / 2 : want < o.to - (o.to - o.from) / 2)) {
        useStore.getState().swap(d.i, nb)
        const moved = useStore.getState().day.blocks[d.i]!
        d.x0 += (moved.from - d.from0) * ppm
        d.from0 = moved.from
        d.to0 = moved.to
        return
      }
      const from = Math.min(Math.max(want, lo), hi - dur)
      updateBlock(d.i, { from, to: from + dur })
    } else if (d.mode === 'left') updateBlock(d.i, { from: Math.min(Math.max(d.from0 + dm, lo), d.to0 - SNAP) })
    else updateBlock(d.i, { to: Math.max(Math.min(d.to0 + dm, hi), d.from0 + SNAP) })
  }
  const onUp = () => {
    drag.current = null
  }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const b = day.blocks[i]!
    const [lo, hi] = freeRange(day, i)
    const step = e.key === 'ArrowLeft' ? -SNAP : e.key === 'ArrowRight' ? SNAP : 0
    if (step && e.altKey) {
      e.preventDefault()
      const nb = day.blocks.findIndex((o) => (step > 0 ? o.from === hi && hi === b.to : o.to === lo && lo === b.from))
      if (nb >= 0) useStore.getState().swap(i, nb)
    } else if (step && e.shiftKey) {
      e.preventDefault()
      updateBlock(i, { to: Math.max(Math.min(b.to + step, hi), b.from + SNAP) })
    } else if (step) {
      e.preventDefault()
      const from = Math.min(Math.max(b.from + step, lo), hi - (b.to - b.from))
      updateBlock(i, { from, to: from + (b.to - b.from) })
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeBlock(i)
    } else if (/^[1-5]$/.test(e.key) && b.kind !== 'break') updateBlock(i, { c: Number(e.key) })
  }

  /** Click on an empty part of a lane: add a block there, up to 30 minutes, inside the free gap. */
  const onLaneClick = (e: MouseEvent<HTMLDivElement>, lane: Lane) => {
    if (e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    const t = (e.clientX - r.left) / ppm
    const gap = gapAt(day, Math.floor(t))
    if (!gap || gap[1] - gap[0] < SNAP * 2) return
    const len = Math.min(30, gap[1] - gap[0])
    const from = Math.min(Math.max(snap(t - len / 2), gap[0]), gap[1] - len)
    const proto = day.blocks.find((b) => b.task === lane.task)
    addBlock({ from, to: from + len, task: lane.task, kind: lane.kind, c: proto?.c ?? 3 })
  }

  const addTask = () => {
    const name = newName.trim()
    setAdding(false)
    setNewName('')
    if (!name) return
    // first free stretch of at least 30 minutes
    const sorted = [...day.blocks].sort((a, b) => a.from - b.from)
    let t = 0
    for (const b of sorted) {
      if (b.from - t >= 30) break
      t = Math.max(t, b.to)
    }
    if (day.minutes - t < SNAP * 2) return
    addBlock({ from: t, to: Math.min(t + 30, day.minutes), task: name, kind: 'work', c: 3 })
  }

  return (
    <div className="timeline" onPointerLeave={onUp}>
      <div className="ruler" style={{ marginLeft: GUTTER }}>
        {hours.map((m) => (
          <span key={m} style={{ left: x(m) }}>
            {clock(day, m)}
          </span>
        ))}
      </div>
      {rows.map((lane) => (
        <div className="lane" key={lane.task}>
          <div className="lane-label" style={{ width: GUTTER }}>
            <i className={`kind ${lane.kind}`} />
            {lane.kind === 'break' ? 'Breaks' : lane.task}
          </div>
          <div className="lane-track" style={{ width: track }} onClick={(e) => onLaneClick(e, lane)} title="Click an empty spot to add a block">
            {day.blocks.map((b, i) =>
              b.task !== lane.task || (lane.kind === 'break') !== (b.kind === 'break') ? null : (
                <button
                  key={i}
                  type="button"
                  className={`block ${b.kind}${selected === i ? ' sel' : ''}`}
                  style={{ left: x(b.from), width: Math.max(6, x(b.to) - x(b.from)), background: blockColor(b) }}
                  aria-label={`${b.kind === 'break' ? 'Break' : b.task}, ${clock(day, b.from)} to ${clock(day, b.to)}${b.kind !== 'break' ? `, complexity ${b.c}` : ''}. Arrow keys move, alt+arrows swap with the neighbour, shift+arrows resize, 1 to 5 set complexity, delete removes.`}
                  onPointerDown={(e) => onDown(e, i)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onFocus={() => select(i)}
                  onKeyDown={(e) => onKey(e, i)}
                  onDoubleClick={() => setCursor(b.from)}
                >
                  {x(b.to) - x(b.from) > 44 && <span>{b.kind === 'break' ? 'break' : `${b.kind === 'meeting' ? '' : `c${b.c} · `}${clock(day, b.from)}`}</span>}
                </button>
              ),
            )}
          </div>
        </div>
      ))}
      <div className="lane add">
        <div className="lane-label" style={{ width: GUTTER }}>
          {adding ? (
            <input
              autoFocus
              value={newName}
              placeholder="Task name"
              aria-label="New task name"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => (e.key === 'Enter' ? addTask() : e.key === 'Escape' && setAdding(false))}
              onBlur={addTask}
            />
          ) : (
            <button type="button" className="add-task" onClick={() => setAdding(true)}>
              + Task
            </button>
          )}
        </div>
        <div className="hint">Drag to move · drag an edge to resize · click an empty spot to add · drag past a neighbour to swap · keys: ← → move, ⌥← → swap, ⇧← → resize, 1–5 complexity, ⌫ delete</div>
      </div>
      <div className="cursor-line" style={{ left: GUTTER + x(cursor) }} aria-hidden />
    </div>
  )
}
