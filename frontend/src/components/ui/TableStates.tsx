import { Loader2, AlertCircle, Inbox } from 'lucide-react'

interface LoadingProps { cols: number }
interface ErrorProps   { cols: number; message: string; onRetry: () => void }
interface EmptyProps   { cols: number; message?: string }

export function TableLoading({ cols }: LoadingProps) {
  return (
    <tr>
      <td colSpan={cols} className='py-20'>
        <div className='flex justify-center'>
          <Loader2 className='h-6 w-6 animate-spin text-slate-500' />
        </div>
      </td>
    </tr>
  )
}

export function TableError({ cols, message, onRetry }: ErrorProps) {
  return (
    <tr>
      <td colSpan={cols} className='py-20'>
        <div className='flex flex-col items-center gap-3'>
          <AlertCircle className='h-8 w-8 text-red-400' />
          <p className='text-sm text-red-400'>{message}</p>
          <button
            onClick={onRetry}
            className='text-xs text-slate-400 hover:text-white underline transition-colors'
          >
            Retry
          </button>
        </div>
      </td>
    </tr>
  )
}

export function TableEmpty({ cols, message = 'No records found.' }: EmptyProps) {
  return (
    <tr>
      <td colSpan={cols} className='py-20'>
        <div className='flex flex-col items-center gap-3'>
          <Inbox className='h-8 w-8 text-slate-600' />
          <p className='text-sm text-slate-500'>{message}</p>
        </div>
      </td>
    </tr>
  )
}
