/**
 * The landing-page world: a warm paper landscape with one 3D vignette per
 * chapter. Scroll sets a fractional chapter index and the camera eases along a
 * keyframed path between vignettes. Each vignette animates on its own clock.
 * The day landscape and the what-if morph are built from the real engine.
 */
import * as THREE from 'three'
import { DRIVERS, PARAM_SPECS, type Driver, type ParamKey } from '../../engine/params'
import { SOURCES } from '../../engine/sources'
import type { Day } from '../../engine/schema'
import type { Trace } from '../../engine/simulate'
import { C, DRIVER_HEX, label, makeHead, makeOrb, mat, paperTexture, paramCard, roundedSlab, shadow } from './parts'

type Updater = (t: number, dt: number) => void

export interface WorldData {
  day: Day
  base: Trace
  lever: Trace
  share: Record<Driver, number>
}

interface Key {
  pos: THREE.Vector3Tuple
  focus: THREE.Vector3Tuple
  card: 'left' | 'right' | 'none'
}
/** Chapter i lives around z = -70·i. */
const KEYS: Key[] = [
  { pos: [0, 8, 27], focus: [4.5, 7.2, 0], card: 'left' }, // 0 hero
  { pos: [10, 13, -38], focus: [0, 5, -70], card: 'right' }, // 1 load is a sum
  { pos: [-6, 10, -121], focus: [0, 2.6, -140], card: 'left' }, // 2 switching
  { pos: [6, 9.5, -186], focus: [2.5, 1.2, -210], card: 'right' }, // 3 notifications
  { pos: [-7, 9, -254], focus: [0, 6.2, -280], card: 'left' }, // 4 open loops
  { pos: [7, 9, -318], focus: [0.5, 4.4, -350], card: 'right' }, // 5 deadline & fatigue
  { pos: [-5, 25, -366], focus: [0, 3, -420], card: 'left' }, // 6 the day in 3D
  { pos: [7, 24, -437], focus: [0, 3, -490], card: 'right' }, // 7 what-if
  { pos: [-7, 12, -526], focus: [0, 5, -560], card: 'left' }, // 8 trust
  { pos: [0, 6.5, -598], focus: [-1, 3.2, -640], card: 'none' }, // 9 finale
]
export const CHAPTERS = KEYS.length

