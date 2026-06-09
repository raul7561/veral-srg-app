export default function Spinner() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-srg-black">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#333333] border-t-srg-yellow" />
    </div>
  )
}
