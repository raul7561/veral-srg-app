export default function Button({ children, variant = "primary", size = "md", disabled, onClick, type = "button", className = "" }) {
  const base = "inline-flex items-center justify-center font-bold uppercase tracking-wide rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

  const variants = {
    primary: "bg-[#F5A800] text-[#111111] hover:bg-yellow-400",
    secondary: "border border-[#D8D0C0] text-[#111111] bg-transparent hover:bg-[#F5F0E8]",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-[#F5A800] bg-transparent hover:underline",
  }

  const sizes = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-sm px-6 py-3",
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}