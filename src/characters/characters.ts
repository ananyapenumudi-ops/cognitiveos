/**
 * The crew: one original mascot per load driver, drawn in code so the crowd,
 * the 3D cards and the app can all animate them. Same flat style as the
 * portfolio mascots: simple shapes, dot eyes, pink cheeks, no outlines.
 *
 *   Brainy (complexity) · Flip (switching) · Ping (notifications)
 *   Loopy (open loops) · Tick (deadline pressure) · Yawn (fatigue)
 *
 * A mood from 0 (calm) to 1 (frazzled) changes brows, mouth and sweat;
 * a walk phase swings the feet.
 */
import type { Driver } from '../engine/params'

export const INK = '#1b1b1b'
export const CREAM = '#fdf6ea'
const CHEEK = '#f6b3c6'

export interface CrewMember {
  name: string
  color: string
  shade: string
  /** card background: two colours and a pattern */
  card: [string, string, 'stripes' | 'checks' | 'waves' | 'dots' | 'diagonal' | 'grid']
  line: string
}

export const CREW: Record<Driver, CrewMember> = {
  complexity: { name: 'Brainy', color: '#2f6b6b', shade: '#22504f', card: ['#cdd8b8', '#e3ead6', 'grid'], line: 'Holds the hard stuff in mind' },
  switching: { name: 'Flip', color: '#d81e2c', shade: '#a3121c', card: ['#f4a9bb', '#f7d3db', 'checks'], line: 'Never quite left the last task' },
  alerts: { name: 'Ping', color: '#f2b632', shade: '#d39616', card: ['#f37a1f', '#f8a24a', 'stripes'], line: 'Rings even when you ignore it' },
  openLoops: { name: 'Loopy', color: '#ee8fa8', shade: '#d96d8a', card: ['#2f6b6b', '#3d7f7e', 'dots'], line: 'Remembers everything unfinished' },
  deadline: { name: 'Tick', color: '#f37a1f', shade: '#c95e0f', card: ['#f2b632', '#f6cd6e', 'waves'], line: 'Counts the minutes left' },
  fatigue: { name: 'Yawn', color: '#8fa37a', shade: '#6f8360', card: ['#d81e2c', '#e8505b', 'diagonal'], line: 'Gets heavier every hour' },
}

export interface Pose {
  /** 0 = calm … 1 = frazzled */
  mood?: number
  /** walk phase, any real number; feet swing with sin(2π·step) */
  step?: number
  /** blink: 0 = open, 1 = closed */
  blink?: number
}

const TAU = Math.PI * 2

function fill(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color
  ctx.fill()
}

function feet(ctx: CanvasRenderingContext2D, step: number, color: string) {
  const s = Math.sin(step * TAU) * 5
  for (const [x, lift] of [[-14, s], [14, -s]] as const) {
    ctx.beginPath()
    ctx.ellipse(x + lift * 0.6, -5 - Math.max(0, lift) * 0.8, 10, 5.5, 0, 0, TAU)
    fill(ctx, color)
  }
}

