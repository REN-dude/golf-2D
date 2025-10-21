import type { Course, Hole, Vec2 } from '../game/types'
import { buildVariableWidthBand, ellipsePolygon, jitterPolygon, offsetPolygon, sampleCatmullRom } from '../game/geometry'

const WORLD_W = 1280
const WORLD_H = 720

// Global scale for bunker (sand) size. Increase to enlarge all bunkers.
// e.g., 1.2 = +20%, 0.8 = -20%
const BUNKER_SCALE = 1.0

// Global scale for fairway width (1.0 = current width)
//フェアウェイの広さを変えられる
const FAIRWAY_SCALE =1.5
// Scale for rough outline thickness; defaults to follow fairway scale
const ROUGH_OUTLINE_SCALE = FAIRWAY_SCALE

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

// Build holes using a centerline spline → variable-width fairway; hazards as noisy blobs; green as ellipse polygon.
const hole1: Hole = (() => {
  const tee = { x: 120, y: WORLD_H - 120 }
  const cup = { x: WORLD_W - 180, y: 160 }
  // Centerline control points (entrance → mid → end)
  const ctrls: Vec2[] = [
    tee,
    { x: WORLD_W * 0.35, y: WORLD_H * 0.78 },
    { x: WORLD_W * 0.58, y: WORLD_H * 0.52 },
    { x: WORLD_W * 0.76, y: WORLD_H * 0.32 },
    cup,
  ]
  const center = sampleCatmullRom(ctrls, 14)
  const fairway = buildVariableWidthBand(center, { wStart: 52 * FAIRWAY_SCALE, wMid: 86 * FAIRWAY_SCALE, wEnd: 46 * FAIRWAY_SCALE })
  // Outer rough outline as offset + jitter (visual only)
  const roughOutline = jitterPolygon(offsetPolygon(fairway, 22 * ROUGH_OUTLINE_SCALE), 6, 777)
  // Green as rotated ellipse at cup
  const greenPoly = ellipsePolygon(cup.x, cup.y, 80, 55, 56, Math.PI * 0.15)
  return {
    par: 4,
    teePos: tee,
    cupPos: cup,
    colliders: [
      // Fairway polygon (stored under 'rough' for compatibility: inside => fairway)
      { type: 'rough', shape: { points: fairway } },
      // Rough outline kept as 'wall' (not used for lie; can be used for visuals)
      { type: 'wall', shape: { points: roughOutline } },
      { type: 'green', shape: { points: greenPoly } },
      //バンカー、池のサイズ変更
      { type: 'sand', shape: { points: blob(WORLD_W * 0.55, WORLD_H * 0.65, 90 * BUNKER_SCALE, { seed: 102, variation: 0.28, segments: 36, smoothPasses: 2 }) } },
      { type: 'water', shape: { points: blob(WORLD_W * 0.35, WORLD_H * 0.33, 110, { seed: 103, variation: 0.32, segments: 40, smoothPasses: 3, aspectX: 1.3, aspectY: 0.8 }) } },
    ],
  }
})()

const hole2: Hole = (() => {
  const tee = { x: 160, y: 180 }
  const cup = { x: WORLD_W - 200, y: WORLD_H - 200 }
  const ctrls: Vec2[] = [
    tee,
    { x: WORLD_W * 0.34, y: WORLD_H * 0.26 },
    { x: WORLD_W * 0.58, y: WORLD_H * 0.44 },
    { x: WORLD_W * 0.76, y: WORLD_H * 0.62 },
    cup,
  ]
  const center = sampleCatmullRom(ctrls, 12)
  const fairway = buildVariableWidthBand(center, { wStart: 48 * FAIRWAY_SCALE, wMid: 74 * FAIRWAY_SCALE, wEnd: 40 * FAIRWAY_SCALE })
  const roughOutline = jitterPolygon(offsetPolygon(fairway, 18 * ROUGH_OUTLINE_SCALE), 5, 888)
  const greenPoly = ellipsePolygon(cup.x, cup.y, 70, 48, 52, Math.PI * -0.2)
  return {
    par: 3,
    teePos: tee,
    cupPos: cup,
    colliders: [
      { type: 'rough', shape: { points: fairway } },
      { type: 'wall', shape: { points: roughOutline } },
      { type: 'green', shape: { points: greenPoly } },
      //バンカー、池のサイズ変更
      { type: 'sand', shape: { points: blob(WORLD_W * 0.62, WORLD_H * 0.45, 120 * BUNKER_SCALE, { seed: 202, variation: 0.25, segments: 38, smoothPasses: 2 }) } },
      { type: 'water', shape: { points: blob(WORLD_W * 0.28, WORLD_H * 0.58, 130, { seed: 203, variation: 0.35, segments: 42, smoothPasses: 3, aspectX: 0.9, aspectY: 1.2 }) } },
    ],
  }
})()

const hole3: Hole = (() => {
  const tee = { x: 120, y: WORLD_H / 2 }
  const cup = { x: WORLD_W - 140, y: WORLD_H / 2 }
  const ctrls: Vec2[] = [
    tee,
    { x: WORLD_W * 0.28, y: WORLD_H * 0.36 },
    { x: WORLD_W * 0.48, y: WORLD_H * 0.58 },
    { x: WORLD_W * 0.70, y: WORLD_H * 0.50 },
    cup,
  ]
  const center = sampleCatmullRom(ctrls, 14)
  const fairway = buildVariableWidthBand(center, { wStart: 58 * FAIRWAY_SCALE, wMid: 96 * FAIRWAY_SCALE, wEnd: 52 * FAIRWAY_SCALE })
  const roughOutline = jitterPolygon(offsetPolygon(fairway, 26 * ROUGH_OUTLINE_SCALE), 7, 999)
  const greenPoly = ellipsePolygon(cup.x, cup.y, 85, 58, 60, Math.PI * 0.05)
  return {
    par: 5,
    teePos: tee,
    cupPos: cup,
    colliders: [
      { type: 'rough', shape: { points: fairway } },
      { type: 'wall', shape: { points: roughOutline } },
      { type: 'green', shape: { points: greenPoly } },
      //バンカー、池のサイズ変更
      { type: 'sand', shape: { points: blob(WORLD_W * 0.48, WORLD_H * 0.22, 100 * BUNKER_SCALE, { seed: 302, variation: 0.27, segments: 36, smoothPasses: 2 }) } },
      { type: 'water', shape: { points: blob(WORLD_W * 0.42, WORLD_H * 0.75, 150, { seed: 303, variation: 0.33, segments: 44, smoothPasses: 3, aspectX: 1.1, aspectY: 0.9 }) } },
    ],
  }
})()

export const course: Course = {
  id: 'course-wide-random-1',
  name: 'Wide Random • 3H',
  holes: [hole1, hole2, hole3],
}
