import React from 'react'
import Checklist, { ChecklistItem } from './Checklist'

type Props = {
  strokes: number
  par: number
  holeIndex: number
  totalHoles: number
  checklist: ChecklistItem[]
  onResetHole: () => void
  onNextHole: () => void
  puttMode: boolean
  lastTip: string | null
}

export default function HUD({ strokes, par, holeIndex, totalHoles, checklist, onResetHole, onNextHole, puttMode, lastTip }: Props) {
  return (
    <div className="hud">
      <div className="hud-inner">
        <div className="panel stack">
          <div className="row">
            <strong>Hole {holeIndex + 1}/{totalHoles}</strong>
            <span className="spacer" />
            <span>Par {par}</span>
          </div>
          <div className="row">
            <span>Strokes: <strong>{strokes}</strong></span>
            <span className="spacer" />
            <span>{puttMode ? 'Putt Mode' : 'Full Shot'}</span>
          </div>
          <Checklist items={checklist} />
          <div className="row">
            <button className="btn" onClick={onResetHole}>Reset Hole</button>
            <span className="spacer" />
            <button className="btn primary" onClick={onNextHole}>Next Hole</button>
          </div>
        </div>
        <div />
      </div>
      {lastTip ? <div className="poptip">{lastTip}</div> : null}
    </div>
  )
}

