/**
 * Building blocks for the landing-page world: the profile head from the
 * documentation cover (extruded into a vinyl-toy solid), glossy thought orbs,
 * rounded tiles, text sprites and soft blob shadows.
 */
import * as THREE from 'three'

export const C = {
  paper: 0xf3e6d2,
  floor: 0xeedcc2,
  ink: 0x1c2240,
  blue: 0x2f5bd3,
  blueDeep: 0x1f3f9e,
  red: 0xe5452f,
  redDeep: 0xb8321f,
  yellow: 0xf2b233,
  yellowDeep: 0xd9951a,
  pink: 0xe0569b,
  pinkDeep: 0xb83c79,
  purple: 0x7b4fc9,
  purpleDeep: 0x5a33a3,
  green: 0x2fa37a,
  greenDeep: 0x1f7c5a,
  cream: 0xfffaf2,
} as const

export const DRIVER_HEX = { complexity: C.blue, switching: C.red, alerts: C.yellow, openLoops: C.pink, deadline: C.purple, fatigue: C.green } as const

/** Soft matte plastic. */
export const mat = (color: number, o: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.5, ...o })

/** Glossy memory-orb glass, after the Inside Out memory spheres. */
export const orbMat = (color: number) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: color, emissiveIntensity: 0.28, sheen: 0.4 })

// ── the profile head (same path as the documentation cover, SVG units, y down) ──
const HEAD = 'M18 130 C19 116 16 104 11 92 C3 72 4 44 20 26 C34 9 62 4 80 16 C92 24 96 38 95 50 C95 54 97 57 99 61 L106 73 C107 76 105 78 101 78 L101 82 C103 83 103 86 100 87 C102 89 101 92 98 93 C98 99 95 103 88 104 C83 104 80 106 80 110 L82 130 Z'
const HAIR = 'M11 92 C3 72 4 44 20 26 C34 9 62 4 80 16 C88 21 93 28 95 37 C82 29 64 31 55 45 C48 58 46 72 32 86 C26 92 18 95 11 92 Z'

/** Parse absolute M/L/C/Z path data into a THREE.Shape, centred, y up, 1 unit = 10 SVG units. */
function shapeFromPath(d: string): THREE.Shape {
  const s = new THREE.Shape()
  const tok = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? []
  const X = (v: string) => (Number(v) - 55) / 10
  const Y = (v: string) => (65 - Number(v)) / 10
  let i = 0
  const n = () => tok[i++] ?? '0'
  while (i < tok.length) {
    const cmd = n()
    if (cmd === 'M') s.moveTo(X(n()), Y(n()))
    else if (cmd === 'L') s.lineTo(X(n()), Y(n()))
    else if (cmd === 'C') {
      const [a, b, c, e, f, g] = [n(), n(), n(), n(), n(), n()]
      s.bezierCurveTo(X(a), Y(b), X(c), Y(e), X(f), Y(g))
    } else if (cmd === 'Z') s.closePath()
  }
  return s
}

let headGeo: THREE.ExtrudeGeometry | null = null
let hairGeo: THREE.ExtrudeGeometry | null = null

/** A head in profile, facing +x, about 10 × 13 units, 2.4 deep, centred on its own origin. */
export function makeHead(face: number, hair: number, opts: { eye?: boolean } = {}) {
  headGeo ??= new THREE.ExtrudeGeometry(shapeFromPath(HEAD), { depth: 2.4, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.35, bevelSegments: 6, curveSegments: 28 })
  hairGeo ??= new THREE.ExtrudeGeometry(shapeFromPath(HAIR), { depth: 2.4, bevelEnabled: true, bevelThickness: 0.62, bevelSize: 0.3, bevelSegments: 6, curveSegments: 28 })
  const g = new THREE.Group()
  const head = new THREE.Mesh(headGeo, mat(face))
  const hairMesh = new THREE.Mesh(hairGeo, mat(hair, { roughness: 0.7 }))
  hairMesh.scale.set(1.012, 1.012, 1.08)
  hairMesh.position.z = -0.1
  g.add(head, hairMesh)
  if (opts.eye !== false) {
    // closed eye, like the poster: a small dark arc on both faces
    for (const z of [3.0, -0.6]) {
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.5 }))
      eye.position.set(2.9, 0.7, z)
      eye.rotation.z = Math.PI
      g.add(eye)
    }
  }
  // centre the depth on z = 0
  g.children.forEach((c) => (c.position.z -= 1.2))
  return g
}

