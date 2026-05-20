import { useState } from 'react'
import { Bell, Search, RefreshCw, Moon, Sun } from 'lucide-react'

export default function Header() {
  const [darkMode, setDarkMode] = useState(true)
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className='flex items-center justify-between gap-4'>
      <div>
        <h1 className='text-xl font-bold tracking-tight'>
          AI CCTV Monitoring
        </h1>
        <p className='text-slate-500 text-sm mt-0.5'>
          PPE Compliance & Productivity Analytics
        </p>
      </div>

      <div className='flex items-center gap-3 ml-auto'>
        {/* Time */}
        <div className='hidden md:flex flex-col items-end'>
          <span className='text-sm font-mono font-semibold text-slate-200'>{timeStr}</span>
          <span className='text-xs text-slate-500'>{dateStr}</span>
        </div>

        {/* Search */}
        <div className='relative hidden sm:block'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500' />
          <input
            placeholder='Search cameras...'
            className='bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-blue-500 transition-colors w-48'
          />
        </div>

        {/* Refresh */}
        <button className='p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition-colors'>
          <RefreshCw className='h-4 w-4 text-slate-400' />
        </button>

        {/* Dark toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className='p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition-colors'
        >
          {darkMode ? <Moon className='h-4 w-4 text-slate-400' /> : <Sun className='h-4 w-4 text-amber-400' />}
        </button>

        {/* Notifications */}
        <button className='relative p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition-colors'>
          <Bell className='h-4 w-4 text-slate-400' />
          <span className='absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full' />
        </button>

        {/* Avatar */}
        <div className='h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold flex-shrink-0'>
          S
        </div>
      </div>
    </div>
  )
}