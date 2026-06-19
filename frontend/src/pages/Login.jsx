import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import hero from '../assets/hero.png'
import logo from '../assets/srg_logo.png'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { btn, input, label } from '../styles'

export default function Login() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [entering, setEntering] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    const result = await login(email, password)

    if (!result.success) {
      setSubmitting(false)
      setError(t('login.error'))
      return
    }

    setEntering(true)
    setTimeout(() => navigate('/'), 1500)
  }

  if (entering) {
    return <Spinner />
  }

  return (
    <div style={{ background: 'var(--color-srg-black)', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <button
        type="button"
        onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en')}
        style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 20 }}
        className="text-xs tracking-widest text-gray-400 hover:text-white px-3 py-2 uppercase"
      >
        {i18n.language === 'en' ? 'ES' : 'EN'}
      </button>
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
            {t('login.email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('login.emailPlaceholder')}
            className={`${input} !border-[#333333] !bg-[#1c1c1c] !text-white placeholder:text-gray-500 focus:!border-srg-yellow`}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className={`${label} text-gray-300`}>
            {t('login.password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
            placeholder={t('login.passwordPlaceholder')}
            className={`${input} !border-[#333333] !bg-[#1c1c1c] !text-white placeholder:text-gray-500 focus:!border-srg-yellow`}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-srg-red)' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={`${btn.primary} w-full !bg-srg-yellow !py-2.5 !text-srg-black hover:!bg-[#ffc247] disabled:opacity-50`}
        >
          {submitting ? t('login.signingIn') : t('login.signIn')}
        </button>
      </main>
    </div>
  )
}
