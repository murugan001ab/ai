import { useState, type FormEvent } from 'react'
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Lock,
} from 'lucide-react'
import apiClient from '../lib/axios'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'idle' | 'verifying' | 'verified' | 'changing' | 'done'

interface FieldState {
  value: string
  show: boolean
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function verifyPassword(current_password: string): Promise<void> {
  await apiClient.post('/users/me/verify', { current_password })
}

async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient.patch('/users/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PasswordInput({
  label,
  field,
  onChange,
  onToggle,
  disabled,
  autoFocus,
  hint,
}: {
  label: string
  field: FieldState
  onChange: (v: string) => void
  onToggle: () => void
  disabled?: boolean
  autoFocus?: boolean
  hint?: string
}) {
  return (
    <div className='space-y-1.5'>
      <label className='block text-xs font-medium text-slate-400'>{label}</label>
      <div className='relative'>
        <input
          type={field.show ? 'text' : 'password'}
          required
          autoFocus={autoFocus}
          disabled={disabled}
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          placeholder='••••••••'
          className='w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 pr-10 text-sm text-white
            placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed'
        />
        <button
          type='button'
          onClick={onToggle}
          disabled={disabled}
          className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors'
        >
          {field.show ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
        </button>
      </div>
      {hint && <p className='text-xs text-slate-500'>{hint}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Setting() {
  // Step tracker
  const [step, setStep] = useState<Step>('idle')

  // Step 1 – verify current password
  const [current, setCurrent] = useState<FieldState>({ value: '', show: false })

  // Step 2 – new passwords
  const [newPwd, setNewPwd] = useState<FieldState>({ value: '', show: false })
  const [confirmPwd, setConfirmPwd] = useState<FieldState>({ value: '', show: false })

  // Feedback
  const [error, setError] = useState<string | null>(null)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const isLoading = step === 'verifying' || step === 'changing'

  function extractMessage(err: any): string {
    const detail = err?.response?.data?.detail ?? err?.response?.data?.message
    if (!detail) return 'Something went wrong. Please try again.'
    return typeof detail === 'string' ? detail : JSON.stringify(detail)
  }

  // ── Step 1: verify ─────────────────────────────────────────────────────────

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setStep('verifying')
    try {
      await verifyPassword(current.value)
      setStep('verified')
    } catch (err: any) {
      setError(extractMessage(err))
      setStep('idle')
    }
  }

  // ── Step 2: change ─────────────────────────────────────────────────────────

  async function handleChange(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPwd.value !== confirmPwd.value) {
      setError('New passwords do not match.')
      return
    }
    if (newPwd.value.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setStep('changing')
    try {
      await changePassword(current.value, newPwd.value)
      setStep('done')
    } catch (err: any) {
      setError(extractMessage(err))
      setStep('verified')
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function handleReset() {
    setCurrent({ value: '', show: false })
    setNewPwd({ value: '', show: false })
    setConfirmPwd({ value: '', show: false })
    setError(null)
    setStep('idle')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className='min-h-screen bg-slate-950 px-4 py-10'>
      <div className='max-w-lg mx-auto space-y-6'>

        {/* Page header */}
        <div className='flex items-center gap-3 mb-2'>
          <div className='h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0'>
            <ShieldCheck className='h-5 w-5 text-blue-400' />
          </div>
          <div>
            <h1 className='text-lg font-bold text-white'>Settings</h1>
            <p className='text-xs text-slate-500'>Manage your account preferences</p>
          </div>
        </div>

        {/* ── Password Change Card ── */}
        <div className='bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden'>

          {/* Card header */}
          <div className='flex items-center gap-3 px-5 py-4 border-b border-slate-800'>
            <div className='h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center'>
              <KeyRound className='h-4 w-4 text-slate-400' />
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-semibold text-white'>Change Password</p>
              <p className='text-xs text-slate-500 truncate'>Update your account password</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className='flex items-center gap-0 px-5 py-3 bg-slate-900/50 border-b border-slate-800/50'>
            {/* Step 1 */}
            <div className='flex items-center gap-1.5'>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors
                ${step === 'idle' || step === 'verifying'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-green-500/20 border-green-500/50 text-green-400'}`}>
                {step !== 'idle' && step !== 'verifying' ? '✓' : '1'}
              </div>
              <span className={`text-xs transition-colors ${step === 'idle' || step === 'verifying' ? 'text-white' : 'text-slate-500'}`}>
                Verify
              </span>
            </div>

            <ChevronRight className='h-3.5 w-3.5 text-slate-700 mx-2' />

            {/* Step 2 */}
            <div className='flex items-center gap-1.5'>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors
                ${step === 'verified' || step === 'changing'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : step === 'done'
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                {step === 'done' ? '✓' : '2'}
              </div>
              <span className={`text-xs transition-colors
                ${step === 'verified' || step === 'changing' ? 'text-white'
                  : step === 'done' ? 'text-slate-500' : 'text-slate-600'}`}>
                New Password
              </span>
            </div>
          </div>

          {/* Card body */}
          <div className='px-5 py-5'>

            {/* ── Done state ── */}
            {step === 'done' && (
              <div className='flex flex-col items-center gap-4 py-4 text-center'>
                <div className='h-14 w-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center'>
                  <CheckCircle2 className='h-7 w-7 text-green-400' />
                </div>
                <div>
                  <p className='text-sm font-semibold text-white'>Password Updated</p>
                  <p className='text-xs text-slate-500 mt-1'>Your password has been changed successfully.</p>
                </div>
                <button
                  onClick={handleReset}
                  className='text-xs text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2'
                >
                  Change password again
                </button>
              </div>
            )}

            {/* ── Step 1: Verify current password ── */}
            {(step === 'idle' || step === 'verifying') && (
              <form onSubmit={handleVerify} className='space-y-4'>
                <p className='text-xs text-slate-400 leading-relaxed'>
                  Enter your current password to confirm it's you before setting a new one.
                </p>

                <PasswordInput
                  label='Current password'
                  field={current}
                  onChange={(v) => setCurrent((s) => ({ ...s, value: v }))}
                  onToggle={() => setCurrent((s) => ({ ...s, show: !s.show }))}
                  disabled={isLoading}
                  autoFocus
                />

                {error && <ErrorBanner message={error} />}

                <button
                  type='submit'
                  disabled={isLoading || !current.value}
                  className='w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500
                    disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium
                    py-2.5 rounded-xl transition-colors'
                >
                  {step === 'verifying' ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <Lock className='h-4 w-4' />
                      Verify Password
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── Step 2: Set new password ── */}
            {(step === 'verified' || step === 'changing') && (
              <form onSubmit={handleChange} className='space-y-4'>
                <p className='text-xs text-slate-400 leading-relaxed'>
                  Choose a strong new password. It must be at least 8 characters long.
                </p>

                <PasswordInput
                  label='New password'
                  field={newPwd}
                  onChange={(v) => setNewPwd((s) => ({ ...s, value: v }))}
                  onToggle={() => setNewPwd((s) => ({ ...s, show: !s.show }))}
                  disabled={isLoading}
                  autoFocus
                  hint='Minimum 8 characters'
                />

                <PasswordInput
                  label='Confirm new password'
                  field={confirmPwd}
                  onChange={(v) => setConfirmPwd((s) => ({ ...s, value: v }))}
                  onToggle={() => setConfirmPwd((s) => ({ ...s, show: !s.show }))}
                  disabled={isLoading}
                />

                {error && <ErrorBanner message={error} />}

                <div className='flex gap-2 pt-1'>
                  <button
                    type='button'
                    onClick={handleReset}
                    disabled={isLoading}
                    className='flex-1 text-sm font-medium py-2.5 rounded-xl border border-slate-700
                      text-slate-400 hover:text-white hover:border-slate-600 transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    disabled={isLoading || !newPwd.value || !confirmPwd.value}
                    className='flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500
                      disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium
                      py-2.5 rounded-xl transition-colors'
                  >
                    {step === 'changing' ? (
                      <>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        Updating…
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className='flex items-start gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5'>
      <XCircle className='h-3.5 w-3.5 shrink-0 mt-0.5' />
      <span>{message}</span>
    </div>
  )
}
