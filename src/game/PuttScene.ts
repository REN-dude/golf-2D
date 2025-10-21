import Phaser from 'phaser'
import type { Vec2 } from './types'

type InitData = {
  startWorld: Vec2
  cupWorld: Vec2
  onDone: (res: { holed: boolean; newWorldPos?: Vec2; strokesDelta: number }) => void
  onStroke?: (delta: number) => void
}

export default class PuttScene extends Phaser.Scene {
  static KEY = 'PuttScene'

  startWorld!: Vec2
  cupWorld!: Vec2
  onDone!: (res: { holed: boolean; newWorldPos?: Vec2; strokesDelta: number }) => void
  onStroke?: (delta: number) => void

  // Mat coordinates (local, left->right = towards cup)
  matX = 0
  matY = 0
  matLen = 400
  matHeight = 120

  ballX = 0
  ballY = 0
  ballR = 8
  cupX = 0
  cupR = 10
  velocity = 0 // along +X
  rolling = false
  acc = 320 // friction deceleration px/s^2

  // Ping-pong power gauge state
  selecting = true
  gaugeVal = 0 // 0..1
  gaugeDir = 1 // +1 or -1
  gaugeSpeed = 1.35 // oscillations per second (half-cycle/sec each way)
  vMin = 80
  vMax = 1000

  // Gauge visuals
  gaugeTrack?: Phaser.GameObjects.Rectangle
  gaugeFill?: Phaser.GameObjects.Rectangle
  gaugeW = 320
  gaugeH = 14

  powerGuide?: Phaser.GameObjects.Rectangle
  ballGO!: Phaser.GameObjects.Arc

  // World <-> Mat mapping
  worldTotal = 0
  worldDir = new Phaser.Math.Vector2(1, 0)
  curDist = 0
  matCenterX = 0
  matScale = 1

  constructor() {
    super(PuttScene.KEY)
  }

  init(data: InitData) {
    this.startWorld = data.startWorld
    this.cupWorld = data.cupWorld
    this.onDone = data.onDone
    this.onStroke = data.onStroke
  }

  create() {
    const w = this.scale.width as number
    const h = this.scale.height as number

    // Background overlay
    this.add.rectangle(0, 0, w, h, 0x000000, 0.55).setOrigin(0)

    // Compute world distance and map to mat length x4
    const Lw = Phaser.Math.Distance.Between(this.startWorld.x, this.startWorld.y, this.cupWorld.x, this.cupWorld.y)
    this.worldTotal = Lw
    this.worldDir = new Phaser.Math.Vector2(this.cupWorld.x - this.startWorld.x, this.cupWorld.y - this.startWorld.y)
    if (this.worldDir.length() > 0.0001) this.worldDir.normalize()
    this.curDist = 0
    const baseLen = Phaser.Math.Clamp(Math.round(Lw + 120), 240, 680)
    this.matLen = Phaser.Math.Clamp(baseLen * 4, 600, 2800)

    // Place mat centered
    this.matX = Math.round((w - this.matLen) / 2)
    this.matY = Math.round((h - this.matHeight) / 2)

    // Draw mat
    const g = this.add.graphics()
    g.fillStyle(0x2e7d32, 1)
    g.fillRoundedRect(this.matX, this.matY, this.matLen, this.matHeight, 18)
    // lane stripe
    g.fillStyle(0x388e3c, 1)
    g.fillRoundedRect(this.matX + 10, this.matY + 20, this.matLen - 20, this.matHeight - 40, 14)

    // Cup at center, ball starts at left (for every putt)
    const cupY = this.matY + this.matHeight / 2
    const leftX = this.matX + 26
    const rightX = this.matX + this.matLen - 26
    this.matCenterX = this.matX + Math.floor(this.matLen / 2)
    this.cupX = this.matCenterX
    this.add.circle(this.cupX, cupY, this.cupR, 0x003d2a)
    this.add.circle(this.cupX, cupY, this.cupR - 4, 0x001a12)

    // Initial ball position on the left
    this.ballX = leftX
    this.ballY = cupY
    this.ballGO = this.add.circle(this.ballX, this.ballY, this.ballR, 0xffffff)

    // Mapping: left -> center equals remaining distance; center->right is overshoot
    this.matScale = (this.worldTotal > 0.0001) ? (this.matCenterX - leftX) / this.worldTotal : 1

    // Title / hint
    this.add.text(w / 2, this.matY - 18, 'パターモード', { color: '#ffffff', fontSize: '18px' }).setOrigin(0.5)
    this.add.text(w / 2, this.matY + this.matHeight + 18, 'ドラッグして強さを決めて離す', { color: '#ffffff', fontSize: '14px' }).setOrigin(0.5)

    // ----- Ping-pong power gauge -----
    this.gaugeW = Math.min(420, Math.max(240, Math.floor(this.matLen * 0.7)))
    const gx = Math.round((w - this.gaugeW) / 2)
    const gy = this.matY + this.matHeight + 42
    this.gaugeTrack = this.add.rectangle(gx, gy, this.gaugeW, this.gaugeH, 0x1b5e20, 1).setOrigin(0, 0.5)
    this.gaugeFill = this.add.rectangle(gx, gy, 2, this.gaugeH - 4, 0x78d381, 1).setOrigin(0, 0.5)
    // Velocity range scaled by longer mat
    this.vMin = 80
    this.vMax = Math.max(600, Math.min(1600, Math.floor(this.matLen * 1.2)))
    // Remove any prior pointer drag listeners and use single-click lock
    this.input.removeAllListeners()
    this.input.on('pointerdown', () => {
      if (this.rolling || !this.selecting) return
      this.selecting = false
      // 距離ベース: ゲージ(0..1)→ マット左→中央の距離(px) をそのまま打つ
      const distPxToCup = Math.max(1, this.matCenterX - leftX)
      const desiredPx = Phaser.Math.Clamp(this.gaugeVal, 0, 1) * distPxToCup
      // 等加速度減速で停止距離 s = v^2 / (2a) → v = sqrt(2 a s)
      const v0 = Math.sqrt(Math.max(0, 2 * this.acc * desiredPx))
      // 左→右へ打ち出し
      this.velocity = v0
      this.rolling = true
    })

    // Cancel button
    const btn = this.add.text(w - 16, 16, '戻る', { color: '#ffffff', fontSize: '14px' }).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
    btn.on('pointerdown', () => {
      if (this.rolling) return
      // Return with current projected world position
      const newWorld = this.worldFromMatX(this.ballX)
      this.finish(false, newWorld, 0)
    })
  }