let blob: THREE.Texture | null = null
/** A soft round shadow to lay under floating things (cheaper and softer than shadow maps). */
export function shadow(radius: number, opacity = 0.22) {
  if (!blob) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(70,45,20,1)')
    g.addColorStop(0.5, 'rgba(70,45,20,.45)')
    g.addColorStop(1, 'rgba(70,45,20,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
    blob = new THREE.CanvasTexture(c)
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, opacity, depthWrite: false }))
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.02
  return m
}

/** A glossy orb with a soft shadow under it. Returns the group and the sphere. */
export function makeOrb(color: number, r: number) {
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), orbMat(color))
  return sphere
}

/** A rounded slab (a task tile, a card). */
export function roundedSlab(w: number, h: number, depth: number, radius: number, material: THREE.Material) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + radius, y)
  s.lineTo(x + w - radius, y)
  s.quadraticCurveTo(x + w, y, x + w, y + radius)
  s.lineTo(x + w, y + h - radius)
  s.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  s.lineTo(x + radius, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - radius)
  s.lineTo(x, y + radius)
  s.quadraticCurveTo(x, y, x + radius, y)
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: Math.min(0.12, depth / 3), bevelSize: Math.min(0.12, radius / 2), bevelSegments: 4, curveSegments: 10 })
  geo.translate(0, 0, -depth / 2)
  return new THREE.Mesh(geo, material)
}

function roundRect(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, r: number) {
  x.beginPath()
  x.moveTo(px + r, py)
  x.arcTo(px + w, py, px + w, py + h, r)
  x.arcTo(px + w, py + h, px, py + h, r)
  x.arcTo(px, py + h, px, py, r)
  x.arcTo(px, py, px + w, py, r)
  x.closePath()
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`

/** A text sprite: a pill label like the documentation's black pills. */
export function label(text: string, o: { size?: number; color?: number; bg?: number | null; font?: string } = {}) {
  const size = o.size ?? 1
  const c = document.createElement('canvas')
  const x = c.getContext('2d')!
  const font = o.font ?? '500 54px "DM Mono", monospace'
  x.font = font
  const pad = o.bg === null ? 8 : 44
  const w = Math.ceil(x.measureText(text).width) + pad * 2
  c.width = w
  c.height = 112
  x.font = font
  if (o.bg !== null) {
    x.fillStyle = css(o.bg ?? C.ink)
    roundRect(x, 4, 8, w - 8, 96, 48)
    x.fill()
  }
  x.fillStyle = css(o.color ?? (o.bg === null ? C.ink : C.paper))
  x.textBaseline = 'middle'
  x.fillText(text, pad, 58)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }))
  s.scale.set((w / 112) * size, size, 1)
  return s
}

/** A parameter card for the Model Card carousel, drawn on a canvas. */
export function paramCard(o: { name: string; value: string; unit: string; source: string; standIn: boolean; color: number }) {
  const c = document.createElement('canvas')
  c.width = 560
  c.height = 360
  const x = c.getContext('2d')!
  x.fillStyle = '#fffaf2'
  roundRect(x, 0, 0, 560, 360, 36)
  x.fill()
  x.fillStyle = css(o.color)
  roundRect(x, 0, 0, 560, 26, 13)
  x.fill()
  x.fillRect(0, 13, 560, 13)
  x.fillStyle = '#1c2240'
  x.font = '800 46px "Big Shoulders Display", sans-serif'
  x.fillText(o.name.toUpperCase(), 34, 92)
  x.font = '900 104px "Big Shoulders Display", sans-serif'
  x.fillText(o.value, 34, 206)
  const vw = x.measureText(o.value).width
  x.font = '500 28px "DM Mono", monospace'
  x.fillStyle = '#8a7f73'
  x.fillText(o.unit, 46 + vw, 206)
  x.fillStyle = '#e5452f'
  x.fillText(o.source, 34, 262)
  if (o.standIn) {
    x.strokeStyle = '#8a7f73'
    x.setLineDash([8, 6])
    x.lineWidth = 3
    roundRect(x, 34, 290, 196, 46, 23)
    x.stroke()
    x.fillStyle = '#1c2240'
    x.font = '500 24px "DM Mono", monospace'
    x.fillText('STAND-IN', 66, 322)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false }))
}

/** A faint dot pattern for the paper floor. */
export function paperTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  x.fillStyle = css(C.floor)
  x.fillRect(0, 0, 64, 64)
  x.fillStyle = 'rgba(28,34,64,.10)'
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
