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

  // Simple circular trees for obstacles
  trees: { x: number; y: number; r: number }[] = []

  // Aim preview (dotted path + landing marker)
  aimGraphics!: Phaser.GameObjects.Graphics
  landingMarker!: Phaser.GameObjects.Arc

  private worldW = 800
  private worldH = 450

  constructor() { super(GolfScene.KEY) }

  init(data: InitData) {
    this.course = data.course
    this.holeIndex = data.holeIndex ?? 0
    this.hole = this.course.holes[this.holeIndex]
    this.onEvent = data.onEvent
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a3a27')

    // derive world size from scale (config width/height)
    this.worldW = this.scale.width as number
    this.worldH = this.scale.height as number
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH, true, true, true, true)
    this.physics.world.setBoundsCollision(false, false, false, false)

    // Draw simple course visuals
    const g = this.add.graphics()
    // Base terrain as rough (darker)
    g.fillStyle(0x275f2e, 1)
    g.fillRect(0, 0, this.worldW, this.worldH)

    // green visualization (draw before hazards so hazards overlay correctly)
    g.fillStyle(0x66bb6a, 1)
    g.fillCircle(this.hole.cupPos.x, this.hole.cupPos.y, 70)

    // fairway/sand/water visualizations
    for (const col of this.hole.colliders) {
      // Treat 'rough' polygons as fairway areas (inner = fairway)
      const color = col.type === 'rough' ? 0x66bb6a : col.type === 'sand' ? 0xe3d7a4 : 0x3fa7f2
      g.fillStyle(color, 1)
      g.beginPath()
      const first = col.shape.points[0]
      g.moveTo(first.x, first.y)
      for (let i = 1; i < col.shape.points.length; i++) g.lineTo(col.shape.points[i].x, col.shape.points[i].y)
      g.closePath()
      g.fillPath()
    }

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

    // Randomly place 3 trees (avoid tee, cup, and water)
    this.placeTrees()
    this.drawTrees()

    // Aim preview graphics
    this.aimGraphics = this.add.graphics()
    this.aimGraphics.setDepth(1000)
    this.landingMarker = this.add.circle(0, 0, 6, 0xffffff, 0.9)
    this.landingMarker.setStrokeStyle(2, 0x78d381, 1)
    this.landingMarker.setVisible(false)

    // Input drag-aim
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const dist = Phaser.Math.Distance.Between(p.x, p.y, this.ball.x, this.ball.y)
      if (dist < 24 && this.ball.body && (this.ball.body as Phaser.Physics.Arcade.Body).speed < 10) {
        this.isDragging = true
        this.dragStart = { x: p.x, y: p.y }
      }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !this.dragStart) return
      // Predict with same mapping as shot: velocity = 3x drag vector
      const dx = this.dragStart.x - p.x
      const dy = this.dragStart.y - p.y
      this.updateAimPreview({ x: this.ball.x, y: this.ball.y }, { x: dx * 3, y: dy * 3 })
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !this.dragStart) return
      const end = { x: p.x, y: p.y }
      const dx = this.dragStart.x - end.x
      const dy = this.dragStart.y - end.y
      const body = this.ball.body as Phaser.Physics.Arcade.Body
      // Set velocity 3x of drag vector
      body.setVelocity(dx * 3, dy * 3)
      this.isDragging = false
      this.dragStart = undefined
      // Clear aim preview
      this.aimGraphics.clear()
      this.landingMarker.setVisible(false)
      this.strokes += 1
      this.emit({ type: 'shot', strokes: this.strokes })
    })
  }

  // Simulate trajectory with lie-based friction, tree collisions, OB/cup detection
  private updateAimPreview(start: Vec2, v0: Vec2) {
    const sim = this.simulateTrajectory(start, v0)
    this.drawDotted(sim.points)
    if (sim.points.length > 0) {
      const last = sim.points[sim.points.length - 1]
      this.landingMarker.setPosition(last.x, last.y)
      // Color by outcome
      const color =
        sim.outcome === 'ob' ? 0xf64f59 :
        sim.outcome === 'water' ? 0x3fa7f2 :
        sim.outcome === 'sand' ? 0xf6c859 :
        sim.outcome === 'rough' ? 0x78d381 :
        sim.outcome === 'green' ? 0x66bb6a :
        sim.outcome === 'cup' ? 0x00ff99 : 0xffffff
      this.landingMarker.setFillStyle(0xffffff, 0.9)
      this.landingMarker.setStrokeStyle(2, color, 1)
      this.landingMarker.setVisible(true)
    } else {
      this.landingMarker.setVisible(false)
    }
  }

  private simulateTrajectory(start: Vec2, v0: Vec2): { points: Vec2[]; outcome: 'fairway' | 'rough' | 'sand' | 'water' | 'green' | 'ob' | 'cup' } {
    const points: Vec2[] = []
    let px = start.x
    let py = start.y
    let vx = v0.x
    let vy = v0.y
    const dt = 1 / 60
    const maxSteps = 1200
    const stopSpeed = 2

    // helpers
    const cupR = 9
    const cup = this.hole.cupPos

    for (let i = 0; i < maxSteps; i++) {
      // integrate
      px += vx * dt
      py += vy * dt

      // OB detection
      if (px < 0 || px > this.worldW || py < 0 || py > this.worldH) {
        return { points, outcome: 'ob' }
      }

      // cup detection (use current speed before friction)
      const speedBefore = Math.hypot(vx, vy)
      const dCup = Phaser.Math.Distance.Between(px, py, cup.x, cup.y)
      if (dCup < cupR && speedBefore < 30) {
        points.push({ x: cup.x, y: cup.y })
        return { points, outcome: 'cup' }
      }

      // tree collisions (approximate same as update)
      for (const t of this.trees) {
        const d = Phaser.Math.Distance.Between(px, py, t.x, t.y)
        const minD = t.r + 5
        if (d < minD) {
          const nx = (px - t.x) / (d || 1)
          const ny = (py - t.y) / (d || 1)
          const push = minD - d + 0.5
          px = t.x + nx * (d + push)
          py = t.y + ny * (d + push)
          const vlen = Math.hypot(vx, vy)
          if (vlen > 40) {
            vx *= 0.4
            vy *= 0.4
          } else {
            // stop on low-speed hit
            points.push({ x: px, y: py })
            const lie = this.determineLie({ x: px, y: py })
            return { points, outcome: lie }
          }
          break
        }
      }

      // Apply lie-based friction (mirrors applyLieFriction)
      const lie = this.determineLie({ x: px, y: py })
      let factor = 0.985 // fairway base
      if (lie === 'rough') factor = 0.96
      if (lie === 'sand') factor = 0.92
      if (lie === 'green') factor = 0.98
      vx *= factor
      vy *= factor

      // collect dotted path sparsely
      if (i % 6 === 0) points.push({ x: px, y: py })

      const speed = Math.hypot(vx, vy)
      if (speed < stopSpeed) {
        const endLie = this.determineLie({ x: px, y: py })
        return { points, outcome: endLie }
      }
    }
    // Fallback outcome
    const endLie = this.determineLie({ x: px, y: py })
    return { points, outcome: endLie }
  }

  private determineLie(p: Vec2): Exclude<Lie, 'tee'> {
    // hazards
    const inWater = this.hole.colliders.some((c) => c.type === 'water' && polyContains(c.shape.points, p))
    if (inWater) return 'water'
    const inSand = this.hole.colliders.some((c) => c.type === 'sand' && polyContains(c.shape.points, p))
    if (inSand) return 'sand'
    // Invert: inside 'rough' polygon is actually fairway; outside becomes rough
    const inFairwayZone = this.hole.colliders.some((c) => c.type === 'rough' && polyContains(c.shape.points, p))
    const inGreen = Phaser.Math.Distance.Between(p.x, p.y, this.hole.cupPos.x, this.hole.cupPos.y) < 60
    if (inGreen) return 'green'
    return inFairwayZone ? 'fairway' : 'rough'
  }

  private drawDotted(points: Vec2[]) {
    const g = this.aimGraphics
    g.clear()
    const dotRadius = 2
    g.fillStyle(0xffffff, 0.9)
    for (const p of points) {
      g.fillCircle(p.x, p.y, dotRadius)
    }
  }

  private placeTrees() {
    this.trees = []
    let attempts = 0
    while (this.trees.length < 3 && attempts < 500) {
      attempts++
      const r = Phaser.Math.Between(10, 16)
      const x = Phaser.Math.Between(30 + r, this.worldW - 30 - r)
      const y = Phaser.Math.Between(30 + r, this.worldH - 30 - r)
      const p = { x, y }
      // Avoid near tee or cup
      const farFromTee = Phaser.Math.Distance.Between(x, y, this.hole.teePos.x, this.hole.teePos.y) > 80
      const farFromCup = Phaser.Math.Distance.Between(x, y, this.hole.cupPos.x, this.hole.cupPos.y) > 90
      // Avoid water polygons
      const inWater = this.hole.colliders.some((c) => c.type === 'water' && polyContains(c.shape.points, p))
      // Avoid overlapping existing trees
      const noOverlap = this.trees.every((t) => Phaser.Math.Distance.Between(x, y, t.x, t.y) > t.r + r + 12)
      if (farFromTee && farFromCup && !inWater && noOverlap) this.trees.push({ x, y, r })
    }
  }

  private drawTrees() {
    const g = this.add.graphics()
    for (const t of this.trees) {
      // trunk
      g.fillStyle(0x6b4f2a, 1)
      g.fillCircle(t.x, t.y + Math.max(2, Math.floor(t.r * 0.2)), Math.max(3, Math.floor(t.r * 0.35)))
      // canopy
      g.fillStyle(0x2e7d32, 1)
      g.fillCircle(t.x, t.y, t.r)
    }
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
    const inFairwayZone = this.hole.colliders.some((c) => c.type === 'rough' && polyContains(c.shape.points, p))

    // green defined as circle around cup
    const inGreen = Phaser.Math.Distance.Between(p.x, p.y, this.hole.cupPos.x, this.hole.cupPos.y) < 60
    this.setPuttMode(inGreen)

    // Mark first entries
    const entries: { key: Exclude<Lie, 'tee'>; now: boolean }[] = [
      { key: 'water', now: inWater },
      { key: 'sand', now: inSand },
      // Rough is outside fairway and not in hazards/green
      { key: 'rough', now: !inFairwayZone && !inSand && !inWater && !inGreen },
      { key: 'green', now: inGreen },
    ]
    for (const e of entries) {
      if (e.now && !this.hasEntered[e.key]) {
        this.hasEntered[e.key] = true
        this.emit({ type: 'entered', lie: e.key })
      }
    }

    // Update friction according to lie each frame
    // Allow crossing water: no immediate penalty here.
    // Penalize only if the ball stops while in water (handled in update()).
    if (inSand) this.applyLieFriction('sand')
    else if (inGreen) this.applyLieFriction('green')
    else if (inFairwayZone) this.applyLieFriction('fairway')
    else this.applyLieFriction('rough')
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
    // OB if ball leaves world rectangle
    if (this.ball.x < 0 || this.ball.x > this.worldW || this.ball.y < 0 || this.ball.y > this.worldH) {
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
    // If ball comes to rest in water, apply penalty and drop
    if (inWater && body.speed < 2) this.handleWater()
    if (body.speed < 12 && !inWater) this.lastSafePos = { x: this.ball.x, y: this.ball.y }

    // Tree collision handling
    // If ball intersects a tree: fast -> decelerate and push out; slow -> stop (drop in place)
    for (const t of this.trees) {
      const d = Phaser.Math.Distance.Between(this.ball.x, this.ball.y, t.x, t.y)
      const minD = t.r + 5 // tree radius + ball radius
      if (d < minD) {
        const v = new Phaser.Math.Vector2(body.velocity.x, body.velocity.y)
        const speed = v.length()
        // Direction from tree center to ball to push it out
        const nx = (this.ball.x - t.x) / (d || 1)
        const ny = (this.ball.y - t.y) / (d || 1)
        const push = minD - d + 0.5
        this.ball.setPosition(t.x + nx * (d + push), t.y + ny * (d + push))
        if (speed > 40) {
          // Significant hit: reduce speed
          v.scale(0.4)
          body.setVelocity(v.x, v.y)
        } else {
          // Low speed: drop in place
          body.setVelocity(0, 0)
        }
        // Only handle one tree per frame
        break
      }
    }

    this.checkZones()
    this.checkOB()
    this.checkCup()
  }
}

export default GolfScene
