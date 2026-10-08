import { useEffect, useMemo, useRef, useState } from 'react'
import { DRIVERS, DRIVER_INFO, defaultParams } from '../engine/params'
import { simulate } from '../engine/simulate'
import { summarize } from '../engine/summary'
import { SAMPLE } from '../scenarios'
import { World, type WorldData } from './scene/World'

const REPO = 'https://github.com/ananyapenumudi-ops/cognitiveos'
const DOCS = `${REPO}/blob/main/docs/CognitiveOS-Documentation.pdf`

type Status = 'live' | 'building' | 'planned'
interface Chapter {
  n: string
  eyebrow: string
  color: string
  title: [string, string]
  side: 'left' | 'right'
  status: { kind: Status; text: string }
  body: string[]
  facts: { k: string; v: string; ref: string }[]
}

const pct = (x: number) => `${Math.round(x * 100)}%`

function useSampleDay() {
  return useMemo(() => {
    const p = defaultParams()
    const base = simulate(SAMPLE.day, p)
    const lever = simulate(SAMPLE.lever.apply(SAMPLE.day), p)
    const a = summarize(base, p)
    const b = summarize(lever, p)
    const data: WorldData = { day: SAMPLE.day, base, lever, share: a.share }
    return { data, a, b }
  }, [])
}

