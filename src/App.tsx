import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Phaser from 'phaser'
import { course } from './data/course'
import { terms } from './data/terms'
import HUD from './ui/HUD'
import './styles/app.css'
import GolfScene from './game/GolfScene'
import type { GameEvent } from './game/types'

type ChecklistState = {
  fairway: boolean
  sand: boolean
  ob: boolean
  putt: boolean
}

const initialChecklist: ChecklistState = { fairway: false, sand: false, ob: false, putt: false }

export default function App() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const [holeIndex, setHoleIndex] = useState(0)
  const [strokes, setStrokes] = useState(0)
  const [puttMode, setPuttMode] = useState(false)
  const [tip, setTip] = useState<string | null>(null)
  const [check, setCheck] = useState<ChecklistState>(initialChecklist)

  const onEvent = useCallback((ev: GameEvent) => {
    if (ev.type === 'shot') {
      setStrokes(ev.strokes)
      if (ev.strokes === 1) setCheck((c) => ({ ...c, fairway: true }))
    }
    if (ev.type === 'entered') {
      if (ev.lie === 'rough' || ev.lie === 'sand' || ev.lie === 'green' || ev.lie === 'water') {
        const t = terms.find((t) => t.id === (ev.lie === 'sand' ? 'sand' : ev.lie))
        if (t) setTip(`${t.label}: ${t.oneLiner}`)
      }
      if (ev.lie === 'green') setCheck((c) => ({ ...c, putt: true }))
      if (ev.lie === 'sand') setCheck((c) => ({ ...c, sand: true }))
    }
    if (ev.type === 'puttMode') {
      setPuttMode(ev.on)
      if (ev.on) {
        setCheck((c) => ({ ...c, putt: true }))
        const t = terms.find((t) => t.id === 'putter')
        if (t) setTip(`${t.label}: ${t.oneLiner}`)
      }
    }
    if (ev.type === 'penalty') {
      const termId = ev.reason === 'water' ? 'water' : 'ob'
      const t = terms.find((t) => t.id === termId)
      if (t) setTip(`${t.label}: ${t.oneLiner} +${ev.amount}`)
      if (ev.reason === 'ob') setCheck((c) => ({ ...c, ob: true }))
    }
    if (ev.type === 'hole') {
      setTip('カップイン！おめでとう！')
      // automatically advance in a moment
      setTimeout(() => nextHole(), 900)
    }
  }, [])

  const checklistItems = useMemo(() => (
    [
      { id: 'fairway', label: 'フェアウェイ', done: check.fairway },
      { id: 'sand', label: 'バンカー', done: check.sand },
      { id: 'ob', label: 'OB', done: check.ob },
      { id: 'putt', label: 'パット', done: check.putt },
    ]
  ), [check])

  const resetHole = useCallback(() => {
    setStrokes(0)
    setPuttMode(false)
    setCheck(initialChecklist)
    setTip(null)
    const scene = gameRef.current?.scene.getScene(GolfScene.KEY) as GolfScene | undefined
    if (scene) scene.scene.restart({ course, holeIndex, onEvent })
  }, [holeIndex, onEvent])

  const nextHole = useCallback(() => {
    setHoleIndex((i) => (i + 1) % course.holes.length)
  }, [])

  useEffect(() => {
    if (!hostRef.current) return
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 450,
      parent: hostRef.current,
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scene: [GolfScene],
      backgroundColor: '#1a3a27',
    }
    const game = new Phaser.Game(config)
    gameRef.current = game
    const start = () => game.scene.start(GolfScene.KEY, { course, holeIndex, onEvent })
    if (game.isBooted) start(); else game.events.once(Phaser.Core.Events.READY, start)
    return () => { game.destroy(true) }
  }, [])

  useEffect(() => {
    const game = gameRef.current
    if (!game) return
    // switch hole by restarting scene
    setStrokes(0)
    setPuttMode(false)
    setCheck(initialChecklist)
    setTip(null)
    game.scene.stop(GolfScene.KEY)
    game.scene.start(GolfScene.KEY, { course, holeIndex, onEvent })
  }, [holeIndex, onEvent])

  // auto-clear tip
  useEffect(() => {
    if (!tip) return
    const t = setTimeout(() => setTip(null), 2000)
    return () => clearTimeout(t)
  }, [tip])

  return (
    <div className="app">
      <div className="game-shell" ref={hostRef} />
      <HUD
        strokes={strokes}
        par={course.holes[holeIndex].par}
        holeIndex={holeIndex}
        totalHoles={course.holes.length}
        checklist={checklistItems}
        onResetHole={resetHole}
        onNextHole={nextHole}
        puttMode={puttMode}
        lastTip={tip}
      />
    </div>
  )
}
