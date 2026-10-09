/**
 * Engine host for the browser: simulates off the main thread so dragging a
 * block never stalls the page. Requests carry an id; the UI keeps only the
 * newest answer.
 */
import type { Params } from './params'
import type { Day } from './schema'
import { simulate, type Trace } from './simulate'

export interface SimRequest {
  id: number
  day: Day
  params?: Params
}
export interface SimResponse {
  id: number
  trace: Trace
}

const ctx = self as unknown as { onmessage: ((e: MessageEvent<SimRequest>) => void) | null; postMessage(m: SimResponse): void }

ctx.onmessage = (e) => {
  const { id, day, params } = e.data
  ctx.postMessage({ id, trace: simulate(day, params) })
}
