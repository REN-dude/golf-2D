import type { Course, Hole, Vec2 } from '../game/types'

function rect(x: number, y: number, w: number, h: number): Vec2[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
}

const hole1: Hole = {
  par: 3,
  teePos: { x: 80, y: 225 },
  cupPos: { x: 720, y: 225 },
  colliders: [
    { type: 'fairway', shape: { points: rect(60, 160, 680, 130) } },
    { type: 'green', shape: { points: rect(650, 180, 120, 90) } },
    { type: 'rough', shape: { points: rect(0, 130, 800, 190) } },
    { type: 'sand', shape: { points: rect(400, 260, 80, 40) } },
    { type: 'sand', shape: { points: rect(430, 150, 60, 40) } },
    { type: 'water', shape: { points: rect(250, 190, 60, 70) } },
  ],
}

const hole2: Hole = {
  par: 4,
  teePos: { x: 80, y: 120 },
  cupPos: { x: 720, y: 360 },
  colliders: [
    { type: 'fairway', shape: { points: rect(60, 60, 680, 330) } },
    { type: 'green', shape: { points: rect(650, 320, 120, 90) } },
    { type: 'rough', shape: { points: rect(0, 40, 800, 370) } },
    { type: 'water', shape: { points: rect(300, 260, 80, 60) } },
    { type: 'sand', shape: { points: rect(350, 120, 70, 40) } },
  ],
}

const hole3: Hole = {
  par: 3,
  teePos: { x: 120, y: 360 },
  cupPos: { x: 680, y: 100 },
  colliders: [
    { type: 'fairway', shape: { points: rect(60, 60, 680, 330) } },
    { type: 'green', shape: { points: rect(610, 60, 140, 120) } },
    { type: 'rough', shape: { points: rect(0, 40, 800, 370) } },
    { type: 'sand', shape: { points: rect(280, 300, 80, 50) } },
    { type: 'water', shape: { points: rect(380, 130, 80, 80) } },
  ],
}

export const course: Course = {
  id: 'tutorial-1',
  name: 'ゴルフ基礎コース',
  holes: [hole1, hole2, hole3],
}

