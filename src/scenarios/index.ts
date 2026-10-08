import { addBreaks, batchAlerts, clusterMeetings, compose, dropTask, quietWindow, writePlans, type Lever } from '../engine/levers'
import { DaySchema, type Block, type Day } from '../engine/schema'

/**
 * The scenario library (documentation section 06): ready-made days, each with
 * one lever to try and what the model should show. The `expect` lines are
 * checked in src/engine/__tests__/scenarios.test.ts.
 */
export interface Scenario {
  id: string
  who: string
  title: string
  story: string
  day: Day
  lever: { name: string; apply: Lever }
  expect: string
}

const W = (from: number, to: number, task: string, c: number): Block => ({ from, to, task, c, kind: 'work' })
const M = (from: number, to: number, task: string): Block => ({ from, to, task, c: 2, kind: 'meeting' })
const B = (from: number, to: number): Block => ({ from, to, task: 'break', c: 1, kind: 'break' })
const open = (...names: string[]) => names.map((name) => ({ name, planned: false }))
const day = (d: Omit<Day, 'quiet' | 'seed'> & Partial<Pick<Day, 'quiet' | 'seed'>>): Day => DaySchema.parse({ quiet: [], seed: 7, ...d })

/** The sample day used throughout the documentation: 09:00–17:00, three meetings, four tasks. */
export const SAMPLE: Scenario = {
  id: 'sample',
  who: 'Sample day',
  title: 'An ordinary Thursday',
  story: 'Three meetings, four tasks, alerts as they arrive, and a report due at five.',
  day: day({
    id: 'sample', title: 'An ordinary Thursday', startClock: 540, minutes: 480, alertsPerHour: 14, actOnAlerts: 0.35, batchAt: null,
    openTasks: open('Report', 'Code', 'Admin', 'Slides', 'Review notes', 'Budget thread'),
    deadlines: [{ task: 'Report', at: 480, workLeft: 150 }],
    blocks: [W(0, 50, 'Report', 4), M(50, 80, 'Stand-up'), W(80, 125, 'Code', 5), W(125, 140, 'Report', 4), W(140, 180, 'Admin', 1), B(180, 210), W(210, 270, 'Code', 5), M(270, 300, 'Design review'), W(300, 330, 'Report', 4), W(330, 380, 'Code', 5), M(380, 410, 'Team sync'), W(410, 480, 'Report', 4)],
  }),
  lever: { name: 'All three levers', apply: compose(clusterMeetings(), batchAlerts(120), writePlans) },
  expect: 'Mean load falls by at least a fifth and overloaded time almost disappears.',
}

