import { X, Save, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  onSave: () => void
  saving?: boolean
  saveLabel?: string
  error?: string | null
  children: ReactNode
}

/**
 * Generic modal shell — header, scrollable body, footer with Cancel / Save.
 * Feature modals drop their fields in as children.
 */
export default function Modal({
  title,
  onClose,
  onSave,
  saving = false,
  saveLabel = 'Save',
  error,
  children,
}: Props) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl flex flex-col max-h-[90vh]'>

        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0'>
          <h2 className='text-base font-semibold text-white'>{title}</h2>
          <button
            onClick={onClose}
            className='text-slate-500 hover:text-white transition-colors'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {/* Body */}
        <div className='p-6 space-y-4 overflow-y-auto flex-1'>
          {children}
          {error && (
            <p className='text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2'>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className='flex gap-3 px-6 py-4 border-t border-slate-800 flex-shrink-0'>
          <button
            onClick={onClose}
            className='flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition-colors'
          >
            {saving
              ? <Loader2 className='h-4 w-4 animate-spin' />
              : <Save className='h-4 w-4' />
            }
            {saveLabel}
          </button>
        </div>

      </div>
    </div>
  )
}
