import { useEffect, useState } from 'react'

export default function PopTip({ text }: { text: string }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    setShow(true)
    const t = setTimeout(() => setShow(false), 2000)
    return () => clearTimeout(t)
  }, [text])
  if (!show) return null
  return <div className="poptip">{text}</div>
}