function chapters(a: ReturnType<typeof summarize>, b: ReturnType<typeof summarize>): Chapter[] {
  const top = [...DRIVERS].sort((x, y) => a.share[y] - a.share[x])
  return [
    {
      n: '01', eyebrow: 'Load is a sum', color: 'var(--blue)', title: ['One number, ', 'six honest parts'], side: 'right',
      status: { kind: 'live', text: 'Live in the engine' },
      body: [
        'Working memory holds about four chunks at once. Six things compete for that space: the task itself, switching, notifications, unfinished tasks, deadlines and fatigue.',
        `CognitiveOS adds them up, minute by minute, with weights you can see. On the sample day, ${DRIVER_INFO[top[0]!].name.toLowerCase()} carries ${pct(a.share[top[0]!])} of the load, as much as the work itself. The column is that day.`,
      ],
      facts: [
        { k: 'Drivers', v: 'six, each with a source', ref: 'docs §02' },
        { k: 'Explanations', v: 'exact: load is a sum', ref: 'docs §03' },
        { k: 'Capacity', v: '≈ 4 chunks', ref: 'Cowan 2001' },
      ],
    },
    {
      n: '02', eyebrow: 'Switching & residue', color: 'var(--red)', title: ['Every switch ', 'leaves something behind'], side: 'left',
      status: { kind: 'live', text: 'Live in the engine' },
      body: [
        'Changing task costs time even when you expect it. Worse, part of your attention stays with the task you left, especially if it was unfinished. That is attention residue.',
        'The orb is your attention. Each hop leaves a red trail that fades over about twelve minutes. Hop often enough and the trails never clear.',
      ],
      facts: [
        { k: 'Time per task before switching', v: '≈ 11 min', ref: 'Mark et al. 2005' },
        { k: 'Attention residue', v: 'stronger if unfinished', ref: 'Leroy 2009' },
        { k: 'Residue fade', v: 'τ = 12 min (stand-in)', ref: 'params.ts' },
      ],
    },
    {
      n: '03', eyebrow: 'Notifications', color: 'var(--yellow-ink)', title: ['Even unread, ', 'an alert makes ripples'], side: 'right',
      status: { kind: 'live', text: 'Live in the engine' },
      body: [
        'Just receiving a notification hurt focus about as much as using the phone, even when people never picked it up. Some alerts you act on, and those become switches too.',
        'On the left, alerts land as they arrive. On the right they wait in a jar and land together: one ripple instead of many.',
      ],
      facts: [
        { k: 'Cost of an ignored alert', v: 'comparable to a call', ref: 'Stothart et al. 2015' },
        { k: 'Batching 3× a day', v: 'more focus, less stress', ref: 'Fitz et al. 2019' },
        { k: 'Acted-on alert', v: '3-min detour + switch', ref: 'params.ts' },
      ],
    },
    {
      n: '04', eyebrow: 'Open loops', color: 'var(--pink)', title: ['Unfinished tasks ', 'keep knocking'], side: 'left',
      status: { kind: 'live', text: 'Live in the engine' },
      body: [
        'Goals you have not finished intrude on whatever you are doing now. The surprise: you do not have to finish them. Writing a specific plan was enough to stop the interference.',
        'Each open ring is a task. Write its next step and the ring closes. The pull grows with the number of open tasks, then levels off.',
      ],
      facts: [
        { k: 'Plan making', v: 'removes the intrusion', ref: 'Masicampo & Baumeister 2011' },
        { k: 'Saturation', v: '1 − e^(−n/4)', ref: 'docs §02' },
        { k: 'Relief from a plan', v: '50% (stand-in)', ref: 'params.ts' },
      ],
    },
    {
      n: '05', eyebrow: 'Deadlines & fatigue', color: 'var(--purple)', title: ['Time runs out, ', 'energy runs down'], side: 'right',
      status: { kind: 'live', text: 'Live in the engine' },
      body: [
        'Deadline pressure is work left divided by time left, felt only in the last few hours. Interrupted people work faster but report more stress and time pressure.',
        'Fatigue builds with time on task and drains during breaks. Even brief, occasional breaks protect focus. It lags, so a heavy morning shows up after lunch.',
      ],
      facts: [
        { k: 'Temporal demand', v: 'a NASA-TLX dimension', ref: 'Hart & Staveland 1988' },
        { k: 'Time-on-task fatigue', v: 'lowers engagement', ref: 'Boksem & Tops 2008' },
        { k: 'Brief breaks', v: 'prevent vigilance drop', ref: 'Ariga & Lleras 2011' },
      ],
    },
    {
      n: '06', eyebrow: 'Your day, in 3D', color: 'var(--blue)', title: ['A whole day ', 'as a landscape'], side: 'left',
      status: { kind: 'live', text: 'Real engine output' },
      body: [
        'This is not a drawing. It is the engine running on the sample day: three meetings, four tasks, a report due at five. Time runs left to right; each colour is one driver.',
        `Mean load is ${a.mean.toFixed(2)}. ${a.zoneMinutes.overloaded} minutes sit above the overloaded line, almost all of them where switches stack on hard work.`,
      ],
      facts: [
        { k: 'Mean load', v: a.mean.toFixed(2), ref: 'sample day' },
        { k: 'Overloaded', v: `${a.zoneMinutes.overloaded} min`, ref: 'load ≥ 0.85' },
        { k: 'Switches', v: String(a.switches), ref: 'incl. alert detours' },
      ],
    },
    {
      n: '07', eyebrow: 'What if?', color: 'var(--green)', title: ['Try the day ', 'before you live it'], side: 'right',
      status: { kind: 'building', text: 'Levers live · What-If Lab week 5' },
      body: [
        'Same tasks, same total work, a different arrangement. The landscape eases between the day as planned and the day with three levers: meetings clustered, alerts batched, plans written.',
        `Mean load drops ${pct(1 - b.mean / a.mean)} and overloaded time goes from ${a.zoneMinutes.overloaded} to ${b.zoneMinutes.overloaded} minutes. Not every lever is a free win, though: clustering alone trades switches for fatigue, and the simulator says so.`,
      ],
      facts: [
        { k: 'Mean load', v: `${a.mean.toFixed(2)} → ${b.mean.toFixed(2)}`, ref: 'sample day' },
        { k: 'Overloaded', v: `${a.zoneMinutes.overloaded} → ${b.zoneMinutes.overloaded} min`, ref: '3 levers' },
        { k: 'Under-loaded', v: `${a.zoneMinutes.under} → ${b.zoneMinutes.under} min`, ref: 'reported too' },
      ],
    },
    {
      n: '08', eyebrow: 'Built to be trusted', color: 'var(--ink)', title: ['Every number ', 'has a source'], side: 'left',
      status: { kind: 'live', text: '15 tests · CI on every push' },
      body: [
        'Every value the model uses lives in one file with its citation. When the research gives no usable number at a one-minute scale, the value is flagged as a stand-in, never hidden. The cards are real entries from that file.',
        'Property tests run hundreds of random days: same seed, same trace; more alerts never help; plans never hurt; breaks never add fatigue. Nothing leaves your browser.',
      ],
      facts: [
        { k: 'Sources', v: '19 peer-reviewed', ref: 'docs app. B' },
        { k: 'Determinism', v: 'same day + seed = same trace', ref: 'docs §10' },
        { k: 'Not', v: 'a diagnosis, or a monitor', ref: 'docs §10' },
      ],
    },
  ]
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const STATUS_LABEL: Record<Status, string> = { live: '●', building: '◐', planned: '○' }

export default function Landing() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionsRef = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [webgl] = useState(hasWebGL)
  const { data, a, b } = useSampleDay()
  const CH = useMemo(() => chapters(a, b), [a, b])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !webgl) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let world: World
    try {
      world = new World(canvas, data, { reducedMotion })
    } catch {
      return // the page still reads fine without the 3D layer
    }
    world.start()

    const onScroll = () => {
      const mid = window.scrollY + window.innerHeight / 2
      const secs = sectionsRef.current.filter((s): s is HTMLElement => !!s)
      let f = 0
      for (let i = 0; i < secs.length; i++) {
        const top = secs[i]!.offsetTop
        const h = secs[i]!.offsetHeight
        if (mid >= top) f = i + Math.min((mid - top) / h, 1) - 0.5
      }
      f = Math.max(0, f)
      world.setChapter(f)
      setActive(Math.round(f))
    }
    const onResize = () => {
      world.resize()
      onScroll()
    }
    const onPointer = (e: PointerEvent) => world.setPointer(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointer, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointer)
      world.dispose()
    }
  }, [webgl, data])

  const goTo = (i: number) => sectionsRef.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const reg = (i: number) => (el: HTMLElement | null) => {
    sectionsRef.current[i] = el
  }

  return (
    <>
      <canvas ref={canvasRef} className={`world${webgl ? '' : ' hidden'}`} aria-hidden />
      <div className="vignette" aria-hidden />

      <nav className="nav">
        <a className="brand" href="#top" onClick={(e) => (e.preventDefault(), goTo(0))}>
          <svg viewBox="0 0 110 130" className="mark" aria-hidden>
            <path d="M18 130 C19 116 16 104 11 92 C3 72 4 44 20 26 C34 9 62 4 80 16 C92 24 96 38 95 50 C95 54 97 57 99 61 L106 73 C107 76 105 78 101 78 L101 82 C103 83 103 86 100 87 C102 89 101 92 98 93 C98 99 95 103 88 104 C83 104 80 106 80 110 L82 130 Z" fill="#2f5bd3" />
            <circle cx="58" cy="52" r="11" fill="#f2b233" />
            <circle cx="76" cy="40" r="6" fill="#e5452f" />
          </svg>
          <span className="wordmark">
            Cognitive<b>OS</b>
          </span>
        </a>
        <div className="nav-links">
          <a href="#how" onClick={(e) => (e.preventDefault(), goTo(1))}>
            How it works
          </a>
          <a href={DOCS} target="_blank" rel="noreferrer">
            Spec (PDF)
          </a>
          <a className="cta" href={REPO} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </nav>

      <ol className="rail" aria-label="Chapters">
        {['Intro', ...CH.map((c) => c.eyebrow), 'Start'].map((name, i) => (
          <li key={name}>
            <button type="button" className={i === active ? 'on' : ''} onClick={() => goTo(i)} aria-label={name} aria-current={i === active ? 'step' : undefined}>
              <span>{name}</span>
            </button>
          </li>
        ))}
      </ol>

      <main>
        <section className="hero" id="top" ref={reg(0)}>
          <p className="pill">A cognitive load simulator · not another to-do app</p>
          <h1>
            Cognitive<span>OS</span>
          </h1>
          <p className="lede">
            Lay out a day of tasks, meetings, alerts and deadlines. CognitiveOS estimates, minute by minute, how loaded your mind is, shows <b>what is driving it</b>, and
            lets you try a different way of working before you live it.
          </p>
          <div className="actions">
            <a className="btn primary" href="#how" onClick={(e) => (e.preventDefault(), goTo(1))}>
              See how it works ↓
            </a>
            <a className="btn ghost" href={DOCS} target="_blank" rel="noreferrer">
              Read the spec
            </a>
          </div>
          <dl className="stats">
            {[
              ['6', 'load drivers'],
              ['19', 'cited studies'],
              ['1 min', 'simulation step'],
              ['0', 'trackers or accounts'],
            ].map(([v, k], i) => (
              <div key={k} style={{ ['--c' as string]: ['var(--blue)', 'var(--red)', 'var(--yellow)', 'var(--green)'][i] }}>
                <dt>{v}</dt>
                <dd>{k}</dd>
              </div>
            ))}
          </dl>
          <div className="scroll-cue" aria-hidden>
            <span />
            scroll
          </div>
        </section>

        {CH.map((c, i) => (
          <section key={c.n} className={`chapter ${c.side}`} id={i === 0 ? 'how' : undefined} ref={reg(i + 1)}>
            <article className="card" style={{ ['--accent' as string]: c.color }}>
              <header>
                <span className="num">{c.n}</span>
                <span className="eyebrow">{c.eyebrow}</span>
                <span className={`status ${c.status.kind}`}>
                  {STATUS_LABEL[c.status.kind]} {c.status.text}
                </span>
              </header>
              <h2>
                {c.title[0]}
                <i>{c.title[1]}</i>
              </h2>
              {c.body.map((p, k) => (
                <p key={k}>{p}</p>
              ))}
              <dl className="facts">
                {c.facts.map((f) => (
                  <div key={f.k}>
                    <dt>{f.k}</dt>
                    <dd>
                      {f.v} <span className="ref">{f.ref}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          </section>
        ))}

        <section className="finale" ref={reg(CH.length + 1)}>
          <p className="pill">Week 2 of 6</p>
          <h2>
            The engine <i>runs.</i> The lab is next.
          </h2>
          <p className="lede">
            The load model, its levers and its tests are built. Next up: the Day Builder, the Load Dashboard with its “why?” card, and the What-If Lab.
          </p>
          <div className="actions">
            <a className="btn primary" href={REPO} target="_blank" rel="noreferrer">
              Follow on GitHub
            </a>
            <a className="btn ghost" href={DOCS} target="_blank" rel="noreferrer">
              Read the spec
            </a>
          </div>
          <footer className="fine">
            <p>
              CognitiveOS is a planning aid, not a diagnostic tool. It produces an estimate under stated assumptions; it does not measure anyone’s ability, and it is not for
              monitoring other people. Parameters marked “stand-in” are chosen values awaiting calibration.
            </p>
            <p>© 2026 Ananya Penumudi.</p>
          </footer>
        </section>
      </main>
    </>
  )
}
