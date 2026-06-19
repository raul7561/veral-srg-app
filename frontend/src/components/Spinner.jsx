import logo from '../assets/srg_logo.png'

export default function Spinner() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-srg-black">
      <div className="relative flex items-center justify-center h-32 w-32">
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-srg-yellow animate-spin" />
        <img src={logo} alt="SRG" className="h-16 w-auto" />
      </div>
    </div>
  )
}
