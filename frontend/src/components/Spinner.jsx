export default function Spinner() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-srg-black">
      <div className="h-8 w-8 rounded-full border-2 border-srg-border border-t-srg-yellow animate-spin" />
    </div>
  )
}
