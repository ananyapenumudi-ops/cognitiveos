import { useMemo } from 'react'
import { defaultParams } from '../engine/params'
import { summarize } from '../engine/summary'
import { LoadChart } from './LoadChart'
import { CrewPanel } from './Crew'
import { DaySummary, Inspector, Noise, Why } from './Panels'
import { Timeline } from './Timeline'
import { LIBRARY, useStore } from './store'
import { useSimulation, useWidth } from './useSimulation'

const P = defaultParams()
const DOCS = 'https://github.com/ananyapenumudi-ops/cognitiveos/blob/main/docs/CognitiveOS-Documentation.pdf'

export default function App() {
  const day = useStore((s) => s.day)
  const scenario = useStore((s) => s.scenario)
  const { loadScenario, reset, patchDay } = useStore.getState()
  const trace = useSimulation(day)
  const sum = useMemo(() => summarize(trace, P), [trace])
  const [ref, width] = useWidth<HTMLDivElement>()
  // timeline and chart share one width, so a minute lines up across both
  const w = Math.max(720, width)
  const edited = JSON.stringify(day) !== JSON.stringify(scenario.day)

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="./">
          Cognitive<span>OS</span>
        </a>
        <nav className="scenarios" aria-label="Scenario library">
          {LIBRARY.map((s) => (
            <button key={s.id} type="button" className={s.id === scenario.id ? 'on' : ''} aria-pressed={s.id === scenario.id} onClick={() => loadScenario(s.id)}>
              <small>{s.who}</small>
              {s.title}
            </button>
          ))}
        </nav>
        <a className="pill pill-cream pill-sm" href={DOCS} target="_blank" rel="noreferrer">
          Spec ↗
        </a>
      </header>

      <section className="intro">
        <div>
          <h1>{scenario.title}</h1>
          <p>{scenario.story}</p>
        </div>
        <div className="try">
          <span className="hello">try this</span>
          <p>
            <b>{scenario.lever.name}.</b> {scenario.expect}
          </p>
          <div className="try-actions">
            <button type="button" className="pill pill-red" onClick={() => patchDay(scenario.lever.apply(day))}>
              Apply to my day
            </button>
            <button type="button" className="pill pill-cream" onClick={reset} disabled={!edited}>
              Reset
            </button>
          </div>
        </div>
      </section>

      <main className="grid">
        <aside className="side">
          <CrewPanel trace={trace} day={day} />
          <Why trace={trace} day={day} />
        </aside>
        <div className="main">
          <section className="card builder">
            <header>
              <h2>Your day</h2>
              <Inspector day={day} />
            </header>
            <div className="scroller" ref={ref}>
              <div style={{ width: w }}>
                <Timeline width={w} />
                <LoadChart trace={trace} day={day} width={w} />
              </div>
            </div>
          </section>
          <div className="lower">
            <DaySummary sum={sum} />
            <Noise day={day} />
          </div>
        </div>
      </main>
      <footer className="fine">
        An estimate under stated assumptions, not a diagnosis. Values marked stand-in in the spec are chosen values awaiting calibration. Nothing you enter leaves this browser.
      </footer>
    </div>
  )
}
