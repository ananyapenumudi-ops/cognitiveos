/**
 * A crowd of the crew walking across the bottom of a section.
 *
 * Adapted from Skiper UI's "Skiper 39 · Canvas_Landing_004" CrowdCanvas
 * (https://skiper-ui.com, by @gurvinder-singh02), itself inspired by
 * https://codepen.io/zadvorsky/pen/xxwbBQV. Instead of slicing an Open Peeps
 * sprite sheet, each walker is one of the six CognitiveOS characters, drawn
 * live so its feet step as it moves. The GSAP walk (constant x, yoyo bob,
 * random time scale) and the depth sort by anchor are as in the original.
 */
import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'
import { DRIVERS, type Driver } from '../engine/params'
import { drawCharacter } from './characters'

interface Walker {
  kind: Driver
  size: number
  mood: number
  x: number
  y: number
  anchorY: number
  scaleX: 1 | -1
  blinkAt: number
  walk: gsap.core.Timeline | null
}

const randomRange = (min: number, max: number) => min + Math.random() * (max - min)

export function CrowdCanvas({ density = 1, className = '' }: { density?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const stage = { width: 0, height: 0 }
    const crowd: Walker[] = []

    const reset = (w: Walker) => {
      const direction = Math.random() > 0.5 ? 1 : -1
      const offsetY = 40 - 120 * gsap.parseEase('power2.in')(Math.random())
      const startY = stage.height - 10 - (40 - offsetY) * 0.35
      w.size = randomRange(64, 120) * Math.min(1, stage.height / 320)
      const startX = direction === 1 ? -w.size : stage.width + w.size
      const endX = direction === 1 ? stage.width + w.size : -w.size
      w.scaleX = direction === 1 ? 1 : -1
      w.x = startX
      w.y = startY
      w.anchorY = startY
      return { startX, startY, endX }
    }

    const normalWalk = (w: Walker, { startY, endX }: { startX: number; startY: number; endX: number }) => {
      const xDuration = 14
      const yDuration = 0.25
      const tl = gsap.timeline()
      tl.timeScale(randomRange(0.5, 1.5))
      tl.to(w, { duration: xDuration, x: endX, ease: 'none' }, 0)
      tl.to(w, { duration: yDuration, repeat: xDuration / yDuration, yoyo: true, y: startY - 6 }, 0)
      return tl
    }

    const add = (w: Walker, progress?: number) => {
      const props = reset(w)
      w.walk = normalWalk(w, props).eventCallback('onComplete', () => {
        crowd.splice(crowd.indexOf(w), 1)
        add(w)
      })
      if (progress !== undefined) w.walk.progress(progress)
      crowd.push(w)
      crowd.sort((a, b) => a.anchorY - b.anchorY)
    }

    const render = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(devicePixelRatio, devicePixelRatio)
      const now = performance.now() / 1000
      for (const w of crowd) {
        const blink = now % 4 > w.blinkAt && now % 4 < w.blinkAt + 0.12 ? 1 : 0
        drawCharacter(ctx, w.kind, w.x, w.y, w.size, { mood: w.mood, step: w.x / (w.size * 0.55), blink }, w.scaleX)
      }
    }

    const resize = () => {
      stage.width = canvas.clientWidth
      stage.height = canvas.clientHeight
      canvas.width = stage.width * devicePixelRatio
      canvas.height = stage.height * devicePixelRatio
      crowd.forEach((w) => w.walk?.kill())
      crowd.length = 0
      const n = Math.max(6, Math.round((stage.width / 70) * density))
      for (let i = 0; i < n; i++) {
        const w: Walker = { kind: DRIVERS[i % DRIVERS.length]!, size: 90, mood: Math.random() ** 2 * 0.8, x: 0, y: 0, anchorY: 0, scaleX: 1, blinkAt: Math.random() * 3.8, walk: null }
        add(w, Math.random())
      }
      if (reduced) {
        crowd.forEach((w) => w.walk?.pause())
        render()
      }
    }

    resize()
    if (!reduced) gsap.ticker.add(render)
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      gsap.ticker.remove(render)
      crowd.forEach((w) => w.walk?.kill())
    }
  }, [density])

  return <canvas ref={canvasRef} className={className} aria-hidden />
}
