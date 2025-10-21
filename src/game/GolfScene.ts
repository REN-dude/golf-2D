import Phaser from 'phaser'
import type { Course, GameEvent, Hole, Lie, Vec2 } from './types'
import { CLUBS, CLUB_ORDER, type ClubKey, type ClubSpec, LIE_MOD } from './clubs'

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
  clubText?: Phaser.GameObjects.Text
  clubButtons: Phaser.GameObjects.Text[] = []
  lastShotClub?: ClubSpec
  holeComplete = false
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
    // Reset strokes when starting a new hole
    this.strokes = 0
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a3a27')
    this.holeComplete = false

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

    // Draw polygons by layer order: water → sand → fairway → green → outlines
    const drawPoly = (pts: Vec2[], fill: number, alpha = 1) => {
      g.fillStyle(fill, alpha)
      g.beginPath()
      const first = pts[0]
      g.moveTo(first.x, first.y)
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
      g.closePath()
      g.fillPath()
    }

    // water
    for (const c of this.hole.colliders) if (c.type === 'water') drawPoly(c.shape.points, 0x3fa7f2, 1)
    // fairway (stored under 'rough')
    for (const c of this.hole.colliders) if (c.type === 'rough') drawPoly(c.shape.points, 0x66bb6a, 1)
    // sand (bunkers) on top of fairway
    for (const c of this.hole.colliders) if (c.type === 'sand') drawPoly(c.shape.points, 0xe3d7a4, 1)
    // green polygon (lighter green)
    for (const c of this.hole.colliders) if (c.type === 'green') drawPoly(c.shape.points, 0xa5d6a7, 1)
    // optional outlines (walls) with subtle darker tint (disabled by default)
    const showRoughOutline = false
    if (showRoughOutline) {
      g.lineStyle(2, 0x2e7d32, 0.7)
      for (const c of this.hole.colliders) if (c.type === 'wall') {
        g.beginPath()
        const pts = c.shape.points
        g.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
        g.closePath()
        g.strokePath()
      }
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

    // Club HUD: clickable labels + keyboard shortcuts (1-5)
    this.clubText = this.add.text(12, 8, `Club: ${CLUBS[this.currentClubKey].label}`,
      { color: '#ffffff', fontSize: '14px' })
    // Buttons
    const startX = 12
    let x = startX
    const y = 28
    const gap = 16
    this.clubButtons = []
    for (let i = 0; i < CLUB_ORDER.length; i++) {
      const key = CLUB_ORDER[i]
      const btn = this.add.text(x, y, `${i + 1}:${CLUBS[key].label}`, {
        color: '#ffffff',
        fontSize: '14px',
      }).setInteractive({ useHandCursor: true })
      btn.on('pointerdown', () => this.setClub(key))
      this.clubButtons.push(btn)
      x += btn.width + gap
    }
    this.refreshClubButtons()
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const idx = parseInt(ev.key, 10)
      if (!Number.isNaN(idx) && idx >= 1 && idx <= CLUB_ORDER.length) {
        this.setClub(CLUB_ORDER[idx - 1])
      }
    })

    // Aim preview graphics
    this.aimGraphics = this.add.graphics()
    this.aimGraphics.setDepth(1000)
    this.landingMarker = this.add.circle(0, 0, 6, 0xffffff, 0.9)
    this.landingMarker.setStrokeStyle(2, 0x78d381, 1)
    this.landingMarker.setVisible(false)

    // Input drag-aim (start from anywhere on screen)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const body = this.ball.body as Phaser.Physics.Arcade.Body
      if (body && body.speed < 10) {
        this.isDragging = true
        // Use pointer-down as the drag start (not the ball position)
        this.dragStart = { x: p.x, y: p.y }
      }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !this.dragStart) return
      // Hide preview if current lie is sand or rough
      const lieNow = this.determineLie({ x: this.ball.x, y: this.ball.y })
      if (lieNow === 'sand' || lieNow === 'rough') {
        this.aimGraphics.clear()
        this.landingMarker.setVisible(false)
        return
      }
      // Fixed-distance preview: direction from drag, speed from club
      const dx = this.dragStart.x - p.x
      const dy = this.dragStart.y - p.y
      const club = CLUBS[this.currentClubKey]
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const speed = this.getFixedShotSpeed(club)
      this.updateAimPreview({ x: this.ball.x, y: this.ball.y }, { x: ux * speed, y: uy * speed }, club)
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !this.dragStart) return
      const end = { x: p.x, y: p.y }
      const dx = this.dragStart.x - end.x
      const dy = this.dragStart.y - end.y
      const len = Math.hypot(dx, dy)
      if (!len || len < 4) { this.isDragging = false; this.dragStart = undefined; return }
      const ux = dx / len
      const uy = dy / len
      const body = this.ball.body as Phaser.Physics.Arcade.Body
      // Fixed-distance shot: per-club speed, drag only sets direction
      const club = CLUBS[this.currentClubKey]
      const speed = this.getFixedShotSpeed(club)
      body.setVelocity(ux * speed, uy * speed)
      this.lastShotClub = club
      this.isDragging = false
      this.dragStart = undefined
      // Clear aim preview
      this.aimGraphics.clear()
      this.landingMarker.setVisible(false)
      this.strokes += 1
      this.emit({ type: 'shot', strokes: this.strokes })
    })
  }

  private getFixedShotSpeed(club: ClubSpec): number {
    // Base fixed shot speed; scaled by club.maxPower
    const BASE = 360
    return BASE * (club.maxPower || 1)
  }

  private setClub(key: ClubKey) {
    if (this.currentClubKey === key) return
    this.currentClubKey = key
    if (this.clubText) this.clubText.setText(`Club: ${CLUBS[this.currentClubKey].label}`)
    this.refreshClubButtons()
  }

  private refreshClubButtons() {
    for (let i = 0; i < this.clubButtons.length; i++) {
      const btn = this.clubButtons[i]
      const key = CLUB_ORDER[i]
      const selected = key === this.currentClubKey
      btn.setColor(selected ? '#ffeb3b' : '#ffffff')
    }
  }

  // Simulate trajectory with lie-based friction, tree collisions, OB/cup detection
  private updateAimPreview(start: Vec2, v0: Vec2, club: ClubSpec) {
    // Do not show preview if ball starts from sand or rough
    const startLieNow = this.determineLie(start)
    if (startLieNow === 'sand' || startLieNow === 'rough') {
      this.aimGraphics.clear()
      this.landingMarker.setVisible(false)
      return
    }
    // Sim total, then show only carry portion based on club + lie modifiers and spin.
    const sim = this.simulateTrajectory(start, v0, club)
    const pts = sim.points
    // total path length
    let totalLen = 0
    for (let i = 1; i < pts.length; i++) totalLen += Phaser.Math.Distance.Between(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)

    // Determine lie at start for modifiers
    const startLie = this.determineLie(start)
    const lieMod = LIE_MOD[startLie]
    const carryMod = lieMod?.carry ?? 1
    const runMod = lieMod?.run ?? 1
    const spinReduce = 1 - 0.5 * Phaser.Math.Clamp(club.spin, 0, 1)
    const carryCoeffEff = club.carryCoeff * carryMod
    const runCoeffEff = club.runCoeff * runMod * spinReduce
    const frac = (carryCoeffEff) / Math.max(0.0001, carryCoeffEff + runCoeffEff)
    const carryTargetLen = totalLen * Phaser.Math.Clamp(frac, 0.05, 0.95)

    // Clip points to carry length only
    const carryPts: Vec2[] = []
    let acc = 0
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) { carryPts.push(pts[i]); continue }
      const d = Phaser.Math.Distance.Between(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)
      if (acc + d >= carryTargetLen) {
        // interpolate last point to land exactly on carry length
        const t = (carryTargetLen - acc) / d
        const x = Phaser.Math.Linear(pts[i - 1].x, pts[i].x, t)
        const y = Phaser.Math.Linear(pts[i - 1].y, pts[i].y, t)
        carryPts.push({ x, y })
        break
      } else {
        carryPts.push(pts[i])
        acc += d
      }
    }

    this.drawDotted(carryPts)
    if (carryPts.length > 0) {
      const last = carryPts[carryPts.length - 1]
      this.landingMarker.setPosition(last.x, last.y)
      // Color by outcome of carry landing area
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

  private simulateTrajectory(start: Vec2, v0: Vec2, club: ClubSpec): { points: Vec2[]; outcome: 'fairway' | 'rough' | 'sand' | 'water' | 'green' | 'ob' | 'cup' } {
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

      // Air drag (derived from club params), then lie-based friction
      // Air drag reduces speed in flight regardless of lie
      const air = Phaser.Math.Clamp(0.004 + 0.004 * (club.launchAngleDeg / 52) - 0.002 * club.spin, 0, 0.02)
      vx *= 1 - air
      vy *= 1 - air
      const lie = this.determineLie({ x: px, y: py })
      let factor = 0.985 // fairway base
      if (lie === 'rough') factor = 0.96
      if (lie === 'sand') factor = 0.92
      if (lie === 'green') factor = 0.98
      // Apply spin influence: higher spin -> more decel (less roll)
      const spin = Phaser.Math.Clamp(club.spin, 0, 1)
      factor = factor - (1 - factor) * (0.5 * spin)
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
    const inGreen = this.hole.colliders.some((c) => c.type === 'green' && polyContains(c.shape.points, p))
    if (inGreen) return 'green'
    // Invert: inside 'rough' polygon is actually fairway; outside becomes rough
    const inFairwayZone = this.hole.colliders.some((c) => c.type === 'rough' && polyContains(c.shape.points, p))
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
    // Adjust by selected club's spin (higher -> more decel/less roll)
    if (this.lastShotClub) {
      const spin = Phaser.Math.Clamp(this.lastShotClub.spin, 0, 1)
      factor = factor - (1 - factor) * (0.5 * spin)
    }
    v.scale(factor)
    body.setVelocity(v.x, v.y)
  }

  private checkZones() {
    const p = { x: this.ball.x, y: this.ball.y }
    const inWater = this.hole.colliders.some((c) => c.type === 'water' && polyContains(c.shape.points, p))
    const inSand = this.hole.colliders.some((c) => c.type === 'sand' && polyContains(c.shape.points, p))
    const inFairwayZone = this.hole.colliders.some((c) => c.type === 'rough' && polyContains(c.shape.points, p))
    const inGreen = this.hole.colliders.some((c) => c.type === 'green' && polyContains(c.shape.points, p))
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
    this.strokes += 1
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
      this.strokes += 1
      this.emit({ type: 'penalty', amount: 1, reason: 'ob' })
      this.resetBallTo(this.lastSafePos)
    }
  }

  private checkCup() {
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    const d = Phaser.Math.Distance.Between(this.ball.x, this.ball.y, this.hole.cupPos.x, this.hole.cupPos.y)
    if (d < 9 && body.speed < 30 && !this.holeComplete) {
      this.holeComplete = true
      this.resetBallTo(this.hole.cupPos)
      // Show score label (Birdie/Par/Bogey...) before notifying app to advance
      const diff = this.strokes - this.hole.par
      const label = ((): string => {
        if (diff <= -3) return 'アルバトロス'
        if (diff === -2) return 'イーグル'
        if (diff === -1) return 'バーディ'
        if (diff === 0) return 'パー'
        if (diff === 1) return 'ボギー'
        if (diff === 2) return 'ダブルボギー'
        if (diff === 3) return 'トリプルボギー'
        if (diff > 3) return `${diff}オーバー`
        return `${-diff}アンダー`
      })()
      const txt = this.add.text(this.worldW / 2, this.worldH / 2, label, {
        color: '#ffffff',
        fontSize: '36px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(2000)
      txt.setShadow(2, 2, '#000000', 4, true, true)
      //スコア表示時間
      this.time.delayedCall(3000, () => {
        txt.destroy()
        this.emit({ type: 'hole', result: 'out', strokes: this.strokes, par: this.hole.par })
      })
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

    // Apply club-specific air drag continuously while moving (derived)
    if (this.lastShotClub && body.speed > 2) {
      const c = this.lastShotClub
      const air = Phaser.Math.Clamp(0.004 + 0.004 * (c.launchAngleDeg / 52) - 0.002 * c.spin, 0, 0.02)
      if (air > 0) body.setVelocity(body.velocity.x * (1 - air), body.velocity.y * (1 - air))
    }

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
