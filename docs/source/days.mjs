// Sample days used in the documentation figures. Minute 0 = 09:00, 480 = 17:00.
const W = (from, to, task, c) => ({ from, to, task, c, kind: 'work' })
const M = (from, to, task) => ({ from, to, task, c: 2, kind: 'meeting' })
const B = (from, to) => ({ from, to, task: 'break', c: 0, kind: 'break' })
export const baseline = {
  minutes: 480, alertsPerHour: 14, batchAt: null, openLoops: 6, planned: false,
  deadlines: [{ at: 480, workLeft: 110 }],
  blocks: [W(0, 50, 'report', 4), M(50, 80, 'standup'), W(80, 125, 'code', 5), W(125, 140, 'report', 4), W(140, 180, 'admin', 1),
    B(180, 210), W(210, 270, 'code', 5), M(270, 300, 'review'), W(300, 330, 'report', 4), W(330, 380, 'code', 5), M(380, 410, 'sync'), W(410, 480, 'report', 4)],
}
export const batched = { ...baseline, batchAt: [120, 240, 360, 479] }
export const planned = { ...baseline, planned: true }
export const clustered = { ...baseline, blocks: [W(0, 110, 'code', 5), B(110, 120), W(120, 180, 'report', 4), B(180, 210), M(210, 240, 'standup'), M(240, 270, 'review'), M(270, 300, 'sync'), W(300, 340, 'admin', 1), W(340, 470, 'report', 4), B(470, 480)] }
export const combined = { ...clustered, batchAt: [120, 240, 360, 479], planned: true }
