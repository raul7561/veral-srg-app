import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ClipboardList,
  FilePlus,
  FileText,
  History,
  Languages,
  LogOut,
  MapPin,
  PackageCheck,
  Send,
  Truck,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ collapsed, mobileOpen, onCloseMobile }) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [quotesManuallyOpen, setQuotesManuallyOpen] = useState(false)
  const quotesOpen = location.pathname.startsWith('/quotes') || quotesManuallyOpen

  const { logout } = useAuth()

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

  const handleLogout = () => {
    logout()
  }

  const isActive = (path) => {
    if (quotesOpen && !location.pathname.startsWith('/quotes')) return false
    return path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-x-0 top-24 bottom-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <nav
        className={`fixed top-24 bottom-0 left-0 z-40 w-64 shrink-0 bg-srg-black flex flex-col px-4 py-6 transition-all duration-200 transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-16 md:px-2' : 'md:w-64 md:px-4'} md:sticky md:top-24 md:h-[calc(100vh-6rem)] md:translate-x-0 md:self-start`}
      >
        <div className="h-px bg-srg-yellow mb-4" />

        <div className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
          {links.map(({ path, key, Icon }) => (
            <Link
              key={key}
              to={path}
              onClick={() => { setQuotesManuallyOpen(false); onCloseMobile?.() }}
              className={`flex items-center gap-3 text-xs tracking-widest px-3 py-2 rounded transition-colors ${
                collapsed ? 'md:justify-center' : ''
              } ${
                isActive(path)
                  ? 'bg-srg-yellow text-srg-black font-bold'
                  : 'text-srg-border hover:text-white'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>{t(`nav.${key}`)}</span>
            </Link>
          ))}

          {collapsed ? (
            <Link
              to="/quotes/new"
              onClick={onCloseMobile}
              className={`flex items-center gap-3 text-xs tracking-widest px-3 py-2 rounded transition-colors ${
                collapsed ? 'md:justify-center' : ''
              } ${
                location.pathname.startsWith('/quotes')
                  ? 'bg-srg-yellow text-srg-black font-bold'
                  : 'text-srg-border hover:text-white'
              }`}
            >
              <FileText size={18} className="shrink-0" />
              <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>{t('nav.quotes')}</span>
            </Link>
          ) : (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setQuotesManuallyOpen(current => !current)}
                className={`flex items-center gap-3 text-xs tracking-widest px-3 py-2 rounded transition-colors ${
                  collapsed ? 'md:justify-center' : ''
                } ${
                  (location.pathname.startsWith('/quotes') || quotesOpen)
                    ? 'bg-srg-yellow text-srg-black font-bold'
                    : 'text-srg-border hover:text-white'
                }`}
              >
                <FileText size={18} className="shrink-0" />
                <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>{t('nav.quotes')}</span>
                <ChevronDown
                  size={16}
                  className={`ml-auto shrink-0 transition-transform ${quotesOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {quotesOpen && (
                <>
                  {[
                    { path: '/quotes/new', label: t('nav.quotesGenerate'), Icon: FilePlus },
                    { path: '/quotes/history', label: t('nav.quotesHistory'), Icon: History },
                  ].map(({ path, label, Icon }) => (
                    <Link
                      key={path}
                      to={path}
                      onClick={onCloseMobile}
                      className={`flex items-center gap-3 text-xs tracking-widest px-3 py-2 rounded transition-colors pl-9 ${
                        location.pathname === path
                          ? 'bg-srg-yellow text-srg-black font-bold'
                          : 'text-srg-border hover:text-white'
                      }`}
                    >
                      <Icon size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">{label}</span>
                    </Link>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0">
        <div className="h-px bg-srg-yellow mb-4" />

        <button
          type="button"
          onClick={toggleLang}
          className={`flex items-center gap-3 text-xs tracking-widest text-srg-border hover:text-white mt-4 px-3 py-2 rounded transition-colors ${
            collapsed ? 'md:justify-center' : ''
          }`}
        >
          <Languages size={18} className={`shrink-0 ${collapsed ? '' : 'md:hidden'}`} />
          <span className={collapsed ? 'md:hidden' : ''}>
            {i18n.language === 'en' ? 'ES' : 'EN'}
          </span>
        </button>

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 text-xs tracking-widest text-srg-border hover:text-srg-red mt-2 px-3 py-2 rounded transition-colors ${
            collapsed ? 'md:justify-center' : ''
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          <span className={collapsed ? 'md:hidden' : ''}>
            {i18n.language === 'en' ? 'Log out' : 'Cerrar sesión'}
          </span>
        </button>
        </div>
      </nav>
    </>
  )
}
