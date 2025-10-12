type Items = { fairway: boolean; rough: boolean; sand: boolean; water: boolean; green: boolean; ob: boolean; putt: boolean }

export default function Checklist({ items }: { items: Items }) {
  const rows: Array<[keyof Items, string]> = [
    ['fairway', 'フェアウェイ'],
    ['rough', 'ラフ'],
    ['sand', 'バンカー'],
    ['water', 'ウォーター'],
    ['green', 'グリーン'],
    ['putt', 'パットモード'],
    ['ob', 'OB'],
  ]
  return (
    <div className="checklist">
      {rows.map(([k, label]) => (
        <>
          <div key={String(k)}>{label}</div>
          <div className={items[k] ? 'ok' : 'muted'}>{items[k] ? 'OK' : '-'}</div>
        </>
      ))}
    </div>
  )
}

