import React from 'react'

export type ChecklistItem = { id: string; label: string; done: boolean }

type Props = {
  items: ChecklistItem[]
}

export default function Checklist({ items }: Props) {
  return (
    <div className="checklist">
      {items.map((it) => (
        <div key={it.id} className="chip" title={it.label}>
          <span className={`dot ${it.done ? 'ok' : ''}`} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}