const smooth = (x: number) => x * x * (3 - 2 * x)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export class World {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400)
  private readonly updaters: Updater[] = []
  private readonly clock = new THREE.Clock()
  private readonly camPos = new THREE.Vector3()
  private readonly camTarget = new THREE.Vector3()
  private readonly wantPos = new THREE.Vector3()
  private readonly wantTarget = new THREE.Vector3()
  private readonly tmp = new THREE.Vector3()
  private chapter = 0
  private raf = 0
  private time = 0
  private readonly reduced: boolean
  private pointer = { x: 0, y: 0 }
  private aims: THREE.Vector3[] = []
  private readonly canvas: HTMLCanvasElement
  private readonly data: WorldData
  /** Called when the what-if morph crosses half way, so the page can show which day is on screen. */
  onMorph: ((leverOn: boolean) => void) | null = null

  constructor(canvas: HTMLCanvasElement, data: WorldData, opts: { reducedMotion: boolean }) {
    this.canvas = canvas
    this.data = data
    this.reduced = opts.reducedMotion
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color(C.paper)
    this.scene.fog = new THREE.Fog(C.paper, 44, 108)
    this.buildWorld()
    this.place(0, true)
    this.resize()
  }

  // ── public API ────────────────────────────────────────────
  setChapter(f: number) {
    this.chapter = Math.min(Math.max(f, 0), CHAPTERS - 1)
    if (this.reduced) {
      this.place(this.chapter, true)
      this.render(0)
    }
  }

  setPointer(x: number, y: number) {
    this.pointer = { x, y }
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.fov = w / h < 0.8 ? 64 : 46
    this.camera.updateProjectionMatrix()
    this.computeAims()
    if (this.reduced) this.render(0)
  }

  start() {
    if (this.reduced) {
      this.time = 4 // a settled frame, not the first one
      this.render(0)
      return
    }
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      if (document.hidden) return
      const raw = this.clock.getDelta()
      const dt = Math.min(raw, 0.05) // animations: never jump more than a frame or two
      this.time += dt
      this.place(this.chapter, false, Math.min(raw, 0.5)) // camera: keep up even if frames were throttled
      this.render(dt)
    }
    loop()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.InstancedMesh) {
        o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m: THREE.Material & { map?: THREE.Texture | null }) => {
          m.map?.dispose()
          m.dispose()
        })
      }
    })
    this.renderer.dispose()
  }

  // ── camera ────────────────────────────────────────────────
  /** Offset each aim point so the vignette sits beside (or, on phones, above) the card. */
  private computeAims() {
    const up = new THREE.Vector3(0, 1, 0)
    const aspect = this.camera.aspect
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2)
    const hHalf = Math.atan(Math.tan(vHalf) * aspect)
    this.aims = KEYS.map((key) => {
      const pos = new THREE.Vector3().fromArray(key.pos)
      const focus = new THREE.Vector3().fromArray(key.focus)
      const dist = pos.distanceTo(focus)
      if (key.card === 'none') return focus
      if (aspect < 0.8) return focus.clone().addScaledVector(up, -dist * Math.tan(vHalf) * 0.32)
      const dir = focus.clone().sub(pos).normalize()
      const right = dir.clone().cross(up).normalize()
      const sign = key.card === 'right' ? 1 : -1
      return focus.clone().addScaledVector(right, sign * dist * Math.tan(hHalf) * 0.4)
    })
  }

  private place(f: number, snap: boolean, dt = 0) {
    const i = Math.min(Math.floor(f), CHAPTERS - 2)
    const k = smooth(clamp01(f - i))
    if (!this.aims.length) this.computeAims()
    this.wantPos.fromArray(KEYS[i]!.pos).lerp(this.tmp.fromArray(KEYS[i + 1]!.pos), k)
    // fly a little higher between vignettes so the camera arcs over the landscape
    this.wantPos.y += Math.sin(k * Math.PI) * 5
    this.wantTarget.copy(this.aims[i]!).lerp(this.aims[i + 1]!, k)
    this.wantPos.x += this.pointer.x * 1.4
    this.wantPos.y += -this.pointer.y * 0.9
    if (snap) {
      this.camPos.copy(this.wantPos)
      this.camTarget.copy(this.wantTarget)
    } else {
      const a = 1 - Math.exp(-dt * 3.4)
      this.camPos.lerp(this.wantPos, a)
      this.camTarget.lerp(this.wantTarget, a)
    }
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camTarget)
  }

  private render(dt: number) {
    for (const u of this.updaters) u(this.time, dt)
    this.renderer.render(this.scene, this.camera)
  }

  // ── world ─────────────────────────────────────────────────
  private buildWorld() {
    const s = this.scene
    s.add(new THREE.HemisphereLight(0xfff4e4, 0xd9bf9a, 1.55))
    const key = new THREE.DirectionalLight(0xfff0dc, 1.5)
    key.position.set(18, 30, 24)
    s.add(key)
    const fill = new THREE.DirectionalLight(0xc9d4ff, 0.55)
    fill.position.set(-30, 12, -10)
    s.add(fill)

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.z = -320
    s.add(floor)

    this.bubbles()
    this.heroCluster(new THREE.Vector3(0, 0, 0), true)
    this.sum(new THREE.Vector3(0, 0, -70))
    this.switching(new THREE.Vector3(0, 0, -140))
    this.alerts(new THREE.Vector3(2, 0, -210))
    this.loops(new THREE.Vector3(0, 0, -280))
    this.time5(new THREE.Vector3(1, 0, -350))
    this.landscape(new THREE.Vector3(0, 0, -420), false)
    this.landscape(new THREE.Vector3(0, 0, -490), true)
    this.trust(new THREE.Vector3(0, 0, -560))
    this.heroCluster(new THREE.Vector3(-4.5, 1.5, -646), false)
  }

  /** Drifting pastel memory bubbles along the whole route. */
  private bubbles() {
    const n = 260
    const geo = new THREE.SphereGeometry(1, 20, 14)
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.75 })
    const inst = new THREE.InstancedMesh(geo, m, n)
    const palette = [0xdbe3f8, 0xfadcd5, 0xfcebc4, 0xf8d9e8, 0xe6dcf6, 0xd3eee2].map((h) => new THREE.Color(h))
    const seeds = Array.from({ length: n }, (_, i) => {
      const r = (k: number) => {
        const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
        return x - Math.floor(x)
      }
      const side = r(1) < 0.5 ? -1 : 1
      return { x: side * (14 + r(2) * 30), y: 2 + r(3) * 24, z: 30 - r(4) * 700, s: 0.2 + r(5) ** 2 * 0.9, ph: r(6) * 6.28 }
    })
    seeds.forEach((_, i) => inst.setColorAt(i, palette[i % palette.length]!))
    const o = new THREE.Object3D()
    this.updaters.push((t) => {
      seeds.forEach((b, i) => {
        o.position.set(b.x + Math.sin(t * 0.2 + b.ph) * 0.8, b.y + Math.sin(t * 0.5 + b.ph) * 0.6, b.z)
        o.scale.setScalar(b.s)
        o.updateMatrix()
        inst.setMatrixAt(i, o.matrix)
      })
      inst.instanceMatrix.needsUpdate = true
    })
    this.scene.add(inst)
  }

  /** The three layered heads of the cover, with six thought orbs (hero and finale). */
  private heroCluster(at: THREE.Vector3, hero: boolean) {
    const g = new THREE.Group()
    g.position.copy(at)
    // pastel rays fanning up behind the heads, like the emotion wedges
    const rays = [0xfadcd5, 0xfcebc4, 0xdbe3f8, 0xe6dcf6, 0xd3eee2]
    rays.forEach((c, i) => {
      const a = -0.95 + i * 0.47
      const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(Math.sin(a - 0.16) * 40, Math.cos(a - 0.16) * 40), new THREE.Vector2(Math.sin(a + 0.16) * 40, Math.cos(a + 0.16) * 40)])
      const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false, fog: true }))
      m.position.set(5, 3, -9)
      g.add(m)
    })
    const heads = [
      { face: C.yellow, hair: C.yellowDeep, p: [7.6, 10.2, -4.5], s: 0.86 },
      { face: C.pink, hair: C.pinkDeep, p: [9.6, 6.6, -2.2], s: 0.78 },
      { face: C.blue, hair: C.blueDeep, p: [3.2, 7.6, 0], s: 1 },
    ]
    const headMeshes = heads.map((h) => {
      const m = makeHead(h.face, h.hair)
      m.position.fromArray(h.p)
      m.scale.setScalar(h.s)
      g.add(m)
      const sh = shadow(5 * h.s, 0.18)
      sh.position.set(h.p[0]!, 0.02, h.p[2]!)
      g.add(sh)
      return m
    })
    const orbs = DRIVERS.map((d, i) => {
      const o = makeOrb(DRIVER_HEX[d], [0.85, 0.95, 0.6, 0.75, 0.62, 0.55][i]!)
      g.add(o)
      return o
    })
    const home: THREE.Vector3Tuple[] = [[2.0, 10.0, 2.3], [4.0, 8.0, 2.4], [5.3, 10.4, 2.2], [1.1, 7.1, 2.2], [4.7, 6.0, 2.3], [6.7, 8.2, 2.1]]
    this.updaters.push((t) => {
      headMeshes.forEach((m, i) => {
        m.position.y = heads[i]!.p[1]! + Math.sin(t * 0.7 + i * 1.7) * 0.18
        m.rotation.y = Math.sin(t * 0.35 + i) * 0.12 + (hero ? 0 : t * 0.15)
      })
      orbs.forEach((o, i) => {
        const h = home[i]!
        const orbit = hero ? 0.35 : 3.2
        const a = t * (hero ? 0.9 : 0.45) + i * ((Math.PI * 2) / 6)
        if (hero) o.position.set(h[0] + Math.cos(a) * orbit, h[1] + Math.sin(a * 1.3) * orbit + headMeshes[2]!.position.y - 7.6, h[2])
        else o.position.set(3.2 + Math.cos(a) * 6.2, 8 + Math.sin(a * 2) * 1.4, Math.sin(a) * 6.2)
      })
    })
    this.scene.add(g)
  }

  /** Six driver orbs feed one stacked column: load is a weighted sum. */
  private sum(at: THREE.Vector3) {
    const g = new THREE.Group()
    g.position.copy(at)
    const shares = DRIVERS.map((d) => this.data.share[d])
    const orbs: THREE.Mesh[] = []
    DRIVERS.forEach((d, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3
      const x = -6 + Math.cos(a) * 3.6
      const z = Math.sin(a) * 3.6
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.4, 32), mat(C.cream))
      ped.position.set(x, 0.7, z)
      const orb = makeOrb(DRIVER_HEX[d], 0.7)
      orb.position.set(x, 2.3, z)
      const sh = shadow(1.4, 0.2)
      sh.position.set(x, 0.02, z)
      g.add(ped, orb, sh)
      orbs.push(orb)
    })
    // the column: one disc per driver, height = that driver's share of the sample day's load
    const colX = 5.5
    let y = 0.3
    const tops: number[] = []
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.3, 48), mat(C.ink))
    base.position.set(colX, 0.15, 0)
    g.add(base, (() => { const s = shadow(3.4, 0.25); s.position.x = colX; return s })())
    DRIVERS.forEach((d, i) => {
      const h = Math.max(0.15, shares[i]! * 11)
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, h, 48), mat(DRIVER_HEX[d], { roughness: 0.35, clearcoat: 0.8 }))
      disc.position.set(colX, y + h / 2, 0)
      g.add(disc)
      const l = label(`${Math.round(shares[i]! * 100)}%`, { size: 0.62, bg: DRIVER_HEX[d], color: d === 'alerts' ? C.ink : C.cream })
      l.position.set(colX + 3.1, y + h / 2, 0)
      g.add(l)
      tops.push(y + h / 2)
      y += h + 0.06
    })
    const total = label('LOAD = Σ w·x', { size: 0.8 })
    total.position.set(colX, y + 1.1, 0)
    g.add(total)
    // beads flowing from each orb into its layer
    const beadGeo = new THREE.SphereGeometry(0.13, 12, 8)
    const flows = orbs.map((o, i) => {
      const end = new THREE.Vector3(colX - 1.9, tops[i]!, 0)
      const curve = new THREE.QuadraticBezierCurve3(o.position.clone(), new THREE.Vector3((o.position.x + end.x) / 2, Math.max(o.position.y, end.y) + 3, o.position.z / 2), end)
      const beads = Array.from({ length: 5 }, () => {
        const b = new THREE.Mesh(beadGeo, new THREE.MeshBasicMaterial({ color: DRIVER_HEX[DRIVERS[i]!] }))
        g.add(b)
        return b
      })
      return { curve, beads }
    })
    const orbY = orbs.map((o) => o.position.y)
    this.updaters.push((t) => {
      orbs.forEach((o, i) => {
        o.position.y = orbY[i]! + Math.sin(t * 1.4 + i) * 0.15
        o.rotation.y = t
      })
      flows.forEach(({ curve, beads }, i) => beads.forEach((b, k) => b.position.copy(curve.getPoint((t * 0.25 + k / beads.length + i * 0.13) % 1))))
    })
    this.scene.add(g)
  }

  /** An attention orb hops between task tiles; every hop leaves a fading residue trail. */
  private switching(at: THREE.Vector3) {
    const g = new THREE.Group()
    g.position.copy(at)
    const tasks = [
      { name: 'REPORT', c: 4 },
      { name: 'CODE', c: 5 },
      { name: 'STAND-UP', c: 2 },
      { name: 'ADMIN', c: 1 },
      { name: 'INBOX', c: 1 },
    ]
    const shades = [0x9bb2ee, 0x7d9ae6, 0x5f82e0, 0x4568d8, 0x2f5bd3]
    const pos = tasks.map((_, i) => {
      const a = Math.PI * (0.15 + (i / (tasks.length - 1)) * 0.7)
      return new THREE.Vector3(-Math.cos(a) * 8, 0.6, -Math.sin(a) * 5 + 1.5)
    })
    tasks.forEach((task, i) => {
      const tile = roundedSlab(3.4, 2.4, 0.5, 0.45, mat(shades[task.c - 1]!, { clearcoat: 0.6 }))
      tile.rotation.x = -Math.PI / 2
      tile.position.copy(pos[i]!)
      const l = label(`${task.name} · c${task.c}`, { size: 0.55 })
      l.position.copy(pos[i]!).add(new THREE.Vector3(0, 1.4, 1.2))
      const sh = shadow(2.6, 0.18)
      sh.position.set(pos[i]!.x, 0.02, pos[i]!.z)
      g.add(tile, l, sh)
    })
    const seq = [0, 4, 0, 1, 2, 1, 4, 1, 3, 0]
    const hop = 1.5
    const residueMat = (i: number) => new THREE.MeshBasicMaterial({ color: i % 2 ? C.red : 0xf07a62, transparent: true, opacity: 0, depthWrite: false })
    const arcs = seq.map((from, i) => {
      const a = pos[from]!.clone().setY(1.3)
      const b = pos[seq[(i + 1) % seq.length]!]!.clone().setY(1.3)
      const curve = new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).setY(4.5), b)
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.09, 8), residueMat(i))
      g.add(tube)
      return { curve, tube }
    })
    const orb = makeOrb(C.red, 0.5)
    const halo = makeOrb(0xffffff, 0.75)
    ;(halo.material as THREE.MeshPhysicalMaterial).transparent = true
    ;(halo.material as THREE.MeshPhysicalMaterial).opacity = 0.18
    g.add(orb, halo)
    const tag = label('residue fades · τ ≈ 12 min', { size: 0.55, bg: C.red })
    tag.position.set(0, 7.2, -2)
    g.add(tag)
    this.updaters.push((t) => {
      const k = t / hop
      const cur = Math.floor(k) % seq.length
      const f = smooth(k - Math.floor(k))
      orb.position.copy(arcs[cur]!.curve.getPoint(f))
      halo.position.copy(orb.position)
      halo.scale.setScalar(1 + Math.sin(t * 6) * 0.08)
      arcs.forEach((a, i) => {
        const age = (cur - i + seq.length) % seq.length + (1 - f)
        const m = a.tube.material as THREE.MeshBasicMaterial
        m.opacity = i === cur ? 0.25 * f : 0.75 * Math.exp(-age / 2.6)
      })
    })
    this.scene.add(g)
  }

  /** Alerts rippling into a pool as they arrive, next to a jar that batches them. */
  private alerts(at: THREE.Vector3) {
    const g = new THREE.Group()
    g.position.copy(at)
    const poolMat = () => new THREE.MeshPhysicalMaterial({ color: 0xdbe3f8, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92 })
    const poolA = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.35, 64), poolMat())
    poolA.position.set(-5, 0.18, 0)
    const poolB = poolA.clone()
    poolB.material = poolMat()
    poolB.position.set(6, 0.18, 0)
    const rimA = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.18, 12, 64), mat(C.cream))
    rimA.rotation.x = Math.PI / 2
    rimA.position.copy(poolA.position).setY(0.36)
    const rimB = rimA.clone()
    rimB.position.copy(poolB.position).setY(0.36)
    const la = label('AS THEY ARRIVE', { size: 0.6 })
    la.position.set(-5, 0.9, 5.2)
    const lb = label('BATCHED', { size: 0.6, bg: C.green })
    lb.position.set(6, 0.9, 5.2)
    // the jar
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.1, 3.2, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, clearcoat: 1 }))
    jar.position.set(11.6, 1.6, -1.5)
    const jarBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 40), mat(C.cream))
    jarBase.position.set(11.6, 0.06, -1.5)
    g.add(poolA, poolB, rimA, rimB, la, lb, jar, jarBase)

    const ringGeo = new THREE.TorusGeometry(1, 0.05, 8, 64)
    const makeRing = () => {
      const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: C.yellowDeep, transparent: true, opacity: 0, depthWrite: false }))
      r.rotation.x = Math.PI / 2
      g.add(r)
      return { mesh: r, born: -99, max: 3, x: 0, z: 0 }
    }
    const rings = Array.from({ length: 14 }, makeRing)
    const ripple = (x: number, z: number, t: number, max: number) => {
      const r = rings.reduce((a, b) => (a.born < b.born ? a : b))
      Object.assign(r, { born: t, max, x, z })
    }
    const drops = Array.from({ length: 10 }, () => {
      const o = makeOrb(C.yellow, 0.26)
      o.visible = false
      g.add(o)
      return { o, start: -99 as number, x: 0, z: 0, target: 'a' as 'a' | 'jar' }
    })
    const jarOrbs = Array.from({ length: 9 }, (_, i) => {
      const o = makeOrb(C.yellow, 0.3)
      o.position.set(11.6 + ((i % 3) - 1) * 0.55, 0.42 + Math.floor(i / 3) * 0.55, -1.5 + ((i * 7) % 3 - 1) * 0.25)
      o.visible = false
      g.add(o)
      return o
    })
    let nextA = 0
    let nextJar = 0.4
    let held = 0
    let pour = -99
    let poured = true
    const fall = 0.75
    this.updaters.push((t) => {
      if (t > nextA) {
        const d = drops.find((x) => x.start < -50)
        if (d) {
          const a = (t * 7.3) % (Math.PI * 2)
          Object.assign(d, { start: t, x: -5 + Math.cos(a) * 2.6 * ((t * 3.1) % 1), z: Math.sin(a) * 2.6 * ((t * 1.7) % 1), target: 'a' })
        }
        nextA = t + 0.55 + ((t * 13.7) % 0.5)
      }
      if (t > nextJar && held < jarOrbs.length && t - pour > 1.2) {
        const d = drops.find((x) => x.start < -50)
        if (d) Object.assign(d, { start: t, x: 11.6, z: -1.5, target: 'jar' })
        nextJar = t + 0.7
      }
      for (const d of drops) {
        const k = (t - d.start) / fall
        if (d.start > -50 && k >= 1) {
          // landed (checked on the next frame, so a slow frame can't skip it)
          if (d.target === 'a') ripple(d.x, d.z, t, 3.2)
          else held = Math.min(jarOrbs.length, held + 1)
          d.start = -99
        }
        d.o.visible = d.start > -50 && k >= 0 && k < 1
        if (!d.o.visible) continue
        const floor = d.target === 'jar' ? 0.4 + Math.floor(held / 3) * 0.55 : 0.4
        d.o.position.set(d.x, 10 - (10 - floor) * k * k, d.z)
      }
      jarOrbs.forEach((o, i) => {
        const pk = (t - pour) / 0.9
        if (pk >= 0 && pk < 1) {
          o.visible = true
          const from = new THREE.Vector3(11.6, 0.42 + Math.floor(i / 3) * 0.55, -1.5)
          o.position.set(from.x + (6 - from.x) * pk, from.y + Math.sin(pk * Math.PI) * 4, from.z * (1 - pk))
        } else o.visible = i < held
      })
      if (held >= jarOrbs.length && t - pour > 1.2) {
        pour = t
        held = 0
        poured = false
      }
      if (!poured && t - pour >= 0.9) {
        poured = true
        ripple(6, 0, t, 4.1)
      }
      for (const r of rings) {
        const k = (t - r.born) / 1.8
        r.mesh.visible = k >= 0 && k < 1
        if (!r.mesh.visible) continue
        r.mesh.position.set(r.x, 0.4, r.z)
        r.mesh.scale.setScalar(0.2 + k * r.max)
        ;(r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9
      }
    })
    this.scene.add(g)
  }

  /** Open loops: rings with a gap that close, one by one, as plans get written. */
  private loops(at: THREE.Vector3) {
    const g = new THREE.Group()
    g.position.copy(at)
    const steps = 16
    const geos = Array.from({ length: steps + 1 }, (_, i) => new THREE.TorusGeometry(1, 0.2, 14, 64, Math.PI * (1.4 + (0.6 * i) / steps)))
    const open = new THREE.Color(C.pink)
    const closed = new THREE.Color(C.blue)
    const items = Array.from({ length: 9 }, (_, i) => {
      const m = new THREE.Mesh(geos[0]!, mat(C.pink, { roughness: 0.3, clearcoat: 0.9 }))
      m.position.set(((i % 3) - 1) * 4, 2.6 + Math.floor(i / 3) * 3.4, ((i * 5) % 3) - 1)
      m.scale.setScalar(1.15)
      g.add(m)
      const sh = shadow(1.2, 0.1)
      sh.position.set(m.position.x, 0.02, m.position.z)
      g.add(sh)
      return { m, ph: i * 0.9, order: [4, 0, 8, 2, 6, 1, 7, 3, 5].indexOf(i) }
    })
    const note = label('WRITE A NEXT STEP → THE LOOP CLOSES', { size: 0.55, bg: C.pink })
    note.position.set(0, 12.8, 0)
    g.add(note)
    const cycle = 14
    this.updaters.push((t) => {
      const c = t % cycle
      items.forEach((it) => {
        const k = clamp01((c - 1 - it.order * 1.05) / 0.8) * (c > cycle - 1.2 ? clamp01((cycle - c) / 1.2) : 1)
        it.m.geometry = geos[Math.round(k * steps)]!
        ;(it.m.material as THREE.MeshPhysicalMaterial).color.copy(open).lerp(closed, k)
        it.m.rotation.set(Math.sin(t * 0.6 + it.ph) * 0.5, t * (0.9 - k * 0.7) + it.ph, t * 0.5 * (1 - k) + it.ph)
        it.m.position.y = 2.6 + Math.floor(it.order / 3) * 3.4 + Math.sin(t + it.ph) * 0.2 * (1 - k)
      })
    })
    this.scene.add(g)
  }

  /** A deadline clock and a fatigue battery that fills while working and drains on a break. */
  private time5(at: THREE.Vector3) {
    const g = new THREE.Group()
    g.position.copy(at)
    // clock
    const clock = new THREE.Group()
    clock.position.set(-4, 4.6, 0)
    clock.rotation.y = 0.35
    const face = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.5, 64), mat(C.cream))
    face.rotation.x = Math.PI / 2
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.32, 16, 80), mat(C.purple, { clearcoat: 0.9, roughness: 0.3 }))
    clock.add(face, rim)
    for (let i = 0; i < 12; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.14, i % 3 ? 0.4 : 0.7, 0.12), new THREE.MeshStandardMaterial({ color: C.ink }))
      const a = (i / 12) * Math.PI * 2
      tick.position.set(Math.sin(a) * 3.05, Math.cos(a) * 3.05, 0.3)
      tick.rotation.z = -a
      clock.add(tick)
    }
    const sectors = Array.from({ length: 49 }, (_, i) => new THREE.CircleGeometry(3.3, 48, Math.PI / 2 - (i / 48) * Math.PI * 2, (i / 48) * Math.PI * 2))
    const sector = new THREE.Mesh(sectors[0]!, new THREE.MeshBasicMaterial({ color: C.purple, transparent: true, opacity: 0.35, depthWrite: false }))
    sector.position.z = 0.27
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 0.14), new THREE.MeshStandardMaterial({ color: C.ink }))
    hand.geometry.translate(0, 1.2, 0)
    hand.position.z = 0.36
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 24), mat(C.red))
    pin.rotation.x = Math.PI / 2
    pin.position.z = 0.42
    const flag = makeOrb(C.red, 0.34)
    flag.position.set(0, 3.95, 0.3)
    clock.add(sector, hand, pin, flag)
    const dl = label('DEADLINE', { size: 0.5, bg: C.red })
    dl.position.set(0, 4.8, 0.4)
    clock.add(dl)
    g.add(clock)
    const cs = shadow(3.6, 0.16)
    cs.position.set(-4, 0.02, 0.8)
    g.add(cs)
    // battery
    const bx = 5
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 6.4, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide, clearcoat: 1 }))
    glass.position.set(bx, 3.6, 0)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 32), mat(C.ink))
    cap.position.set(bx, 7.05, 0)
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.4, 48), mat(C.ink))
    foot.position.set(bx, 0.2, 0)
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 1, 48), mat(C.green, { roughness: 0.2, clearcoat: 1, emissive: C.green, emissiveIntensity: 0.15 }))
    liquid.position.x = bx
    const working = label('WORKING · FATIGUE BUILDS', { size: 0.5, bg: C.ink })
    const resting = label('BREAK · IT DRAINS', { size: 0.5, bg: C.green })
    working.position.set(bx, 8.1, 0)
    resting.position.set(bx, 8.1, 0)
    const bs = shadow(2.4, 0.2)
    bs.position.set(bx, 0.02, 0)
    g.add(glass, cap, foot, liquid, working, resting, bs)
    const period = 9
    this.updaters.push((t) => {
      const a = ((t % period) / period) * Math.PI * 2
      hand.rotation.z = -a
      sector.geometry = sectors[Math.round(((Math.PI * 2 - a) / (Math.PI * 2)) * 48)] ?? sectors[0]!
      const c = t % 10
      const level = c < 7 ? 0.12 + 0.78 * (1 - Math.exp(-c / 3.2)) : (0.12 + 0.78 * (1 - Math.exp(-7 / 3.2))) * Math.exp(-(c - 7) / 0.9)
      const h = Math.max(0.05, level * 6)
      liquid.scale.y = h
      liquid.position.y = 0.4 + h / 2
      working.visible = c < 7
      resting.visible = c >= 7
    })
    this.scene.add(g)
  }

  /**
   * The sample day as a 3D stacked landscape: time runs left to right, each
   * driver is one coloured layer. With `morph`, the layers ease back and forth
   * between the day as planned and the day with three levers applied.
   */
  private landscape(at: THREE.Vector3, morph: boolean) {
    const g = new THREE.Group()
    g.position.copy(at)
    const { base, lever, day } = this.data
    const W = 40
    const H = 7
    const D = 3.2
    const step = 2
    const n = Math.floor(base.minutes / step)
    const sm = (tr: Trace, d: Driver, i: number) => {
      let s = 0
      let c = 0
      for (let k = i * step - 5; k <= i * step + 5; k++) {
        const v = tr.parts[d][k]
        if (v !== undefined) [s, c] = [s + v, c + 1]
      }
      return c ? s / c : 0
    }
    const x = (i: number) => -W / 2 + (i / (n - 1)) * W
    const stackA = new Float64Array(n)
    const stackB = new Float64Array(n)
    for (const d of DRIVERS) {
      const pos = (stack: Float64Array, tr: Trace) => {
        const arr: number[] = []
        for (let i = 0; i < n; i++) {
          const lo = stack[i]! * H
          const hi = (stack[i]! + sm(tr, d, i)) * H
          arr.push(x(i), lo, D / 2, x(i), hi, D / 2, x(i), lo, -D / 2, x(i), hi, -D / 2)
          stack[i] = stack[i]! + sm(tr, d, i)
        }
        return new THREE.Float32BufferAttribute(arr, 3)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', pos(stackA, base))
      if (morph) geo.morphAttributes.position = [pos(stackB, lever)]
      const idx: number[] = []
      for (let i = 0; i < n - 1; i++) {
        const a = i * 4
        const b = a + 4
        idx.push(a, b, a + 1, b, b + 1, a + 1) // front
        idx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3) // back
        idx.push(a + 1, b + 1, a + 3, b + 1, b + 3, a + 3) // top
      }
      geo.setIndex(idx)
      geo.computeVertexNormals()
      const m = new THREE.Mesh(geo, mat(DRIVER_HEX[d], { roughness: 0.45, clearcoat: 0.6, side: THREE.DoubleSide }))
      g.add(m)
      if (morph) this.updaters.push(() => (m.morphTargetInfluences![0] = this.morphK))
    }
    // zone bands
    const zones: [number, string, number][] = [[0.65, 'STRAINED', 0xe8902a], [0.85, 'OVERLOADED', C.red]]
    for (const [v, name, col] of zones) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, D + 3), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }))
      plane.rotation.x = -Math.PI / 2
      plane.position.y = v * H
      const l = label(`${name} ≥ ${v}`, { size: 0.5, bg: col })
      l.position.set(W / 2 + 3.4, v * H, 0)
      g.add(plane, l)
    }
    // blocks of the day, as tiles in front
    const blockCol = (b: Day['blocks'][number]) => (b.kind === 'meeting' ? C.ink : b.kind === 'break' ? 0xd8c7ad : [0x9bb2ee, 0x7d9ae6, 0x5f82e0, 0x4568d8, 0x2f5bd3][b.c - 1]!)
    for (const b of day.blocks) {
      const w = ((b.to - b.from) / base.minutes) * W - 0.12
      const tile = roundedSlab(Math.max(0.2, w), 1.2, 0.28, 0.25, mat(blockCol(b)))
      tile.rotation.x = -Math.PI / 2
      tile.position.set(-W / 2 + ((b.from + b.to) / 2 / base.minutes) * W, 0.16, D / 2 + 1.7)
      g.add(tile)
    }
    for (let hr = 0; hr <= base.minutes / 60; hr += 2) {
      const l = label(`${String(Math.floor(day.startClock / 60) + hr).padStart(2, '0')}:00`, { size: 0.55, bg: null })
      l.position.set(-W / 2 + ((hr * 60) / base.minutes) * W, 0.5, D / 2 + 3.4)
      g.add(l)
    }
    const s = shadow(W * 0.62, 0.12)
    s.scale.set(1, 0.18, 1)
    g.add(s)
    if (morph) {
      const a = label('AS PLANNED', { size: 0.9 })
      const b = label('3 LEVERS ON', { size: 0.9, bg: C.green })
      for (const l of [a, b]) {
        l.position.set(0, H * 1.25, 0)
        g.add(l)
      }
      let last = false
      this.updaters.push((t) => {
        const c = (t % 10) / 10
        this.morphK = smooth(clamp01(c < 0.5 ? (c - 0.1) / 0.25 : (0.9 - c) / 0.25))
        const on = this.morphK > 0.5
        a.visible = !on
        b.visible = on
        if (on !== last) {
          last = on
          this.onMorph?.(on)
        }
      })
    } else {
      const l = label('THE SAMPLE DAY · REAL ENGINE OUTPUT', { size: 0.8 })
      l.position.set(0, H * 1.25, 0)
      g.add(l)
    }
    this.scene.add(g)
  }
  private morphK = 0

  /** The Model Card as a carousel of real parameter cards around a small head. */
  private trust(at: THREE.Vector3) {
    const g = new THREE.Group()
    g.position.copy(at)
    const picks: [ParamKey, number][] = [['tauResidue', C.red], ['alertSpike', C.yellow], ['planRelief', C.pink], ['kappaLoops', C.pink], ['deadlineHorizon', C.purple], ['tauRecover', C.green], ['wComplexity', C.blue], ['residue', C.red], ['inboxMin', C.yellow], ['zoneOverloaded', C.ink]]
    const ring = new THREE.Group()
    ring.position.y = 4.8
    picks.forEach(([k, col], i) => {
      const spec = PARAM_SPECS[k]
      const src = spec.sources[0]
      const value = spec.value < 1 && spec.value > 0 && spec.unit !== 'min' ? spec.value.toFixed(2).replace(/0$/, '') : String(Math.round(spec.value * 100) / 100)
      const card = paramCard({ name: k.replace(/([A-Z])/g, ' $1'), value, unit: spec.unit, source: src ? SOURCES[src].short : 'design bound', standIn: spec.standIn, color: col })
      const a = (i / picks.length) * Math.PI * 2
      card.position.set(Math.sin(a) * 8.5, Math.sin(i * 1.7) * 0.8, Math.cos(a) * 8.5)
      card.rotation.y = a
      ring.add(card)
    })
    g.add(ring)
    const head = makeHead(C.blue, C.blueDeep)
    head.scale.setScalar(0.55)
    head.position.set(0, 4.8, 0)
    g.add(head)
    const sh = shadow(3, 0.2)
    g.add(sh)
    const l = label('EVERY NUMBER HAS A SOURCE — OR SAYS IT DOESN’T', { size: 0.6 })
    l.position.set(0, 10.6, 0)
    g.add(l)
    this.updaters.push((t) => {
      ring.rotation.y = t * 0.16
      head.rotation.y = Math.sin(t * 0.5) * 0.6
    })
    this.scene.add(g)
  }
}
