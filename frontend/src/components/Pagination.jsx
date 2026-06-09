export default function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.ceil(total / limit)

  if (totalPages <= 1) return null

  const pages = []
  for (let i = 1; i <= totalPages; i += 1) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - 1 && i <= page + 1)
    ) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }

  const buttonBase = 'border border-srg-border rounded px-3 py-1 text-sm'
  const disabled = 'opacity-50 cursor-not-allowed'

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className={`${buttonBase} ${page === 1 ? disabled : 'hover:bg-srg-cream'}`}
      >
        Prev
      </button>

      {pages.map((item, index) => (
        item === '…' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-srg-border">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={`${buttonBase} ${
              item === page
                ? 'bg-srg-black text-srg-yellow'
                : 'hover:bg-srg-cream'
            }`}
          >
            {item}
          </button>
        )
      ))}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className={`${buttonBase} ${page === totalPages ? disabled : 'hover:bg-srg-cream'}`}
      >
        Next
      </button>
    </div>
  )
}
