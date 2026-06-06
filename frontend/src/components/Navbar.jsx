import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ClipboardList,
  Languages,
  MapPin,
  PackageCheck,
  Send,
  Truck,
  Users,
} from 'lucide-react'

export default function Navbar({ collapsed, mobileOpen, onCloseMobile }) {
  const { t, i18n } = useTranslation()
  const location = useLocation()

  const links = [
    { path: '/', key: 'orders', Icon: ClipboardList },
    { path: '/supplier-tracking', key: 'supplierTracking', Icon: Truck },
    { path: '/receiving-history', key: 'receivingHistory', Icon: PackageCheck },
    { path: '/ready-to-dispatch', key: 'readyToDispatch', Icon: Send },
    { path: '/shipment-movement', key: 'shipmentMovement', Icon: MapPin },
    { path: '/customers', key: 'customers', Icon: Users },
  ]

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en')
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-x-0 top-14 bottom-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <nav
        className={`fixed top-14 bottom-0 left-0 z-40 w-64 shrink-0 bg-[#111111] flex flex-col px-4 py-6 transition-all duration-200 transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-16 md:px-2' : 'md:w-64 md:px-4'} md:static md:translate-x-0 md:self-stretch`}
      >
        <div className="flex flex-col gap-1 flex-1">
          {links.map(({ path, key, Icon }) => (
            <Link
              key={key}
              to={path}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 text-xs tracking-widest px-3 py-2 rounded transition-colors ${
                collapsed ? 'md:justify-center' : ''
              } ${
                location.pathname === path
                  ? 'bg-[#F5A800] text-[#111111] font-bold'
                  : 'text-[#D8D0C0] hover:text-white'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>{t(`nav.${key}`)}</span>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={toggleLang}
          className={`flex items-center gap-3 text-xs tracking-widest text-[#D8D0C0] hover:text-white mt-4 px-3 py-2 rounded transition-colors ${
            collapsed ? 'md:justify-center' : ''
          }`}
        >
          <Languages size={18} className={`shrink-0 ${collapsed ? '' : 'md:hidden'}`} />
          <span className={collapsed ? 'md:hidden' : ''}>
            {i18n.language === 'en' ? 'ES' : 'EN'}
          </span>
        </button>
      </nav>
    </>
  )
}
