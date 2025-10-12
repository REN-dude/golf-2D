import React, { useEffect, useState } from 'react'

type Props = {
  message: string | null
  durationMs?: number
  onDone?: () => void
}

export default function PopTip({ message, durationMs = 1800, onDone }: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!message) return
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, durationMs)
    return () => clearTimeout(t)
  }, [message, durationMs, onDone])
  if (!message || !visible) return null
  return <div className="poptip">{message}</div>
}

