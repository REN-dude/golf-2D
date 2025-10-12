export type Vec2 = { x: number; y: number }

export type ColliderType = 'wall' | 'sand' | 'water' | 'rough' | 'green' | 'fairway' | 'ob'

export type Collider = {
  type: Exclude<ColliderType, 'ob'>
  shape: { points: Vec2[] }
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

