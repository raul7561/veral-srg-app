import { useEffect, useRef, useState } from 'react'

export default function CurtainCover({ onCovered }) {
  const [opaque, setOpaque] = useState(false)
  const calledRef = useRef(false)

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setOpaque(true)
    }, 20)

    const coveredTimer = setTimeout(() => {
      if (!calledRef.current) {
        calledRef.current = true
        onCovered?.()
      }
    }, 370)

    return () => {
      clearTimeout(startTimer)
      clearTimeout(coveredTimer)
    }
  }, [onCovered])

  return (
    <div
      className={`fixed inset-0 z-[200] bg-srg-black transition-opacity duration-300 ease-in pointer-events-none ${
        opaque ? 'opacity-100' : 'opacity-0'
      }`}
    />
  )
}
