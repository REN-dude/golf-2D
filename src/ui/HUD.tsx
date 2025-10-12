import Checklist from './Checklist'
import PopTip from './PopTip'

type Props = {
  strokes: number
  check: { fairway: boolean; rough: boolean; sand: boolean; water: boolean; green: boolean; ob: boolean; putt: boolean }
  lastTip: { type: string; payload?: any } | null
  debug: boolean
  onToggleDebug: () => void
}

export default function HUD({ strokes, check, lastTip, debug, onToggleDebug }: Props) {
  return (
    <div className="hud">
      <div className="card">
        <div className="row">
          <h4>CHECKLIST</h4>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="muted">DEBUG</span>
            <input className="toggle" type="checkbox" checked={debug} onChange={onToggleDebug} />
          </label>
        </div>
        <Checklist items={check} />
        <div className="row" style={{ marginTop: 6 }}>
          <span className="muted">STROKES</span>
          <strong>{strokes}</strong>
        </div>
      </div>

      {lastTip && <PopTip text={`${lastTip.type}${lastTip.payload ? `: ${lastTip.payload}` : ''}`} />}
    </div>
  )
}

