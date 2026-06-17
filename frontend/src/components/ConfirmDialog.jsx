import { useEffect } from 'react'
import { btn } from '../styles'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md border border-srg-border rounded-lg bg-srg-surface shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-t-4 border-srg-yellow rounded-t-lg" />
        <div className="p-6">
          <h2 className="text-lg font-extrabold uppercase tracking-wide text-srg-black mb-2">
            {title}
          </h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            {message}
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className={btn.secondary}>
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={destructive ? btn.destructive : btn.primary}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
