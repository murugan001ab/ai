import { useEffect } from 'react'
import {
  ShieldCheck, AlertTriangle, Users, MapPin, Camera,
  TrendingUp, Bell, CheckCheck, Wifi, AlertCircle, RefreshCw, Loader2,
} from 'lucide-react'
import { usePPESummary }  from '../features/ppe/usePPESummary'
import { usePPEEvents }   from '../features/ppe/usePPEEvents'
import { useWS }          from '../contexts/WSContext'
import AlertsPanel        from '../components/AlertsPanel'
import type { Alert }     from '../types/dashboard'

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') ?? 'http://localhost:8000'

// ── PPE badge ─────────────────────────────────────────────────────────────

const PPE_COLORS: Record<string, string> = {
  helmet:  'bg-red-400/10 text-red-400 border-red-400/20',
  gloves:  'bg-orange-400/10 text-orange-400 border-orange-400/20',
  vest:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  boots:   'bg-purple-400/10 text-purple-400 border-purple-400/20',
  goggles: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
}
function PPEBadge({ item }: { item: string }) {
  const cls = PPE_COLORS[item.toLowerCase()] ?? 'bg-slate-700/50 text-slate-400 border-slate-600/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${cls}`}>
      {item}
    </span>
  )
}

// ── WS status indicator ────────────────────────────────────────────────────

function WSStatus() {
  const { status, reconnect } = useWS()
  const cfg = {
    connected:    { dot: 'bg-green-400 animate-pulse', label: 'Live'         },
    connecting:   { dot: 'bg-amber-400 animate-pulse', label: 'Connecting…'  },
    disconnected: { dot: 'bg-slate-500',               label: 'Disconnected' },
    error:        { dot: 'bg-red-400',                 label: 'Error'        },
  }[status]

  return (
    <div className='flex items-center gap-2'>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      <span className='text-xs text-slate-400'>{cfg.label}</span>
      {(status === 'disconnected' || status === 'error') && (
        <button onClick={reconnect} className='flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 ml-1'>
          <RefreshCw className='h-3 w-3' /> Reconnect
        </button>
      )}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, color, bg }: {
  title: string; value: string | number; sub?: string
  icon: React.ElementType; color: string; bg: string
}) {
  return (
    <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 hover:border-slate-600 transition-all'>
      <div className='flex items-center justify-between'>
        <span className='text-xs text-slate-400 font-medium uppercase tracking-wide'>{title}</span>
        <div className={`${bg} p-2 rounded-lg`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className='text-xs text-slate-500 mt-0.5'>{sub}</p>}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const summary = usePPESummary()
  const { events, clear } = usePPEEvents()

  // Re-fetch summary when a new WS event arrives (debounced inside hook)
  const { subscribe } = useWS()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return subscribe((msg) => {
      if (msg.type !== 'ppe-events') return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => summary.refetch(), 3000)
    })
  }, [subscribe, summary.refetch])

  const s = summary.data

  // Convert live WS events → AlertsPanel shape
  const liveAlerts: Alert[] = events.slice(0, 15).map((ev) => ({
    id:           ev.id,
    message:      `Missing ${ev.missing_ppe.join(', ')}`,
    camera:       ev.camera,
    severity:     'critical' as const,
    timestamp:    ev.timestamp,
    acknowledged: false,
  }))

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>

      {/* Header */}
      <div className='px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0'>
        <div>
          <h1 className='text-base font-bold text-white'>Dashboard</h1>
          <p className='text-xs text-slate-500'>Real-time PPE compliance overview</p>
        </div>
        <div className='flex items-center gap-4'>
          <WSStatus />
          <button
            onClick={summary.refetch}
            disabled={summary.loading}
            className='p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors'
            title='Refresh summary'
          >
            <RefreshCw className={`h-4 w-4 ${summary.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto px-6 py-6 space-y-6'>

        {/* ── Summary top cards ──────────────────────────────────────── */}
        {summary.loading && !s ? (
          <div className='flex items-center justify-center py-10'>
            <Loader2 className='h-6 w-6 animate-spin text-slate-500' />
          </div>
        ) : summary.error ? (
          <div className='bg-red-400/10 border border-red-400/20 rounded-2xl p-4 text-sm text-red-400 flex items-center gap-2'>
            <AlertCircle className='h-4 w-4 flex-shrink-0' />
            {summary.error}
          </div>
        ) : (
          <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4'>
            <StatCard
              title="Today's Violations"
              value={s?.today_total_violations ?? '—'}
              icon={AlertTriangle}
              color='text-red-400'
              bg='bg-red-400/10'
            />
            <StatCard
              title='Compliance Rate'
              value={s ? `${s.today_compliance_rate.toFixed(1)}%` : '—'}
              sub='today'
              icon={ShieldCheck}
              color='text-green-400'
              bg='bg-green-400/10'
            />
            <StatCard
              title='Active Cameras'
              value={s?.active_cameras ?? '—'}
              icon={Camera}
              color='text-blue-400'
              bg='bg-blue-400/10'
            />
            <StatCard
              title='Zones Affected'
              value={s?.zones_with_violations ?? '—'}
              sub='with violations'
              icon={MapPin}
              color='text-amber-400'
              bg='bg-amber-400/10'
            />
            <StatCard
              title='Most Missing'
              value={s?.most_missing_item ?? '—'}
              sub='PPE item today'
              icon={TrendingUp}
              color='text-purple-400'
              bg='bg-purple-400/10'
            />
          </div>
        )}

        {/* ── Live feed + Alerts ─────────────────────────────────────── */}
        <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>

          {/* Live violation feed */}
          <div className='xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col'>
            <div className='flex items-center justify-between mb-4 flex-shrink-0'>
              <div className='flex items-center gap-2'>
                <Bell className='h-4 w-4 text-slate-400' />
                <h2 className='text-sm font-semibold text-white'>Live Violation Feed</h2>
                {events.length > 0 && (
                  <span className='text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full'>
                    {events.length}
                  </span>
                )}
              </div>
              {events.length > 0 && (
                <button
                  onClick={clear}
                  className='text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors'
                >
                  <CheckCheck className='h-3 w-3' /> Clear
                </button>
              )}
            </div>

            <div className='space-y-2 overflow-y-auto max-h-[420px] pr-1 flex-1'>
              {events.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-14 text-slate-600 gap-3'>
                  <Wifi className='h-8 w-8' />
                  <p className='text-sm'>Waiting for live events…</p>
                </div>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className='bg-slate-950 border border-slate-800 border-l-2 border-l-red-500 rounded-xl p-3 flex gap-3'
                  >
                    {ev.image_path && (
                      <img
                        src={`${API_BASE}/${ev.image_path}`}
                        alt='frame'
                        className='h-14 w-20 object-cover rounded-lg flex-shrink-0 bg-slate-800'
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <p className='text-sm font-medium text-white'>{ev.worker_id}</p>
                          <p className='text-xs text-slate-500'>{ev.zone}</p>
                        </div>
                        <span className='text-[10px] text-slate-600 flex-shrink-0 mt-0.5'>
                          {ev.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className='flex flex-wrap gap-1 mt-2'>
                        {ev.missing_ppe.map((item) => <PPEBadge key={item} item={item} />)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <AlertsPanel alerts={liveAlerts} />
        </div>

      </div>
    </div>
  )
}
