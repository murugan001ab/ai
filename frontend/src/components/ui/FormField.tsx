import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

interface LabelProps { label: string; children: ReactNode }

/** Wraps any form control with a consistent label */
export function FormField({ label, children }: LabelProps) {
  return (
    <div>
      <label className='block text-xs text-slate-400 mb-1.5'>{label}</label>
      {children}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement>
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }

const inputCls =
  'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors'

export function Input(props: InputProps) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function Select({ children, ...props }: SelectProps) {
  return (
    <select {...props} className={`${inputCls} ${props.className ?? ''}`}>
      {children}
    </select>
  )
}

/** Toggle switch — controlled */
interface ToggleProps {
  checked: boolean
  onChange: (val: boolean) => void
  label: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <div className='flex items-center justify-between py-1'>
      <span className='text-sm text-slate-300'>{label}</span>
      <button
        type='button'
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
