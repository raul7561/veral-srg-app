import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const location = useLocation()

  const links = [
    { path: '/', key: 'orders' },
    { path: '/supplier-tracking', key: 'supplierTracking' },
    { path: '/receiving-history', key: 'receivingHistory' },
    { path: '/ready-to-dispatch', key: 'readyToDispatch' },
    { path: '/shipment-movement', key: 'shipmentMovement' },
    { path: '/customers', key: 'customers' },
  ]

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en')
  }

  return (
    <nav className="w-64 min-h-screen bg-[#111111] flex flex-col px-4 py-6">
      <div className="mb-8">
        <span className="text-[#F5A800] font-bold text-lg tracking-widest uppercase">SRG</span>
        <span className="text-white text-xs ml-2 tracking-widest">OPERATIONS</span>
      </div>

      <div className="flex flex-col gap-1 flex-1">
        {links.map(link => (
          <Link
            key={link.key}
            to={link.path}
            className={`text-xs tracking-widest px-3 py-2 rounded transition-colors ${
              location.pathname === link.path
                ? 'bg-[#F5A800] text-[#111111] font-bold'
                : 'text-[#D8D0C0] hover:text-white'
            }`}
          >
            {t(`nav.${link.key}`)}
          </Link>
        ))}
      </div>

      <button
        onClick={toggleLang}
        className="text-xs tracking-widest text-[#D8D0C0] hover:text-white mt-4"
      >
        {i18n.language === 'en' ? 'ES' : 'EN'}
      </button>
    </nav>
  )
}