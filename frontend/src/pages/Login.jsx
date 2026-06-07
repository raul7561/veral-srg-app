import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import hero from '../assets/hero.png'
import { btn, input, label } from '../styles'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div style={{ background: '#111111', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', width: '100%', height: '45vh' }}>
        <img src={hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, transparent 60%, #111111 100%)' }} />
      </div>

      <main style={{ flex: 1, width: '100%', maxWidth: '420px', margin: '0 auto', marginTop: '-60px', padding: '0 24px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', position: 'relative', zIndex: 10 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', textAlign: 'center', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>
          SRG OPERATIONS CONTROL
        </h1>

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
            className={`${input} !border-[#333333] !bg-[#1c1c1c] !text-white placeholder:text-gray-500 focus:!border-[#F5A800]`}
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
            className={`${input} !border-[#333333] !bg-[#1c1c1c] !text-white placeholder:text-gray-500 focus:!border-[#F5A800]`}
          />
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          className={`${btn.primary} w-full !bg-[#F5A800] !py-2.5 !text-srg-black hover:!bg-[#ffc247]`}
        >
          SIGN IN
        </button>
      </main>
    </div>
  )
}
