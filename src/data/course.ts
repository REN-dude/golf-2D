import type { Course, Hole, Vec2 } from '../game/types'

const WORLD_W = 1280
const WORLD_H = 720

// Simple seeded RNG for reproducible random shapes
function mulberry32(seed: number) {
  let t = seed >>> 0
  return function () {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// Create a blobby polygon centered at (cx,cy)
function blob(
  cx: number,
  cy: number,
  baseR: number,
  opts?: { segments?: number; variation?: number; seed?: number; smoothPasses?: number; aspectX?: number; aspectY?: number }
): Vec2[] {
  const segments = opts?.segments ?? 48
  const variation = Math.max(0, Math.min(1, opts?.variation ?? 0.25))
  const aspectX = opts?.aspectX ?? 1
  const aspectY = opts?.aspectY ?? 1
  const smoothPasses = opts?.smoothPasses ?? 2
  const rnd = mulberry32((opts?.seed ?? 1) | 0)

  const r: number[] = new Array(segments)
  for (let i = 0; i < segments; i++) {
    const noise = (rnd() * 2 - 1) * variation
    r[i] = baseR * (1 + noise)
  }
  // Smooth radius to favor curves over jagged edges
  for (let p = 0; p < smoothPasses; p++) {
    const s: number[] = new Array(segments)
    for (let i = 0; i < segments; i++) {
      const a = r[(i - 1 + segments) % segments]
      const b = r[i]
      const c = r[(i + 1) % segments]
      s[i] = (a + b + c) / 3
    }
    for (let i = 0; i < segments; i++) r[i] = s[i]
  }

  const pts: Vec2[] = []
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2
    pts.push({ x: cx + Math.cos(t) * r[i] * aspectX, y: cy + Math.sin(t) * r[i] * aspectY })
  }
  return pts
}

// Build three holes with wide world and curved random shapes
const hole1: Hole = {
  par: 4,
  teePos: { x: 120, y: WORLD_H - 120 },
  cupPos: { x: WORLD_W - 180, y: 160 },
  colliders: [
    // Large rough area as a curved blob covering most of the world
    { type: 'rough', shape: { points: blob(WORLD_W / 2, WORLD_H / 2, Math.min(WORLD_W, WORLD_H) * 0.46, { seed: 101, variation: 0.18, segments: 56, smoothPasses: 3, aspectX: 1.2, aspectY: 0.9 }) } },
    // Sand bunker
    { type: 'sand', shape: { points: blob(WORLD_W * 0.55, WORLD_H * 0.65, 90, { seed: 102, variation: 0.28, segments: 36, smoothPasses: 2 }) } },
    // Water hazard
    { type: 'water', shape: { points: blob(WORLD_W * 0.35, WORLD_H * 0.33, 110, { seed: 103, variation: 0.32, segments: 40, smoothPasses: 3, aspectX: 1.3, aspectY: 0.8 }) } },
  ],
}

const hole2: Hole = {
  par: 3,
  teePos: { x: 160, y: 180 },
  cupPos: { x: WORLD_W - 200, y: WORLD_H - 200 },
  colliders: [
    { type: 'rough', shape: { points: blob(WORLD_W / 2, WORLD_H / 2, Math.min(WORLD_W, WORLD_H) * 0.44, { seed: 201, variation: 0.2, segments: 60, smoothPasses: 3, aspectX: 1.1, aspectY: 1 }) } },
    { type: 'sand', shape: { points: blob(WORLD_W * 0.62, WORLD_H * 0.45, 120, { seed: 202, variation: 0.25, segments: 38, smoothPasses: 2 }) } },
    { type: 'water', shape: { points: blob(WORLD_W * 0.28, WORLD_H * 0.58, 130, { seed: 203, variation: 0.35, segments: 42, smoothPasses: 3, aspectX: 0.9, aspectY: 1.2 }) } },
  ],
}

const hole3: Hole = {
  par: 5,
  teePos: { x: 120, y: WORLD_H / 2 },
  cupPos: { x: WORLD_W - 140, y: WORLD_H / 2 },
  colliders: [
    { type: 'rough', shape: { points: blob(WORLD_W / 2, WORLD_H / 2, Math.min(WORLD_W, WORLD_H) * 0.47, { seed: 301, variation: 0.22, segments: 64, smoothPasses: 3, aspectX: 1.25, aspectY: 0.95 }) } },
    { type: 'sand', shape: { points: blob(WORLD_W * 0.48, WORLD_H * 0.22, 100, { seed: 302, variation: 0.27, segments: 36, smoothPasses: 2 }) } },
    { type: 'water', shape: { points: blob(WORLD_W * 0.42, WORLD_H * 0.75, 150, { seed: 303, variation: 0.33, segments: 44, smoothPasses: 3, aspectX: 1.1, aspectY: 0.9 }) } },
  ],
}

export const course: Course = {
  id: 'course-wide-random-1',
  name: 'ワイド・ランダムE3H',
  holes: [hole1, hole2, hole3],
}

