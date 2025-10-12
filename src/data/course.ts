import type { Course, Hole, Vec2 } from '../game/types'

const rect = (x: number, y: number, w: number, h: number): Vec2[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
]

// Simple 3-hole course inside 800x450 world
const hole1: Hole = {
  par: 4,
  teePos: { x: 100, y: 370 },
  cupPos: { x: 700, y: 100 },
  colliders: [
    { type: 'rough', shape: { points: rect(40, 40, 720, 370) } },
    { type: 'sand', shape: { points: rect(420, 240, 80, 50) } },
    { type: 'water', shape: { points: rect(300, 120, 100, 60) } },
  ],
}

const hole2: Hole = {
  par: 3,
  teePos: { x: 120, y: 120 },
  cupPos: { x: 650, y: 320 },
  colliders: [
    { type: 'rough', shape: { points: rect(60, 60, 680, 320) } },
    { type: 'sand', shape: { points: rect(380, 320, 120, 50) } },
    { type: 'water', shape: { points: rect(220, 160, 110, 70) } },
  ],
}

const hole3: Hole = {
  par: 5,
  teePos: { x: 80, y: 220 },
  cupPos: { x: 740, y: 220 },
  colliders: [
    { type: 'rough', shape: { points: rect(40, 40, 720, 370) } },
    { type: 'sand', shape: { points: rect(500, 90, 90, 60) } },
    { type: 'water', shape: { points: rect(250, 280, 120, 60) } },
  ],
}

export const course: Course = {
  id: 'course-1',
  name: 'ショートガイド 3H',
  holes: [hole1, hole2, hole3],
}

