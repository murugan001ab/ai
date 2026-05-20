import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  pages: number
  total: number
  onPrev: () => void
  onNext: () => void
}

export default function Pagination({ page, pages, total, onPrev, onNext }: Props) {
  return (
    <div className='flex items-center justify-between px-5 py-3 border-t border-slate-800'>
      <span className='text-xs text-slate-500'>{total} total</span>
      <div className='flex items-center gap-2'>
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className='p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
        >
          <ChevronLeft className='h-4 w-4' />
        </button>
        <span className='text-xs text-slate-400'>Page {page} of {pages || 1}</span>
        <button
          onClick={onNext}
          disabled={page >= pages}
          className='p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
        >
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>
    </div>
  )
}
