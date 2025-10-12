import Phaser from 'phaser'
import { course } from '../data/course'
import type { Vec2, Collider, ColliderType } from './types'

type InitData = {
  onEvent?: (e: { type: string; payload?: any }) => void
  debug?: boolean
}

function pointInPoly(p: Vec2, poly: Vec2[]) {
  // ray casting algorithm (even-odd rule)
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export class GolfScene extends Phaser.Scene {
  onEvent?: (e: { type: string; payload?: any }) => void
  debug = true

  ball!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody
  dragStart: Vec2 | null = null
  lastSafePos: Vec2 | null = null
  currentLie: ColliderType | 'ob' | null = null
  holeIndex = 0

  constructor() {
    super('GolfScene')
  }

  init(data: InitData) {
    this.onEvent = data.onEvent
    this.debug = !!data.debug
  }

  create() {
    this.cameras.main.setBackgroundColor('#13424f')
    const world = this.physics.world
    world.setBounds(0, 0, 800, 450)

    const hole = course.holes[this.holeIndex]
    // draw terrain
    const g = this.add.graphics()
    const colors: Record<string, number> = {
      fairway: 0x4aa35e,
      rough: 0x2e6e3c,
      sand: 0xd8c78f,
      water: 0x2b6cb0,
      green: 0x6fcf97,
      wall: 0x666666,
    }
    hole.colliders.forEach((c) => {
      g.fillStyle(colors[c.type] ?? 0x888888, 1)
      g.fillPoints(c.shape.points.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true)
    })

    // cup
    this.add.circle(hole.cupPos.x, hole.cupPos.y, 6, 0x000000)
    this.add.circle(hole.cupPos.x, hole.cupPos.y, 3, 0xffffff)

    // tee marker
    this.add.circle(hole.teePos.x, hole.teePos.y, 6, 0xff3366)

    // ball texture
    const key = 'ball'
    if (!this.textures.exists(key)) {
      const gfx = this.make.graphics({ x: 0, y: 0, add: false })
      gfx.fillStyle(0xffffff, 1)
      gfx.fillCircle(6, 6, 6)
      gfx.generateTexture(key, 12, 12)
      gfx.destroy()
    }
    // ball sprite with physics body
    this.ball = this.physics.add.image(hole.teePos.x, hole.teePos.y, key)
    this.ball.setCircle(6)
    this.ball.setBounce(0)
    this.ball.setCollideWorldBounds(false)
    this.ball.body.setAllowGravity(false)
    this.ball.body.setDrag(60, 60)

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.ball.body.speed > 10) return
      this.dragStart = { x: p.x, y: p.y }
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart) return
      if (this.ball.body.speed > 10) return
      const v = { x: this.dragStart.x - p.x, y: this.dragStart.y - p.y }
      const max = this.isOnGreen() ? 300 : 500
      const scale = clamp(Math.hypot(v.x, v.y), 0, 120) / 120
      const speed = scale * max
      const ang = Math.atan2(v.y, v.x)
      this.ball.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed)
      this.dragStart = null
      this.emit({ type: 'shot' })
    })

    // world bounds check in update
  }

  update(_: number, dtMs: number) {
    const dt = dtMs / 1000
    // friction like behavior depending on lie
    const lie = this.sampleLie()
    const dragMap: Record<string, number> = {
      fairway: 0.99,
      green: 0.992,
      rough: 0.97,
      sand: 0.95,
      water: 0.9,
      wall: 0.99,
    }
    const mult = dragMap[lie as string] ?? 0.99
    this.ball.body.velocity.scale(mult)

    // enter/leave notifications
    if (lie !== this.currentLie) {
      this.currentLie = lie
      if (lie) {
        this.emit({ type: `entered:${lie}` })
        if (lie === 'green') this.emit({ type: 'puttMode:on' })
      }
    }
    if (lie !== 'green' && this.currentLie === 'green') {
      this.emit({ type: 'puttMode:off' })
    }

    // last safe pos (not water/ob)
    if (lie && lie !== 'water') {
      this.lastSafePos = { x: this.ball.x, y: this.ball.y }
    }

    // hole out check
    const hole = course.holes[this.holeIndex]
    const dx = this.ball.x - hole.cupPos.x
    const dy = this.ball.y - hole.cupPos.y
    if (dx * dx + dy * dy < 8 * 8 && this.ball.body.speed < 20) {
      this.ball.setVelocity(0, 0)
      this.emit({ type: 'hole:out' })
    }

    // world bounds -> OB
    if (this.ball.x < 0 || this.ball.y < 0 || this.ball.x > 800 || this.ball.y > 450) {
      this.emit({ type: 'entered:ob' })
      this.penaltyDrop()
    }
  }

  isOnGreen() {
    return this.sampleLie() === 'green'
  }

  sampleLie(): ColliderType | 'ob' | null {
    const hole = course.holes[this.holeIndex]
    const p = { x: this.ball.x, y: this.ball.y }
    for (const c of hole.colliders) {
      if (pointInPoly(p, c.shape.points)) return c.type
    }
    return 'ob'
  }

  penaltyDrop() {
    const pos = this.lastSafePos ?? course.holes[this.holeIndex].teePos
    this.ball.setPosition(pos.x, pos.y)
    this.ball.setVelocity(0, 0)
    this.emit({ type: 'penalty:+1' })
  }

  emit(e: { type: string; payload?: any }) {
    this.onEvent?.(e)
  }
}