export const SCENARIOS: Scenario[] = [
  {
    id: 's1', who: 'Student', title: 'Exam week',
    story: 'Four subjects in one day, phone face-up, group chats buzzing, a lab report due at midnight.',
    day: day({
      id: 's1', title: 'Exam week', startClock: 540, minutes: 720, alertsPerHour: 30, actOnAlerts: 0.4, batchAt: null,
      openTasks: open('Maths', 'Physics', 'Chemistry', 'English', 'Lab report'),
      deadlines: [{ task: 'Lab report', at: 899, workLeft: 150 }],
      blocks: [W(0, 90, 'Maths', 5), B(90, 105), W(105, 180, 'Physics', 4), W(180, 210, 'Chemistry', 4), B(210, 270), W(270, 360, 'Chemistry', 4), B(360, 375), W(375, 450, 'English', 3), B(450, 480), W(480, 600, 'Lab report', 4), B(600, 630), W(630, 720, 'Maths', 5)],
    }),
    lever: { name: 'Batch alerts hourly', apply: batchAlerts(60) },
    expect: 'Switching falls; deadline pressure does not rise.',
  },
  {
    id: 's2', who: 'Developer', title: 'The chopped-up maker',
    story: 'Four 30-minute meetings spread evenly, so there is never more than 70 minutes for hard work.',
    day: day({
      id: 's2', title: 'The chopped-up maker', startClock: 540, minutes: 480, alertsPerHour: 6, actOnAlerts: 0.3, batchAt: null,
      openTasks: open('Feature', 'Bug triage', 'Docs'),
      deadlines: [],
      blocks: [W(0, 60, 'Feature', 5), M(60, 90, 'Stand-up'), W(90, 160, 'Feature', 5), M(160, 190, 'Planning'), B(190, 230), W(230, 300, 'Feature', 5), M(300, 330, 'Design review'), W(330, 400, 'Bug triage', 3), M(400, 430, 'One-on-one'), W(430, 480, 'Docs', 2)],
    }),
    lever: { name: 'Cluster meetings, then take breaks', apply: compose(clusterMeetings(), addBreaks(50, 5)) },
    expect: 'Clustering cuts morning switches but makes one long hard block, so fatigue rises. Breaks win part of that back. Not every lever is a free win.',
  },
  {
    id: 's3', who: 'Engineer on call', title: 'Pager day',
    story: 'Alerts that mostly have to be handled, on top of a feature that still needs doing.',
    day: day({
      id: 's3', title: 'Pager day', startClock: 540, minutes: 480, alertsPerHour: 12, actOnAlerts: 0.8, batchAt: null,
      openTasks: open('Feature', 'Incident notes'),
      deadlines: [],
      blocks: [W(0, 180, 'Feature', 4), B(180, 220), W(220, 480, 'Feature', 4)],
    }),
    lever: { name: 'Hand the pager over 10:00–12:00', apply: quietWindow(60, 180) },
    expect: 'Load during the handed-over window is clearly lower.',
  },
  {
    id: 's4', who: 'Team member', title: 'The juggler',
    story: 'Nine open tasks across three group projects, none finished today, each touched briefly.',
    day: day({
      id: 's4', title: 'The juggler', startClock: 540, minutes: 420, alertsPerHour: 8, actOnAlerts: 0.3, batchAt: null,
      openTasks: open('Survey', 'Slides', 'Poster', 'Budget', 'Minutes', 'Prototype', 'Interviews', 'Lit review', 'Report'),
      deadlines: [],
      blocks: [W(0, 40, 'Survey', 3), W(40, 70, 'Slides', 3), W(70, 110, 'Prototype', 4), W(110, 140, 'Budget', 2), B(140, 180), W(180, 220, 'Interviews', 3), W(220, 260, 'Poster', 3), W(260, 300, 'Lit review', 4), W(300, 340, 'Report', 4), W(340, 380, 'Minutes', 2), W(380, 420, 'Survey', 3)],
    }),
    lever: { name: 'Write a next step for every task', apply: writePlans },
    expect: 'Open-loop load halves; switching is exactly unchanged.',
  },
  {
    id: 's5', who: 'Researcher', title: 'The marathon',
    story: 'One hard task for five hours straight, few alerts, no breaks.',
    day: day({
      id: 's5', title: 'The marathon', startClock: 540, minutes: 360, alertsPerHour: 2, actOnAlerts: 0.2, batchAt: null,
      openTasks: open('Analysis'),
      deadlines: [],
      blocks: [W(0, 300, 'Analysis', 4), B(300, 360)],
    }),
    lever: { name: '5 minutes off every 50', apply: addBreaks(50, 5) },
    expect: 'Fatigue stays lower through the afternoon, for about 25 minutes of lost work.',
  },
  {
    id: 's6', who: 'Freelancer', title: 'Deadline crunch',
    story: 'Three client projects, two due this evening, more work left than hours in the day.',
    day: day({
      id: 's6', title: 'Deadline crunch', startClock: 540, minutes: 600, alertsPerHour: 10, actOnAlerts: 0.4, batchAt: null,
      openTasks: open('Client A', 'Client B', 'Client C'),
      deadlines: [{ task: 'Client A', at: 540, workLeft: 240 }, { task: 'Client B', at: 660, workLeft: 260 }, { task: 'Client C', at: 600, workLeft: 200 }],
      blocks: [W(0, 120, 'Client A', 4), W(120, 200, 'Client C', 4), B(200, 230), W(230, 330, 'Client B', 4), W(330, 420, 'Client A', 4), B(420, 440), W(440, 520, 'Client C', 4), W(520, 600, 'Client B', 4)],
    }),
    lever: { name: 'Renegotiate Client C; its hours go to Client A', apply: dropTask('Client C', 'Client A') },
    expect: 'Deadline pressure and open loops both fall.',
  },
]