/** Dot eyes, cheeks, brows (only when stressed) and mouth, centred at (0, y). */
function face(ctx: CanvasRenderingContext2D, y: number, mood: number, blink: number, o: { gap?: number; lid?: number; ink?: string } = {}) {
  const gap = o.gap ?? 12
  const ink = o.ink ?? INK
  const lid = Math.max(blink, o.lid ?? 0)
  for (const side of [-1, 1]) {
    const ex = side * gap
    ctx.beginPath()
    if (lid > 0.85) {
      // closed: a little arc
      ctx.arc(ex, y - 1, 4.5, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.lineWidth = 2.6
      ctx.strokeStyle = ink
      ctx.lineCap = 'round'
      ctx.stroke()
    } else {
      ctx.ellipse(ex, y + lid * 3, 4.4, 6 * (1 - lid * 0.6), 0, 0, TAU)
      fill(ctx, ink)
      ctx.beginPath()
      ctx.arc(ex + 1.6, y - 2 + lid * 3, 1.6, 0, TAU)
      fill(ctx, '#fff')
    }
    ctx.beginPath()
    ctx.arc(ex + side * 7, y + 9, 5.5, 0, TAU)
    ctx.globalAlpha = 0.85
    fill(ctx, CHEEK)
    ctx.globalAlpha = 1
    if (mood > 0.4) {
      ctx.beginPath()
      const k = (mood - 0.4) / 0.6
      ctx.moveTo(ex + side * 6, y - 10)
      ctx.lineTo(ex - side * 5, y - 10 - k * 4)
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.strokeStyle = ink
      ctx.stroke()
    }
  }
  const my = y + 12
  ctx.beginPath()
  if (mood < 0.35) {
    ctx.moveTo(-5, my - 1)
    ctx.quadraticCurveTo(0, my + 5 - mood * 8, 5, my - 1)
  } else if (mood < 0.7) {
    ctx.moveTo(-4.5, my + 1)
    ctx.lineTo(4.5, my + 1)
  } else {
    ctx.moveTo(-6, my + 2)
    for (let i = 1; i <= 4; i++) ctx.lineTo(-6 + i * 3, my + 2 + (i % 2 ? -2 : 2))
  }
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  ctx.strokeStyle = ink
  ctx.stroke()
  if (mood > 0.72) {
    ctx.beginPath()
    ctx.moveTo(gap + 13, y - 12)
    ctx.quadraticCurveTo(gap + 18, y - 3, gap + 13, y - 1)
    ctx.quadraticCurveTo(gap + 8, y - 3, gap + 13, y - 12)
    fill(ctx, '#8ecae6')
  }
}

/**
 * Draw a crew member standing on (x, y), `size` pixels tall.
 * `facing` -1 mirrors it (for walking left); text is never mirrored.
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, kind: Driver, x: number, y: number, size: number, pose: Pose = {}, facing: 1 | -1 = 1) {
  const mood = Math.min(1, Math.max(0, pose.mood ?? 0.15))
  const step = pose.step ?? 0
  const blink = pose.blink ?? 0
  const c = CREW[kind]
  const bob = Math.abs(Math.sin(step * TAU)) * 2.5
  const text = (str: string, tx: number, ty: number, font: string, color: string) => {
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(facing, 1)
    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(str, 0, 0)
    ctx.restore()
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.scale((size / 110) * facing, size / 110)
  ctx.lineJoin = 'round'
  feet(ctx, step, c.shade)
  ctx.translate(0, -bob)

  switch (kind) {
    case 'complexity': {
      // Brainy: a teal block with a cream screen face and an idea lattice on top
      ctx.lineWidth = 3
      ctx.strokeStyle = c.shade
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, -86)
      ctx.lineTo(0, -98)
      ctx.moveTo(-12, -104)
      ctx.lineTo(0, -98)
      ctx.lineTo(13, -106)
      ctx.stroke()
      for (const [nx, ny, col] of [[-12, -104, '#f2b632'], [0, -98, '#ee8fa8'], [13, -106, '#f37a1f']] as const) {
        ctx.beginPath()
        ctx.arc(nx, ny, 4.5, 0, TAU)
        fill(ctx, col)
      }
      ctx.beginPath()
      ctx.roundRect(-36, -88, 72, 80, 20)
      fill(ctx, c.color)
      ctx.beginPath()
      ctx.roundRect(-25, -76, 50, 42, 12)
      fill(ctx, CREAM)
      face(ctx, -58, mood, blink, { gap: 11 })
      // round glasses, thin
      ctx.lineWidth = 2
      ctx.strokeStyle = INK
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(side * 11, -58, 8.5, 0, TAU)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(-2.5, -59)
      ctx.lineTo(2.5, -59)
      ctx.stroke()
      ctx.beginPath()
      ctx.roundRect(-16, -26, 32, 7, 3.5)
      fill(ctx, c.shade)
      break
    }
    case 'switching': {
      // Flip: two tabs, the back one still half-attended
      ctx.beginPath()
      ctx.roundRect(-40, -94, 54, 64, 14)
      fill(ctx, '#f0606b')
      ctx.beginPath()
      ctx.roundRect(-34, -86, 22, 5, 2.5)
      fill(ctx, c.shade)
      ctx.beginPath()
      ctx.roundRect(-24, -82, 62, 74, 16)
      fill(ctx, c.color)
      ctx.beginPath()
      ctx.roundRect(-14, -70, 42, 36, 11)
      fill(ctx, CREAM)
      ctx.save()
      ctx.translate(7, 0)
      face(ctx, -54, mood, blink, { gap: 9 })
      ctx.restore()
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.strokeStyle = c.shade
      for (const dy of [-66, -54]) {
        ctx.beginPath()
        ctx.moveTo(45, dy)
        ctx.lineTo(55, dy - 3)
        ctx.stroke()
      }
      break
    }
    case 'alerts': {
      // Ping: a mustard bell with a badge
      ctx.beginPath()
      ctx.arc(0, -11, 7, 0, TAU)
      fill(ctx, c.shade)
      ctx.beginPath()
      ctx.moveTo(-32, -18)
      ctx.bezierCurveTo(-32, -62, -26, -92, 0, -92)
      ctx.bezierCurveTo(26, -92, 32, -62, 32, -18)
      ctx.lineTo(40, -12)
      ctx.lineTo(-40, -12)
      ctx.closePath()
      fill(ctx, c.color)
      ctx.beginPath()
      ctx.roundRect(-40, -20, 80, 8, 4)
      fill(ctx, c.shade)
      ctx.beginPath()
      ctx.arc(0, -96, 5, 0, TAU)
      fill(ctx, c.shade)
      ctx.beginPath()
      ctx.arc(26, -82, 11, 0, TAU)
      fill(ctx, '#d81e2c')
      text(mood > 0.5 ? '9+' : '3', 26, -81.5, '900 13px "Big Shoulders Display", sans-serif', CREAM)
      face(ctx, -52, mood, blink, { gap: 11 })
      break
    }
    case 'openLoops': {
      // Loopy: a pink ring with a gap, cream face in the middle
      const cy = -54
      ctx.beginPath()
      ctx.arc(0, cy, 27, 0, TAU)
      fill(ctx, CREAM)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(0, cy, 37, -Math.PI / 2 + 0.5, -Math.PI / 2 - 0.5 + TAU)
      ctx.lineWidth = 20
      ctx.strokeStyle = c.color
      ctx.stroke()
      face(ctx, -56, mood, blink, { gap: 10 })
      break
    }
    case 'deadline': {
      // Tick: an orange alarm clock with a cream face
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(side * 24, -92, 11, Math.PI, 0)
        ctx.closePath()
        fill(ctx, c.shade)
      }
      ctx.beginPath()
      ctx.arc(0, -52, 40, 0, TAU)
      fill(ctx, c.color)
      ctx.beginPath()
      ctx.arc(0, -52, 31, 0, TAU)
      fill(ctx, CREAM)
      ctx.lineWidth = 2.5
      ctx.strokeStyle = c.shade
      ctx.lineCap = 'round'
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU
        ctx.beginPath()
        ctx.moveTo(Math.sin(a) * 28, -52 - Math.cos(a) * 28)
        ctx.lineTo(Math.sin(a) * (i % 3 ? 25.5 : 23), -52 - Math.cos(a) * (i % 3 ? 25.5 : 23))
        ctx.stroke()
      }
      // the hand creeps towards twelve as stress rises
      ctx.lineWidth = 3
      ctx.strokeStyle = '#d81e2c'
      ctx.beginPath()
      ctx.moveTo(0, -72)
      ctx.lineTo(Math.sin(-1.2 + mood * 1.1) * 7, -72 - Math.cos(-1.2 + mood * 1.1) * 7)
      ctx.stroke()
      face(ctx, -48, mood, blink, { gap: 11 })
      break
    }
    case 'fatigue': {
      // Yawn: a soft sage pear in a nightcap, lids heavy
      ctx.beginPath()
      ctx.moveTo(-40, -12)
      ctx.bezierCurveTo(-46, -50, -28, -84, 0, -84)
      ctx.bezierCurveTo(28, -84, 46, -50, 40, -12)
      ctx.closePath()
      fill(ctx, c.color)
      ctx.beginPath()
      ctx.moveTo(-28, -77)
      ctx.quadraticCurveTo(4, -110, 42, -96)
      ctx.quadraticCurveTo(22, -88, 28, -75)
      ctx.quadraticCurveTo(0, -84, -28, -77)
      fill(ctx, '#2f6b6b')
      ctx.beginPath()
      ctx.arc(43, -96, 6.5, 0, TAU)
      fill(ctx, CREAM)
      face(ctx, -48, mood, blink, { gap: 12, lid: 0.35 + mood * 0.4 })
      text('z', 42, -64, '900 15px "Big Shoulders Display", sans-serif', c.shade)
      text('z', 52, -76, '900 11px "Big Shoulders Display", sans-serif', c.shade)
      break
    }
  }
  ctx.restore()
}

/** Fill a rectangle with one of the card patterns. */
export function drawPattern(ctx: CanvasRenderingContext2D, w: number, h: number, [a, b, kind]: CrewMember['card']) {
  ctx.fillStyle = a
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = b
  const u = Math.max(w, h) / 12
  if (kind === 'stripes') for (let x = 0; x < w; x += u * 2) ctx.fillRect(x, 0, u, h)
  else if (kind === 'checks') for (let y = 0; y < h; y += u) for (let x = (Math.round(y / u) % 2) * u; x < w; x += u * 2) ctx.fillRect(x, y, u, u)
  else if (kind === 'dots') for (let y = u / 2; y < h; y += u) for (let x = (Math.round(y / u) % 2 ? u : u / 2); x < w; x += u) {
    ctx.beginPath()
    ctx.arc(x, y, u * 0.22, 0, TAU)
    ctx.fill()
  }
  else if (kind === 'waves') {
    ctx.lineWidth = u * 0.55
    ctx.strokeStyle = b
    for (let x = -u; x < w + u; x += u * 1.6) {
      ctx.beginPath()
      for (let y = 0; y <= h; y += 4) ctx.lineTo(x + Math.sin(y / (u * 0.9)) * u * 0.35, y)
      ctx.stroke()
    }
  } else if (kind === 'diagonal') {
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(-Math.PI / 4)
    const r = Math.hypot(w, h)
    for (let x = -r; x < r; x += u * 1.6) ctx.fillRect(x, -r, u * 0.7, r * 2)
    ctx.restore()
  } else {
    for (let x = 0; x < w; x += u * 1.4) ctx.fillRect(x, 0, 2, h)
    for (let y = 0; y < h; y += u * 1.4) ctx.fillRect(0, y, w, 2)
  }
}

/**
 * A trading card, like the portfolio's mascot tiles: patterned background,
 * the character, its name, and a little grain. Drawn into a w×h canvas area.
 */
export function drawCard(ctx: CanvasRenderingContext2D, kind: Driver, w: number, h: number, pose: Pose = {}) {
  const c = CREW[kind]
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, w * 0.04)
  ctx.clip()
  drawPattern(ctx, w, h, c.card)
  ctx.fillStyle = ['complexity', 'switching', 'deadline'].includes(kind) ? INK : CREAM
  ctx.font = `900 ${Math.round(w * 0.19)}px "Big Shoulders Display", Impact, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(c.name.toUpperCase(), w / 2, h * 0.07)
  drawCharacter(ctx, kind, w / 2, h * 0.93, h * 0.62, pose)
  // grain
  ctx.globalAlpha = 0.06
  for (let i = 0; i < (w * h) / 60; i++) {
    ctx.fillStyle = i % 2 ? '#000' : '#fff'
    ctx.fillRect(((i * 7919) % w) + ((i * 13) % 3), ((i * 104729) % h) + ((i * 17) % 5), 1.5, 1.5)
  }
  ctx.restore()
}
