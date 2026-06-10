import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import hero from '../assets/hero.png'
import logo from '../assets/srg_logo.png'
import CurtainCover from '../components/CurtainCover'
import CurtainReveal from '../components/CurtainReveal'
import { useAuth } from '../context/AuthContext'
import { btn, input, label } from '../styles'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showCurtain, setShowCurtain] = useState(false)
  const [coveringIn, setCoveringIn] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('srg_just_logged_out') === 'true') {
      setShowCurtain(true)
      sessionStorage.removeItem('srg_just_logged_out')
    }
  }, [])

  return (
    <div style={{ background: 'var(--color-srg-black)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {showCurtain && <CurtainReveal />}
      {coveringIn && (
        <CurtainCover
          onCovered={() => {
            sessionStorage.setItem('srg_just_logged_in', 'true')
            navigate('/')
          }}
        />
      )}

      <div style={{ position: 'relative', width: '100%', height: '45vh' }}>
        <img src={hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, transparent 60%, var(--color-srg-black) 100%)' }} />
      </div>

      <main style={{ flex: 1, width: '100%', maxWidth: '420px', margin: '0 auto', marginTop: '-60px', padding: '0 24px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', position: 'relative', zIndex: 10 }}>
        <img
          src={logo}
          alt="SRG"
          style={{ height: '72px', width: 'auto', display: 'block', margin: '0 auto 16px' }}
        />

        <div className="space-y-2">
          <label htmlFor="email" className={`${label} text-gray-300`}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            className={`${input} !border-[#333333] !bg-[#1c1c1c] !text-white placeholder:text-gray-500 focus:!border-srg-yellow`}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className={`${label} text-gray-300`}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className={`${input} !border-[#333333] !bg-[#1c1c1c] !text-white placeholder:text-gray-500 focus:!border-srg-yellow`}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            login()
            setCoveringIn(true)
          }}
          className={`${btn.primary} w-full !bg-srg-yellow !py-2.5 !text-srg-black hover:!bg-[#ffc247]`}
        >
          SIGN IN
        </button>
      </main>
    </div>
  )
}
