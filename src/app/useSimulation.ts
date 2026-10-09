import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Day } from '../engine/schema'
import { simulate, type Trace } from '../engine/simulate'
import type { SimRequest, SimResponse } from '../engine/worker'

/**
 * Runs the engine in a Web Worker whenever the day changes and returns the
 * newest trace. Falls back to the main thread if workers are unavailable.
 * The first result is computed synchronously so the page never renders empty.
 */
export function useSimulation(day: Day): Trace {
  const [trace, setTrace] = useState<Trace>(() => simulate(day))
  const worker = useRef<Worker | null>(null)
  const latest = useRef(0)

  useEffect(() => {
    try {
      const w = new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<SimResponse>) => {
        if (e.data.id === latest.current) setTrace(e.data.trace)
      }
      worker.current = w
      return () => w.terminate()
    } catch {
      worker.current = null
    }
  }, [])

  useEffect(() => {
    const id = ++latest.current
    if (worker.current) worker.current.postMessage({ id, day } satisfies SimRequest)
    else setTrace(simulate(day))
  }, [day])

  return trace
}

/** Width of an element, kept up to date. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}
