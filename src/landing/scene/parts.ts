/**
 * Building blocks for the landing-page world, in the portfolio's look: flat
 * cel-shaded colours with ink outlines (added by OutlineEffect in World),
 * the crew as 3D trading cards and standees, pill labels with hard shadows.
 */
import * as THREE from 'three'
import type { Driver } from '../../engine/params'
import { CREW, drawCard, drawCharacter, drawPattern } from '../../characters/characters'

export const C = {
  paper: 0xf3e9d6,
  floor: 0xebdcc2,
  ink: 0x1b1b1b,
  cream: 0xfdf6ea,
  blue: 0x2f6b6b, // teal
  blueDeep: 0x22504f,
  red: 0xd81e2c,
  redDeep: 0xa3121c,
  yellow: 0xf2b632, // mustard
  yellowDeep: 0xd39616,
  pink: 0xee8fa8,
  pinkDeep: 0xd96d8a,
  purple: 0xf37a1f, // orange
  purpleDeep: 0xc95e0f,
  green: 0x8fa37a, // sage
  greenDeep: 0x6f8360,
} as const

export const DRIVER_HEX: Record<Driver, number> = { complexity: C.blue, switching: C.red, alerts: C.yellow, openLoops: C.pink, deadline: C.purple, fatigue: C.green }

/** Teal shades for task tiles, light (c1) to deep (c5). */
export const TEAL_SHADES = [0xb9d0cb, 0x8db3ad, 0x5e9a96, 0x3f817f, 0x2f6b6b]

let toonRamp: THREE.DataTexture | null = null
function ramp() {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
    toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter
    toonRamp.needsUpdate = true
  }
  return toonRamp
}

type MatOpts = { side?: THREE.Side; transparent?: boolean; opacity?: number; emissive?: number; emissiveIntensity?: number; roughness?: number; clearcoat?: number; clearcoatRoughness?: number }

/** Flat, three-step toon shading: reads like the flat illustrations. Extra physical-material options are ignored. */
export const mat = (color: number, o: MatOpts = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: ramp(), side: o.side, transparent: o.transparent, opacity: o.opacity ?? 1, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 0 })

export const makeOrb = (color: number, r: number) => new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), mat(color))

let blob: THREE.Texture | null = null
/** A soft round shadow to lay under floating things. */
export function shadow(radius: number, opacity = 0.2) {
  if (!blob) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(60,40,20,1)')
    g.addColorStop(0.55, 'rgba(60,40,20,.4)')
    g.addColorStop(1, 'rgba(60,40,20,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
    blob = new THREE.CanvasTexture(c)
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, opacity, depthWrite: false }))
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.02
  return m
}

function roundedShape(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

/** A rounded slab (a task tile). */
export function roundedSlab(w: number, h: number, depth: number, radius: number, material: THREE.Material) {
  const geo = new THREE.ExtrudeGeometry(roundedShape(w, h, radius), { depth, bevelEnabled: true, bevelThickness: Math.min(0.12, depth / 3), bevelSize: Math.min(0.12, radius / 2), bevelSegments: 3, curveSegments: 8 })
  geo.translate(0, 0, -depth / 2)
  return new THREE.Mesh(geo, material)
}

function canvasTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const noOutline = (m: THREE.Material) => {
  m.userData.outlineParameters = { visible: false }
  return m
}

/**
 * A crew trading card: patterned front with the mascot, a back with the
 * pattern and the wordmark, an ink edge, and a hard offset shadow plate,
 * like the portfolio's tilted mascot tiles. 3.6 × 5 units.
 */
export function crewCard(kind: Driver, mood = 0.12) {
  const W = 3.6
  const H = 5
  const g = new THREE.Group()
  const front = document.createElement('canvas')
  front.width = 360
  front.height = 500
  drawCard(front.getContext('2d')!, kind, 360, 500, { mood })
  const back = document.createElement('canvas')
  back.width = 360
  back.height = 500
  const bx = back.getContext('2d')!
  drawPattern(bx, 360, 500, CREW[kind].card)
  bx.fillStyle = '#fdf6ea'
  bx.beginPath()
  bx.roundRect(40, 205, 280, 90, 45)
  bx.fill()
  bx.fillStyle = '#d81e2c'
  bx.font = '900 54px "Big Shoulders Display", Impact, sans-serif'
  bx.textAlign = 'center'
  bx.textBaseline = 'middle'
  bx.fillText('COGNITIVEOS', 180, 252)
  const edge = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedShape(W + 0.16, H + 0.16, 0.22), { depth: 0.1, bevelEnabled: false, curveSegments: 6 }), noOutline(new THREE.MeshBasicMaterial({ color: C.ink })))
  edge.position.z = -0.05
  const f = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(W, H, 0.16)), noOutline(new THREE.MeshBasicMaterial({ map: canvasTexture(front) })))
  f.position.z = 0.056
  remapUV(f.geometry, W, H)
  const b = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(W, H, 0.16)), noOutline(new THREE.MeshBasicMaterial({ map: canvasTexture(back) })))
  b.position.z = -0.056
  b.rotation.y = Math.PI
  remapUV(b.geometry, W, H)
  // the hard shadow, offset down-right like box-shadow: 10px 10px 0 ink
  const plate = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(W + 0.16, H + 0.16, 0.22)), noOutline(new THREE.MeshBasicMaterial({ color: C.ink, transparent: true, opacity: 0.9 })))
  plate.position.set(0.32, -0.32, -0.12)
  g.add(plate, edge, f, b)
  g.userData.plate = plate
  return g
}

