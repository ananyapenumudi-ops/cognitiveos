import { z } from 'zod'

/**
 * The day file format. Minutes are counted from the start of the simulated
 * window (minute 0 = `startClock`), so a day is independent of the calendar.
 */
export const BlockSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(1),
  task: z.string().min(1),
  kind: z.enum(['work', 'meeting', 'break']),
  /** Complexity 1 (sorting email) … 5 (debugging a race condition). Ignored for breaks. */
  c: z.number().int().min(1).max(5),
})

export const DaySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    /** Clock time of minute 0, in minutes after midnight (540 = 09:00). */
    startClock: z.number().int().min(0).max(1439),
    minutes: z.number().int().min(1).max(1440),
    blocks: z.array(BlockSchema),
    alertsPerHour: z.number().min(0).max(120),
    /** Share of delivered alerts you stop and deal with. */
    actOnAlerts: z.number().min(0).max(1),
    /** Batch delivery times; alerts wait for the next one. null = deliver as they arrive. */
    batchAt: z.array(z.number().int().min(0)).nullable(),
    /** Windows where alerts are held and delivered together at the end (e.g. pager handed over). */
    quiet: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])),
    openTasks: z.array(z.object({ name: z.string().min(1), planned: z.boolean() })),
    /** `workLeft` is minutes of work on `task` still needed at minute 0. `at` may lie beyond the window. */
    deadlines: z.array(z.object({ task: z.string().min(1), at: z.number().int(), workLeft: z.number().min(0) })),
    seed: z.number().int(),
  })
  .superRefine((day, ctx) => {
    const sorted = [...day.blocks].sort((a, b) => a.from - b.from)
    sorted.forEach((b, i) => {
      if (b.to <= b.from) ctx.addIssue({ code: 'custom', message: `block "${b.task}" at ${b.from} ends before it starts` })
      if (b.to > day.minutes) ctx.addIssue({ code: 'custom', message: `block "${b.task}" runs past the end of the day` })
      const next = sorted[i + 1]
      if (next && next.from < b.to) ctx.addIssue({ code: 'custom', message: `blocks "${b.task}" and "${next.task}" overlap at minute ${next.from}` })
    })
  })

export type Block = z.infer<typeof BlockSchema>
export type Day = z.infer<typeof DaySchema>

export function clock(day: Pick<Day, 'startClock'>, minute: number): string {
  const m = (((day.startClock + minute) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
