import { useEffect, useState } from 'react'

export default function CurtainReveal() {
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    let raf1 = 0
    let raf2 = 0
    let revealTimer = 0

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        revealTimer = setTimeout(() => setVisible(false), 225)
      })
    })

    const unmountTimer = setTimeout(() => setMounted(false), 1400)

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(revealTimer)
      clearTimeout(unmountTimer)
    }
  }, [])

  if (!mounted) return null

  return (
    <div
      className={`fixed inset-0 z-[100] bg-srg-black transition-opacity duration-1000 ease-out ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    />
  )
}