import Phaser from 'phaser'
import type { Course, GameEvent, Hole, Lie, Vec2 } from './types'

type InitData = {
  course: Course
  holeIndex: number
  onEvent?: (ev: GameEvent) => void
}

function polyContains(points: Vec2[], p: Vec2): boolean {
  // ray casting
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y
    const xj = points[j].x, yj = points[j].y
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export class GolfScene extends Phaser.Scene {
  static KEY = 'GolfScene'

  course!: Course
  hole!: Hole
  holeIndex = 0
  onEvent?: (ev: GameEvent) => void

  ball!: Phaser.GameObjects.Arc
  strokes = 0
  lastSafePos!: Vec2
  isDragging = false
  dragStart?: Vec2
  puttMode = false
  hasEntered: Record<Exclude<Lie, 'tee'>, boolean> = {
    fairway: false,
    rough: false,
    sand: false,
    water: false,
    green: false,
  }

  constructor() { super(GolfScene.KEY) }

  init(data: InitData) {
    this.course = data.course
    this.holeIndex = data.holeIndex ?? 0
    this.hole = this.course.holes[this.holeIndex]
    this.onEvent = data.onEvent
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a3a27')

    this.physics.world.setBounds(0, 0, 800, 450, true, true, true, true)
    this.physics.world.setBoundsCollision(false, false, false, false)

    // Draw simple course visuals
    const g = this.add.graphics()
    g.fillStyle(0x275f2e, 1)
    g.fillRect(0, 0, 800, 450)

    // rough (below hazards/green)
    for (const col of this.hole.colliders.filter((c) => c.type === 'rough')) {
      g.fillStyle(0x2e7d32, 1)
      g.beginPath()
      const first = col.shape.points[0]
      g.moveTo(first.x, first.y)
      for (let i = 1; i < col.shape.points.length; i++) g.lineTo(col.shape.points[i].x, col.shape.points[i].y)
      g.closePath()
      g.fillPath()
    }

    // hazards (sand, water) above fairway/rough
    for (const col of this.hole.colliders.filter((c) => c.type === 'sand' || c.type === 'water')) {
      const color = col.type === 'sand' ? 0xe3d7a4 : 0x3fa7f2
      g.fillStyle(color, 1)
      g.beginPath()
      const first = col.shape.points[0]
      g.moveTo(first.x, first.y)
      for (let i = 1; i < col.shape.points.length; i++) g.lineTo(col.shape.points[i].x, col.shape.points[i].y)
      g.closePath()
      g.fillPath()
    }

    // green (putt-mode area) on top
    g.fillStyle(0xa5d6a7, 1)
    g.fillCircle(this.hole.cupPos.x, this.hole.cupPos.y, 60)
    g.lineStyle(2, 0x66bb6a, 1)
    g.strokeCircle(this.hole.cupPos.x, this.hole.cupPos.y, 60)

    // cup
    this.add.circle(this.hole.cupPos.x, this.hole.cupPos.y, 8, 0x004d40)
    this.add.circle(this.hole.cupPos.x, this.hole.cupPos.y, 4, 0x00251f)

    // tee marker
    this.add.circle(this.hole.teePos.x, this.hole.teePos.y, 6, 0xffffff)

    // ball (drawn as circle, with arcade body attached)
    this.ball = this.add.circle(this.hole.teePos.x, this.hole.teePos.y, 5, 0xffffff)
    this.physics.add.existing(this.ball)
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setDrag(15, 15)
    body.setBounce(0.2, 0.2)
    body.setCollideWorldBounds(false)

    this.lastSafePos = { ...this.hole.teePos }

    // Input drag-aim
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const dist = Phaser.Math.Distance.Between(p.x, p.y, this.ball.x, this.ball.y)
      if (dist < 24 && this.ball.body && (this.ball.body as Phaser.Physics.Arcade.Body).speed < 10) {
        this.isDragging = true
        this.dragStart = { x: p.x, y: p.y }
      }
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !this.dragStart) return
      const end = { x: p.x, y: p.y }
      const dx = this.dragStart.x - end.x
      const dy = this.dragStart.y - end.y
      const body = this.ball.body as Phaser.Physics.Arcade.Body

      // Compute drag speed (pixels/second) and set ball speed:
      // - putt mode: 1:1 (drag speed -> ball speed)
      // - normal:   1:10
      const dist = Math.hypot(dx, dy)
      const dtMs = (p.upTime ?? this.time.now) - (p.downTime ?? this.time.now)
      const dtSec = dtMs > 0 ? dtMs / 1000 : 0
      const dragSpeed = dtSec > 0 ? dist / dtSec : dist // fallback if dt not available
      const scale = this.puttMode ? 1 : 10
      const ballSpeed = dragSpeed * scale
      if (dist > 0 && ballSpeed > 0) {
        const ux = dx / dist
        const uy = dy / dist
        body.setVelocity(ux * ballSpeed, uy * ballSpeed)
      } else {
        body.setVelocity(0, 0)
      }

      this.isDragging = false
      this.dragStart = undefined
      this.strokes += 1
      this.emit({ type: 'shot', strokes: this.strokes })
    })
  }

  private emit(ev: GameEvent) {
    this.onEvent?.(ev)
  }

  private setPuttMode(on: boolean) {
    if (this.puttMode === on) return
    this.puttMode = on
    this.emit({ type: 'puttMode', on })
  }

  private applyLieFriction(lie: Lie) {
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    if (!body) return
    const v = new Phaser.Math.Vector2(body.velocity.x, body.velocity.y)
    const speed = v.length()
    if (speed < 2) return
    let factor = 0.985 // fairway base
    if (lie === 'rough') factor = 0.96
    if (lie === 'sand') factor = 0.92
    if (lie === 'green') factor = 0.98
    v.scale(factor)
    body.setVelocity(v.x, v.y)
  }

  private checkZones() {
    const p = { x: this.ball.x, y: this.ball.y }
    const inWater = this.hole.colliders.some((c) => c.type === 'water' && polyContains(c.shape.points, p))
    const inSand = this.hole.colliders.some((c) => c.type === 'sand' && polyContains(c.shape.points, p))
    const inRough = this.hole.colliders.some((c) => c.type === 'rough' && polyContains(c.shape.points, p))

    // green defined as circle around cup
    const inGreen = Phaser.Math.Distance.Between(p.x, p.y, this.hole.cupPos.x, this.hole.cupPos.y) < 60
    this.setPuttMode(inGreen)

    // Mark first entries
    const entries: { key: Exclude<Lie, 'tee'>; now: boolean }[] = [
      { key: 'water', now: inWater },
      { key: 'sand', now: inSand },
      { key: 'rough', now: inRough },
      { key: 'green', now: inGreen },
    ]
    for (const e of entries) {
      if (e.now && !this.hasEntered[e.key]) {
        this.hasEntered[e.key] = true
        this.emit({ type: 'entered', lie: e.key })
      }
    }

    // Update friction according to lie each frame
    if (inWater) return this.handleWater()
    if (inSand) this.applyLieFriction('sand')
    else if (inRough) this.applyLieFriction('rough')
    else if (inGreen) this.applyLieFriction('green')
    else this.applyLieFriction('fairway')
  }

  private handleWater() {
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    if (body.speed > 20) {
      // absorb quickly
      body.setVelocity(body.velocity.x * 0.8, body.velocity.y * 0.8)
    }
    // penalty + drop at last safe
    this.emit({ type: 'penalty', amount: 1, reason: 'water' })
    this.resetBallTo(this.lastSafePos)
  }

  private resetBallTo(p: Vec2) {
    this.ball.setPosition(p.x, p.y)
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0, 0)
  }

  private checkOB() {
    // OB if ball leaves world rectangle [0,800]x[0,450]
    if (this.ball.x < 0 || this.ball.x > 800 || this.ball.y < 0 || this.ball.y > 450) {
      this.emit({ type: 'penalty', amount: 1, reason: 'ob' })
      this.resetBallTo(this.lastSafePos)
    }
  }

  private checkCup() {
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    const d = Phaser.Math.Distance.Between(this.ball.x, this.ball.y, this.hole.cupPos.x, this.hole.cupPos.y)
    if (d < 9 && body.speed < 30) {
      this.resetBallTo(this.hole.cupPos)
      this.emit({ type: 'hole', result: 'out' })
    }
  }

  update() {
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    // Update last safe pos when ball is slow and not in hazard
    const p = { x: this.ball.x, y: this.ball.y }
    const inWater = this.hole.colliders.some((c) => c.type === 'water' && polyContains(c.shape.points, p))
    if (body.speed < 12 && !inWater) this.lastSafePos = { x: this.ball.x, y: this.ball.y }

    this.checkZones()
    this.checkOB()
    this.checkCup()
  }
}

export default GolfScene
