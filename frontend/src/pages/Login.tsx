import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react'
import { login } from '../services/auth.service'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login({ email, password })
      setUser(user)
      navigate('/', { replace: true })
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        'Invalid credentials. Please try again.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-slate-950 flex items-center justify-center px-4'>
      <div className='w-full max-w-sm'>
        {/* Logo */}
        <div className='flex flex-col items-center mb-8 gap-3'>
          <div className='h-14 w-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center'>
            <ShieldCheck className='h-7 w-7 text-blue-400' />
          </div>
          <div className='text-center'>
            <h1 className='text-xl font-bold text-white'>SafeVision AI</h1>
            <p className='text-sm text-slate-500 mt-0.5'>PPE Compliance Monitoring</p>
          </div>
        </div>

        {/* Card */}
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl'>
          <h2 className='text-base font-semibold text-white mb-5'>Sign in to your account</h2>

          <form onSubmit={handleSubmit} className='space-y-4'>
            {/* Email */}
            <div>
              <label className='block text-xs text-slate-400 mb-1.5'>Email address</label>
              <input
                type='email'
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='admin@example.com'
                className='w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors'
              />
            </div>

            {/* Password */}
            <div>
              <label className='block text-xs text-slate-400 mb-1.5'>Password</label>
              <div className='relative'>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder='••••••••'
                  className='w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors'
                />
                <button
                  type='button'
                  onClick={() => setShowPwd((v) => !v)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors'
                >
                  {showPwd ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className='text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2'>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type='submit'
              disabled={loading}
              className='w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors mt-2'
            >
              {loading ? (
                <>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