/** ShapeGeometry UVs are in shape units; map them to 0–1 across the card. */
function remapUV(geo: THREE.BufferGeometry, w: number, h: number) {
  const pos = geo.attributes.position!
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5
    uv[i * 2 + 1] = pos.getY(i) / h + 0.5
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/** A crew member as a camera-facing standee (a sprite drawn from the 2D mascot). */
export function standee(kind: Driver, height: number, mood = 0.12) {
  const c = document.createElement('canvas')
  c.width = 220
  c.height = 240
  drawCharacter(c.getContext('2d')!, kind, 110, 228, 200, { mood })
  const s = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: canvasTexture(c), transparent: true, depthWrite: true, alphaTest: 0.4 })) as THREE.SpriteMaterial)
  s.scale.set(height * (220 / 240), height, 1)
  s.center.set(0.5, 12 / 240)
  return s
}

function roundRect(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, r: number) {
  x.beginPath()
  x.roundRect(px, py, w, h, r)
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`

/** A pill label like the portfolio's: coloured fill, ink border, hard shadow. bg null = plain ink text. */
export function label(text: string, o: { size?: number; color?: number; bg?: number | null; font?: string } = {}) {
  const size = o.size ?? 1
  const c = document.createElement('canvas')
  const x = c.getContext('2d')!
  const font = o.font ?? '700 52px "DM Sans", sans-serif'
  x.font = font
  const pad = o.bg === null ? 8 : 40
  const w = Math.ceil(x.measureText(text).width) + pad * 2 + 10
  c.width = w
  c.height = 120
  x.font = font
  if (o.bg !== null) {
    x.fillStyle = css(C.ink)
    roundRect(x, 10, 16, w - 14, 96, 48)
    x.fill()
    x.fillStyle = css(o.bg ?? C.cream)
    roundRect(x, 3, 6, w - 14, 96, 48)
    x.fill()
    x.lineWidth = 5
    x.strokeStyle = css(C.ink)
    x.stroke()
  }
  const light = o.bg !== null && [C.ink, C.red, C.blue, C.redDeep, C.blueDeep].includes((o.bg ?? C.cream) as never)
  x.fillStyle = css(o.color ?? (light ? C.cream : C.ink))
  x.textBaseline = 'middle'
  x.fillText(text, pad, 56)
  const s = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false, toneMapped: false })) as THREE.SpriteMaterial)
  s.scale.set((w / 120) * size, size, 1)
  return s
}

/** A parameter card for the Model Card carousel: cream, ink border, coloured header strip. */
export function paramCard(o: { name: string; value: string; unit: string; source: string; standIn: boolean; color: number }) {
  const c = document.createElement('canvas')
  c.width = 560
  c.height = 360
  const x = c.getContext('2d')!
  x.fillStyle = '#fdf6ea'
  roundRect(x, 4, 4, 552, 352, 18)
  x.fill()
  x.fillStyle = css(o.color)
  x.fillRect(4, 4, 552, 30)
  x.lineWidth = 8
  x.strokeStyle = '#1b1b1b'
  roundRect(x, 4, 4, 552, 352, 18)
  x.stroke()
  x.fillStyle = '#1b1b1b'
  x.font = '900 44px "Big Shoulders Display", sans-serif'
  x.fillText(o.name.toUpperCase(), 32, 94)
  x.fillStyle = '#d81e2c'
  x.font = '900 104px "Big Shoulders Display", sans-serif'
  x.fillText(o.value, 32, 204)
  const vw = x.measureText(o.value).width
  x.font = '700 26px "DM Sans", sans-serif'
  x.fillStyle = '#4b4339'
  x.fillText(o.unit, 46 + vw, 204)
  x.fillStyle = '#2f6b6b'
  x.font = '700 26px "DM Sans", sans-serif'
  x.fillText(o.source, 32, 262)
  if (o.standIn) {
    x.fillStyle = '#f2b632'
    roundRect(x, 32, 288, 170, 46, 23)
    x.fill()
    x.lineWidth = 4
    x.stroke()
    x.fillStyle = '#1b1b1b'
    x.font = '700 22px "DM Sans", sans-serif'
    x.fillText('stand-in', 70, 318)
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.6), noOutline(new THREE.MeshBasicMaterial({ map: canvasTexture(c), transparent: true, side: THREE.DoubleSide, toneMapped: false })))
}

/** Paper floor with a faint dot grid. */
export function paperTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  x.fillStyle = css(C.floor)
  x.fillRect(0, 0, 64, 64)
  x.fillStyle = 'rgba(27,27,27,.09)'
  x.beginPath()
  x.arc(32, 32, 2.2, 0, Math.PI * 2)
  x.fill()
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(400, 400)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
