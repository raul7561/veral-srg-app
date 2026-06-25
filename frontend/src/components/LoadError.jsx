import { useTranslation } from 'react-i18next'
import { btn } from '../styles'

export default function LoadError({ message, onRetry }) {
  const { t } = useTranslation()
  return (
    <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
      <p className="text-srg-red font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className={btn.secondary}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}
