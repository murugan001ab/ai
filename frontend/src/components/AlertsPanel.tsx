import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, CheckCheck, Bell } from 'lucide-react'
import type { Alert } from '../types/dashboard'

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

export default function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const [items, setItems] = useState(alerts)
  const unread = items.filter((a) => !a.acknowledged).length

  const acknowledge = (id: string) =>
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)))

  const severityConfig = {
    critical: { icon: AlertTriangle, dot: 'bg-red-500', badge: 'bg-red-500/10 text-red-400 border-red-500/20', border: 'border-l-red-500', label: 'Critical' },
    warning:  { icon: AlertCircle,  dot: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', border: 'border-l-amber-500', label: 'Warning' },
    info:     { icon: Info,         dot: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', border: 'border-l-blue-500', label: 'Info' },
  }

  return (
    <div className='bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col'>
      <div className='flex items-center justify-between mb-5'>
        <div className='flex items-center gap-2'>
          <Bell className='h-5 w-5 text-slate-400' />
          <h2 className='text-lg font-semibold'>Recent Alerts</h2>
          {unread > 0 && (
            <span className='text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full'>{unread}</span>
          )}
        </div>
        <button
          onClick={() => setItems((prev) => prev.map((a) => ({ ...a, acknowledged: true })))}
          className='text-xs text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1'
        >
          <CheckCheck className='h-3 w-3' /> All read
        </button>
      </div>

      <div className='space-y-3 flex-1 overflow-y-auto'>
        {items.map((alert) => {
          const cfg = severityConfig[alert.severity]
          const Icon = cfg.icon
          return (
            <div
              key={alert.id}
              className={`bg-slate-950 border border-slate-800 border-l-2 ${cfg.border} rounded-xl p-3.5 transition-opacity duration-200 ${alert.acknowledged ? 'opacity-50' : ''}`}
            >
              <div className='flex items-start gap-3'>
                <div className={`${cfg.dot} h-2 w-2 rounded-full mt-1.5 flex-shrink-0`} />
                <div className='flex-1 min-w-0'>
                  <div className='flex items-start justify-between gap-2'>
                    <p className='text-sm font-medium leading-tight'>{alert.message}</p>
                    {!alert.acknowledged && (
                      <button onClick={() => acknowledge(alert.id)} className='flex-shrink-0 text-slate-500 hover:text-blue-400 transition-colors'>
                        <CheckCheck className='h-3.5 w-3.5' />
                      </button>
                    )}
                  </div>
                  <div className='flex items-center gap-2 mt-1.5'>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${cfg.badge} flex items-center gap-1`}>
                      <Icon className='h-2.5 w-2.5' />
                      {cfg.label}
                    </span>
                    <span className='text-xs text-slate-500'>{alert.camera}</span>
                    <span className='text-xs text-slate-600 ml-auto'>{timeAgo(alert.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