  private updatePowerGuide(dx: number) {
    // Deprecated (drag mode): keep for compatibility but unused in gauge mode
    if (!this.powerGuide) return
    const width = Math.max(4, dx)
    this.powerGuide.width = width
    this.powerGuide.fillColor = width < (this.matLen * 0.35) ? 0x78d381 : (width < (this.matLen * 0.7) ? 0xffeb3b : 0xf64f59)
  }

  update(time: number, delta: number) {
    // Animate ping-pong gauge while selecting
    if (this.selecting && this.gaugeTrack && this.gaugeFill) {
      const dt = delta / 1000
      this.gaugeVal += this.gaugeDir * this.gaugeSpeed * dt
      if (this.gaugeVal >= 1) { this.gaugeVal = 1; this.gaugeDir = -1 }
      if (this.gaugeVal <= 0) { this.gaugeVal = 0; this.gaugeDir = 1 }
      const w = Math.max(2, Math.floor(this.gaugeW * this.gaugeVal))
      this.gaugeFill.width = w
      this.gaugeFill.fillColor = this.gaugeVal < 0.35 ? 0x78d381 : (this.gaugeVal < 0.7 ? 0xffeb3b : 0xf64f59)
    }
    if (!this.rolling) return
    const dt = delta / 1000
    // Integrate position and velocity with constant decel
    const prevX = this.ballX
    this.ballX += this.velocity * dt
    const sign = this.velocity >= 0 ? 1 : -1
    this.velocity -= sign * this.acc * dt
    if (sign > 0 && this.velocity < 0) this.velocity = 0
    if (sign < 0 && this.velocity > 0) this.velocity = 0

    // Clamp to mat bounds
    const minX = this.matX + 26
    const maxX = this.matX + this.matLen - 26
    if (this.ballX > maxX) this.ballX = maxX
    if (this.ballX < minX) this.ballX = minX
    this.ballGO.setPosition(this.ballX, this.ballY)

    // Cup crossing check (both directions)
    const nearCup = Math.abs(this.ballX - this.cupX) <= this.cupR - 2
    const segMin = Math.min(prevX, this.ballX)
    const segMax = Math.max(prevX, this.ballX)
    const crossedCup = segMin <= (this.cupX + this.cupR) && segMax >= (this.cupX - this.cupR)
    if ((crossedCup || nearCup) && Math.abs(this.velocity) < 260) {
      // count stroke, finish holed
      this.onStroke?.(1)
      this.finish(true, undefined, 0)
      return
    }

    // Stop condition
    if (Math.abs(this.velocity) <= 1) {
      // Stop: map to world position and set up for next putt from the left
      const newWorld = this.worldFromMatX(this.ballX)
      this.onStroke?.(1)
      // Update new start and recompute mapping (left -> center)
      this.startWorld = newWorld
      this.worldTotal = Phaser.Math.Distance.Between(this.startWorld.x, this.startWorld.y, this.cupWorld.x, this.cupWorld.y)
      this.worldDir = new Phaser.Math.Vector2(this.cupWorld.x - this.startWorld.x, this.cupWorld.y - this.startWorld.y)
      if (this.worldDir.length() > 0.0001) this.worldDir.normalize()
      const leftX2 = this.matX + 26
      this.matScale = (this.worldTotal > 0.0001) ? (this.matCenterX - leftX2) / this.worldTotal : 1
      // Reset ball to left edge
      this.ballX = leftX2
      this.ballGO.setPosition(this.ballX, this.ballY)
      // Ready for next selection
      this.rolling = false
      this.selecting = true
      return
    }
  }

  private worldFromMatX(x: number): Vec2 {
    // Map left->center to 0..worldTotal; center->right to overshoot up to +50%
    const leftX = this.matX + 26
    const centerX = this.matCenterX
    const rightX = this.matX + this.matLen - 26
    let dist = 0
    if (x <= centerX) {
      const t = Phaser.Math.Clamp((x - leftX) / Math.max(1, (centerX - leftX)), 0, 1)
      dist = t * this.worldTotal
    } else {
      const t2 = Phaser.Math.Clamp((x - centerX) / Math.max(1, (rightX - centerX)), 0, 1)
      const extra = t2 * (this.worldTotal * 0.5)
      dist = this.worldTotal + extra
    }
    const clamped = Phaser.Math.Clamp(dist, 0, Math.max(this.worldTotal * 1.5, this.worldTotal + 1))
    return { x: this.startWorld.x + this.worldDir.x * clamped, y: this.startWorld.y + this.worldDir.y * clamped }
  }

  private finish(holed: boolean, newWorldPos: Vec2 | undefined, strokesDelta: number) {
    this.scene.stop()
    this.onDone({ holed, newWorldPos, strokesDelta })
  }
}
