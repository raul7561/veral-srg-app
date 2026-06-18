import { Menu } from 'lucide-react'
import logo from '../assets/srg_logo_completo.png'

export default function Header({ onToggle }) {
  return (
    <header className="sticky top-0 z-50 h-14 w-full bg-srg-black px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggle}
          className="h-10 w-10 flex items-center justify-center rounded text-white hover:bg-white/10 transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu size={24} />
        </button>

        <img src={logo} alt="Seven Roads Group" className="h-9 md:h-11 w-auto" />
      </div>

      <span className="hidden md:block text-sm font-bold uppercase tracking-widest text-white">
        OPERATIONS CONTROL
      </span>
    </header>
  )
}
