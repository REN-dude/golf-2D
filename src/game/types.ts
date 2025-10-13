export type Lie = 'tee' | 'fairway' | 'rough' | 'sand' | 'water' | 'green'

export type Vec2 = { x: number; y: number }

export type ColliderType = 'wall' | 'sand' | 'water' | 'rough'

export type Polygon = { points: Vec2[] }

export type Collider = {
  type: ColliderType
  shape: Polygon
}

export type Hole = {
  par: number
  teePos: Vec2
  cupPos: Vec2
  colliders: Collider[]
}

export type Course = {
  id: string
  name: string
  holes: Hole[]
}

export type GameEvent =
  | { type: 'shot'; strokes: number }
  | { type: 'entered'; lie: Exclude<Lie, 'tee'> }
  | { type: 'puttMode'; on: boolean }
  | { type: 'penalty'; amount: number; reason: 'water' | 'ob' }
  | { type: 'hole'; result: 'out' }

