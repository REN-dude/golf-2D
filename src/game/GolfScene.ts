import Phaser from 'phaser'
import type { Course, GameEvent, Hole, Lie, Vec2 } from './types'

// Clubs and lie config
type ClubKey = '1w' | '5u' | '7i' | 'PW' | 'SW'
type ClubSpec = { label: string; power: number; angleDeg: number; airDrag: number; baseRoll: number }

const CLUBS: Record<ClubKey, ClubSpec> = {
  '1w': { label: '1w', power: 1.20, angleDeg: -5, airDrag: 0.004, baseRoll: 220 },
  '5u': { label: '5u', power: 1.00, angleDeg: 0, airDrag: 0.005, baseRoll: 160 },
  '7i': { label: '7i', power: 0.85, angleDeg: 6, airDrag: 0.006, baseRoll: 110 },
  'PW': { label: 'PW', power: 0.70, angleDeg: 12, airDrag: 0.007, baseRoll: 60 },
  'SW': { label: 'SW', power: 0.55, angleDeg: 16, airDrag: 0.008, baseRoll: 35 },
}

const LIE_ROLL_MULTIPLIER: Record<'fairway' | 'rough' | 'bunker' | 'green', number> = {
  fairway: 1.0,
  rough: 0.55,
  bunker: 0.35,
  green: 0.8,
}

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
  currentClubKey: ClubKey = '7i'
  aimG?: Phaser.GameObjects.Graphics
  clubText?: Phaser.GameObjects.Text
  clubButtons: Phaser.GameObjects.Text[] = []
  predictedPoints: Vec2[] = []
  predictedLanding?: Vec2
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

    // UI: current club text and buttons
    this.clubText = this.add.text(400, 8, `Club: ${CLUBS[this.currentClubKey].label}`,
      { color: '#ffffff', fontSize: '14px' }).setOrigin(0.5, 0)
    const clubOrder: ClubKey[] = ['1w', '5u', '7i', 'PW', 'SW']
    let x = 520
    for (const key of clubOrder) {
      const t = this.add.text(x, 8, key, { color: key === this.currentClubKey ? '#ffff66' : '#ffffff', fontSize: '12px', backgroundColor: '#00000055' })
        .setPadding(4, 2, 4, 2)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.setClub(key))
      this.clubButtons.push(t)
      x += 34
    }

    // keyboard shortcuts for clubs
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const map: Record<string, ClubKey | undefined> = { '1': '1w', '2': '5u', '3': '7i', '4': 'PW', '5': 'SW' }
      const k = map[ev.key]
      if (k) this.setClub(k)
    })

    // graphics layer for aim/preview
    this.aimG = this.add.graphics()

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
      this.updateAimPreview({ x: p.x, y: p.y })
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
      const ux = dist > 0 ? dx / dist : 0
      const uy = dist > 0 ? dy / dist : 0
      if (this.puttMode) {
        // putt: 1:1 mapping, ignore clubs
        const ballSpeed = dragSpeed * 1
        if (dist > 0 && ballSpeed > 0) body.setVelocity(ux * ballSpeed, uy * ballSpeed)
        else body.setVelocity(0, 0)
      } else {
        const club = CLUBS[this.currentClubKey]
        const s0 = dragSpeed * 10 * club.power
        const sim = this.simulateTrajectory({ x: this.ball.x, y: this.ball.y }, { x: ux * s0, y: uy * s0 }, club)
        // move to landing, then roll
        this.ball.setPosition(sim.landing.x, sim.landing.y)
        const lie = this.getLieAt(sim.landing.x, sim.landing.y)
        const roll = this.computeRollVector(sim.landing, { x: ux, y: uy }, club, lie, sim.hitObstacle)
        body.setVelocity(roll.x, roll.y)
      }

      this.isDragging = false
      this.dragStart = undefined
      this.strokes += 1
      this.emit({ type: 'shot', strokes: this.strokes })
      this.clearAimPreview()
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

  private setClub(key: ClubKey) {
    if (this.currentClubKey === key) return
    this.currentClubKey = key
    if (this.clubText) this.clubText.setText(`Club: ${CLUBS[this.currentClubKey].label}`)
    const order: ClubKey[] = ['1w', '5u', '7i', 'PW', 'SW']
    this.clubButtons.forEach((t, i) => t.setColor(order[i] === key ? '#ffff66' : '#ffffff'))
  }

  private getLieAt(x: number, y: number): 'fairway' | 'rough' | 'bunker' | 'green' | 'water' {
    const p = { x, y }
    const isWater = this.hole.colliders.some((c) => c.type === 'water' && polyContains(c.shape.points, p))
    if (isWater) return 'water'
    const isSand = this.hole.colliders.some((c) => c.type === 'sand' && polyContains(c.shape.points, p))
    if (isSand) return 'bunker'
    const isRough = this.hole.colliders.some((c) => c.type === 'rough' && polyContains(c.shape.points, p))
    if (isRough) return 'rough'
    const inGreen = Phaser.Math.Distance.Between(x, y, this.hole.cupPos.x, this.hole.cupPos.y) < 60
    if (inGreen) return 'green'
    return 'fairway'
  }

  private simulateTrajectory(start: Vec2, v0: Vec2, club: ClubSpec): { points: Vec2[]; landing: Vec2; hitObstacle: boolean } {
    const points: Vec2[] = []
    const stepDt = 1 / 60
    let pos = { x: start.x, y: start.y }
    let v = { x: v0.x * Math.cos((club.angleDeg * Math.PI) / 180), y: v0.y * Math.cos((club.angleDeg * Math.PI) / 180) }
    let landing = { x: start.x, y: start.y }
    let hitObstacle = false
    const maxSteps = 120
    for (let i = 0; i < maxSteps; i++) {
      pos = { x: pos.x + v.x * stepDt, y: pos.y + v.y * stepDt }
      points.push({ x: pos.x, y: pos.y })
      // bounds
      if (pos.x < 0 || pos.x > 800 || pos.y < 0 || pos.y > 450) {
        landing = { x: Math.max(0, Math.min(800, pos.x)), y: Math.max(0, Math.min(450, pos.y)) }
        hitObstacle = true
        break
      }
      const lie = this.getLieAt(pos.x, pos.y)
      if (lie === 'water') {
        landing = { ...pos }
        hitObstacle = true
        break
      }
      const speed = Math.hypot(v.x, v.y)
      if (speed < 30) { landing = { ...pos }; break }
      v.x *= 1 - club.airDrag
      v.y *= 1 - club.airDrag
      landing = { ...pos }
    }
    return { points, landing, hitObstacle }
  }

  private computeRollVector(landing: Vec2, aimDir: Vec2, club: ClubSpec, lie: ReturnType<GolfScene['getLieAt']>, hitObstacle: boolean): Vec2 {
    if (lie === 'water') return { x: 0, y: 0 }
    const l = Math.hypot(aimDir.x, aimDir.y) || 1
    const unit = { x: aimDir.x / l, y: aimDir.y / l }
    const lieKey = lie === 'bunker' ? 'bunker' : lie === 'green' ? 'green' : lie === 'rough' ? 'rough' : 'fairway'
    let rollLen = club.baseRoll * LIE_ROLL_MULTIPLIER[lieKey]
    if (hitObstacle) rollLen *= 0.3
    const nominalTime = 1.2
    const vmag = rollLen / nominalTime
    return { x: unit.x * vmag, y: unit.y * vmag }
  }

  private updateAimPreview(current: Vec2) {
    if (!this.aimG || !this.dragStart) return
    const g = this.aimG
    g.clear()
    // drag line
    g.lineStyle(1, 0xffffff, 0.6)
    g.strokeLineShape(new Phaser.Geom.Line(this.dragStart.x, this.dragStart.y, current.x, current.y))

    const dx = this.dragStart.x - current.x
    const dy = this.dragStart.y - current.y
    const dist = Math.hypot(dx, dy)
    const ux = dist > 0 ? dx / dist : 0
    const uy = dist > 0 ? dy / dist : 0

    if (this.puttMode) {
      g.lineStyle(1, 0xffee58, 0.8)
      g.strokeLineShape(new Phaser.Geom.Line(this.ball.x, this.ball.y, this.ball.x + ux * dist, this.ball.y + uy * dist))
      return
    }

    const club = CLUBS[this.currentClubKey]
    const s0 = dist * 10 * club.power
    const sim = this.simulateTrajectory({ x: this.ball.x, y: this.ball.y }, { x: ux * s0, y: uy * s0 }, club)
    this.predictedPoints = sim.points
    this.predictedLanding = sim.landing

    g.fillStyle(0xffffff, 0.3)
    for (let i = 0; i < sim.points.length; i += 4) {
      const p = sim.points[i]
      g.fillCircle(p.x, p.y, 2)
    }
    const L = sim.landing
    g.lineStyle(2, 0xffee58, 1)
    g.strokeCircle(L.x, L.y, 6)
    g.beginPath(); g.moveTo(L.x - 8, L.y); g.lineTo(L.x + 8, L.y); g.strokePath()
    g.beginPath(); g.moveTo(L.x, L.y - 8); g.lineTo(L.x, L.y + 8); g.strokePath()
  }

  private clearAimPreview() { this.aimG?.clear(); this.predictedPoints = []; this.predictedLanding = undefined }

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
