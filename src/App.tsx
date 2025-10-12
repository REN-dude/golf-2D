import { useEffect, useMemo, useRef, useState } from 'react'
import Phaser from 'phaser'
import './styles/app.css'
import HUD from './ui/HUD'
import { GolfScene } from './game/GolfScene'

type SceneEvent = {
  type: string
  payload?: any
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [tips, setTips] = useState<SceneEvent | null>(null)
  const [check, setCheck] = useState({
    fairway: false,
    rough: false,
    sand: false,
    water: false,
    green: false,
    ob: false,
    putt: false,
  })
  const [strokes, setStrokes] = useState(0)
  const [debug, setDebug] = useState<boolean>(() => {
    const v = localStorage.getItem('golf.debug')
    return v ? v === '1' : true
  })

  const onEvent = useMemo(() => (e: SceneEvent) => {
    switch (e.type) {
      case 'shot':
        setStrokes((s) => s + 1)
        setTips({ type: 'ショット', payload: e.payload })
        setCheck((c) => ({ ...c, putt: c.putt }))
        break
      case 'entered:fairway':
        setCheck((c) => ({ ...c, fairway: true }))
        setTips({ type: 'フェアウェイ', payload: e.payload })
        break
      case 'entered:rough':
        setCheck((c) => ({ ...c, rough: true }))
        setTips({ type: 'ラフ', payload: e.payload })
        break
      case 'entered:sand':
        setCheck((c) => ({ ...c, sand: true }))
        setTips({ type: 'バンカー', payload: e.payload })
        break
      case 'entered:water':
        setCheck((c) => ({ ...c, water: true }))
        setTips({ type: 'ウォーター', payload: e.payload })
        break
      case 'entered:green':
        setCheck((c) => ({ ...c, green: true }))
        setTips({ type: 'グリーン', payload: e.payload })
        break
      case 'puttMode:on':
        setCheck((c) => ({ ...c, putt: true }))
        setTips({ type: 'パットモード', payload: 'ON' })
        break
      case 'puttMode:off':
        setTips({ type: 'パットモード', payload: 'OFF' })
        break
      case 'penalty:+1':
        setStrokes((s) => s + 1)
        setTips({ type: 'ペナルティ', payload: '+1' })
        break
      case 'hole:out':
        setTips({ type: 'ホールアウト', payload: e.payload })
        break
      case 'entered:ob':
        setCheck((c) => ({ ...c, ob: true }))
        setTips({ type: 'OB', payload: e.payload })
        break
    }
  }, [])

  useEffect(() => {
    if (!mountRef.current) return
    const parent = mountRef.current
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 450,
      parent,
      backgroundColor: '#1a2a33',
      physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
    })

    const scene = new GolfScene()
    game.scene.add('golf', scene, true, { onEvent, debug })

    return () => {
      game.destroy(true)
    }
  }, [onEvent, debug])

  useEffect(() => {
    localStorage.setItem('golf.debug', debug ? '1' : '0')
  }, [debug])

  return (
    <div className="app">
      <div className="stage" ref={mountRef} />
      <HUD
        strokes={strokes}
        check={check}
        lastTip={tips}
        debug={debug}
        onToggleDebug={() => setDebug((d) => !d)}
      />
    </div>
  )
}

