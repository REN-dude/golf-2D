import type { Vec2 } from './types'

// Catmull-Rom spline sampling (centripetal variant-ish by fixed alpha)
// Returns a smooth polyline through given control points.
export function sampleCatmullRom(points: Vec2[], segmentsPerSpan = 12): Vec2[] {
  if (points.length <= 2) return points.slice()
  const pts: Vec2[] = []
  const P = points
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = i === 0 ? P[i] : P[i - 1]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = i + 2 < P.length ? P[i + 2] : P[i + 1]
    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan
      const t2 = t * t
      const t3 = t2 * t
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      pts.push({ x, y })
    }
  }
  pts.push(points[points.length - 1])
  return pts
}

// Build a band polygon around a centerline polyline.
// Width varies along t:[0..1] using wStart->wMid->wEnd.
export function buildVariableWidthBand(
  centerline: Vec2[],
  opts: { wStart: number; wMid: number; wEnd: number }
): Vec2[] {
  if (centerline.length < 2) return []
  const left: Vec2[] = []
  const right: Vec2[] = []

  // precompute cumulative length to map index -> t
  const segLen: number[] = []
  let total = 0
  for (let i = 1; i < centerline.length; i++) {
    const a = centerline[i - 1]
    const b = centerline[i]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    segLen.push(d)
    total += d
  }
  const cum: number[] = [0]
  for (let i = 0; i < segLen.length; i++) cum.push(cum[i] + segLen[i])

  function widthAt(t: number) {
    // simple two-segment lerp: 0->0.5 (start->mid), 0.5->1 (mid->end)
    const { wStart, wMid, wEnd } = opts
    if (t <= 0.5) {
      const u = t / 0.5
      return wStart * (1 - u) + wMid * u
    } else {
      const u = (t - 0.5) / 0.5
      return wMid * (1 - u) + wEnd * u
    }
  }

  for (let i = 0; i < centerline.length; i++) {
    const p = centerline[i]
    // tangent from neighbors
    const p0 = centerline[Math.max(0, i - 1)]
    const p1 = centerline[Math.min(centerline.length - 1, i + 1)]
    let tx = p1.x - p0.x
    let ty = p1.y - p0.y
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl; ty /= tl
    // normal (left-hand)
    let nx = -ty
    let ny = tx

    const t = total > 0 ? cum[i] / total : 0
    const halfW = widthAt(t) * 0.5
    left.push({ x: p.x + nx * halfW, y: p.y + ny * halfW })
    right.push({ x: p.x - nx * halfW, y: p.y - ny * halfW })
  }

  // compose polygon: left side forward + right side reversed
  const poly: Vec2[] = []
  for (const p of left) poly.push(p)
  for (let i = right.length - 1; i >= 0; i--) poly.push(right[i])
  return poly
}

// Offset a simple polygon outward (positive d) or inward (negative d).
// Uses angle-bisector method; good for smooth, non-self-intersecting shapes.
export function offsetPolygon(points: Vec2[], d: number): Vec2[] {
  const n = points.length
  if (n < 3) return points.slice()
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    // edge vectors
    let e0x = p1.x - p0.x, e0y = p1.y - p0.y
    let e1x = p2.x - p1.x, e1y = p2.y - p1.y
    // normals
    const l0 = Math.hypot(e0x, e0y) || 1
    const l1 = Math.hypot(e1x, e1y) || 1
    e0x /= l0; e0y /= l0
    e1x /= l1; e1y /= l1
    const n0x = -e0y, n0y = e0x
    const n1x = -e1y, n1y = e1x
    // bisector
    let bx = n0x + n1x
    let by = n0y + n1y
    const bl = Math.hypot(bx, by) || 1
    bx /= bl; by /= bl
    // miter length factor to keep roughly constant distance
    const dot = n0x * bx + n0y * by
    const m = Math.abs(dot) > 1e-3 ? 1 / dot : 1
    out.push({ x: p1.x + bx * (d * m), y: p1.y + by * (d * m) })
  }
  return out
}

// Simple seeded RNG
function mulberry32(seed: number) {
  let t = seed >>> 0
  return function () {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// Add "natural" jitter along averaged outward normal
export function jitterPolygon(points: Vec2[], amp = 4, seed = 1): Vec2[] {
  const n = points.length
  if (n < 3 || amp <= 0) return points.slice()
  const rnd = mulberry32(seed)
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    let e0x = p1.x - p0.x, e0y = p1.y - p0.y
    let e1x = p2.x - p1.x, e1y = p2.y - p1.y
    const l0 = Math.hypot(e0x, e0y) || 1
    const l1 = Math.hypot(e1x, e1y) || 1
    e0x /= l0; e0y /= l0
    e1x /= l1; e1y /= l1
    const n0x = -e0y, n0y = e0x
    const n1x = -e1y, n1y = e1x
    let nx = n0x + n1x
    let ny = n0y + n1y
    const nl = Math.hypot(nx, ny) || 1
    nx /= nl; ny /= nl
    // low-frequency jitter
    const j = (rnd() * 2 - 1) * amp
    out.push({ x: p1.x + nx * j, y: p1.y + ny * j })
  }
  return out
}

// Build an ellipse polygon centered at (cx,cy)
export function ellipsePolygon(cx: number, cy: number, rx: number, ry: number, segments = 48, rotRad = 0): Vec2[] {
  const pts: Vec2[] = []
  const cosR = Math.cos(rotRad)
  const sinR = Math.sin(rotRad)
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2
    let x = Math.cos(t) * rx
    let y = Math.sin(t) * ry
    const xr = x * cosR - y * sinR
    const yr = x * sinR + y * cosR
    pts.push({ x: cx + xr, y: cy + yr })
  }
  return pts
}

