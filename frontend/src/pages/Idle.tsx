// ─────────────────────────────────────────────────────────────────────────────
// Idle.tsx  –  Real-time idle worker monitor via WebSocket
//
// WebSocket event shape:
// {
//   "type": "idle-events",
//   "data": {
//     "event_type": "idle-events",
//     "camera_id": 1,
//     "zone_id": 1,
//     "name": "Unknown",
//     "idle_duration": 15,          // seconds
//     "image_path": "idle_2_20260528_141832.jpg",
//     "timestamp": 1779958111       // Unix epoch (seconds)
//   }
// }
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import {
  Clock,
  Camera,
  MapPin,
  User,
  Wifi,
  WifiOff,
  Loader2,
  TimerOff,
  Activity,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  RefreshCw,
} from 'lucide-react'
import { useWS } from '../contexts/WSContext'

// ── Env ───────────────────────────────────────────────────────────────────────
const IMAGE_BASE_URL =
  `${import.meta.env.VITE_API_BASE_IMAGE_URL ?? 'http://localhost:8080'}/idle_captures`

const MAX_EVENTS = 60 // keep last N events in memory

// ── Types ─────────────────────────────────────────────────────────────────────
interface IdleEvent {
  /** synthetic key assigned on receive */
  id: string
  event_type: string
  camera_id: number
  zone_id: number
  name: string
  idle_duration: number // seconds
  image_path: string
  timestamp: number // unix epoch (s)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTs(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

/**
 * Returns colour tokens based on idle severity:
 *   < 60s  → amber (warning)
 *   ≥ 60s  → red   (critical)
 */
function severityTokens(seconds: number) {
  if (seconds >= 60) {
    return {
      ring:   'ring-red-500/40',
      border: 'border-red-500/25',
      bg:     'bg-red-500/5',
      badge:  'bg-red-500/15 text-red-400 border-red-500/30',
      bar:    'bg-gradient-to-r from-red-600 to-red-400',
      icon:   'text-red-400',
      label:  'Critical',
    }
  }
  return {
    ring:   'ring-amber-500/40',
    border: 'border-amber-500/25',
    bg:     'bg-amber-500/5',
    badge:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
    bar:    'bg-gradient-to-r from-amber-600 to-amber-400',
    icon:   'text-amber-400',
    label:  'Warning',
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WSStatusChip() {
  const { status, reconnect } = useWS()

  const map = {
    connected:    { color: 'text-green-400', dot: 'bg-green-500',                  Icon: Wifi,     label: 'Live' },
    connecting:   { color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse',  Icon: Loader2,  label: 'Connecting' },
    disconnected: { color: 'text-slate-500',  dot: 'bg-slate-600',                 Icon: WifiOff,  label: 'Disconnected' },
    error:        { color: 'text-red-400',    dot: 'bg-red-500',                   Icon: WifiOff,  label: 'Error' },
  }

  const { color, dot, Icon, label } = map[status]

  return (
    <div className='flex items-center gap-2'>
      <div className={`flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 px-2.5 py-1.5 rounded-lg ${color}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <Icon className={`h-3.5 w-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`} />
        <span className='text-[10px] font-semibold uppercase tracking-wider'>{label}</span>
      </div>
      {(status === 'disconnected' || status === 'error') && (
        <button
          onClick={reconnect}
          className='flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800 border border-slate-800'
        >
          <RefreshCw className='h-3 w-3' />
          Reconnect
        </button>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  bg: string
}) {
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className='flex items-center justify-between mb-2'>
        <p className='text-[10px] text-slate-500 uppercase tracking-widest font-semibold'>{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className={`text-3xl font-black tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function DurationBar({ seconds }: { seconds: number }) {
  // Visual bar capped at 5 minutes (300s)
  const pct = Math.min((seconds / 300) * 100, 100)
  const tk = severityTokens(seconds)
  return (
    <div className='w-full h-1.5 bg-slate-800 rounded-full overflow-hidden'>
      <div
        className={`h-full ${tk.bar} rounded-full transition-all duration-500`}
        style={{ width: `${Math.max(pct, 4)}%` }}
      />
    </div>
  )
}

function EventCard({ event, isLatest }: { event: IdleEvent; isLatest: boolean }) {
  const [imgErr, setImgErr] = useState(false)
  const tk = severityTokens(event.idle_duration)
  const imgUrl = `${IMAGE_BASE_URL}/${event.image_path}`

  return (
    <div
      className={`relative flex gap-4 p-4 rounded-2xl border transition-all duration-300
        ${tk.bg} ${tk.border}
        ${isLatest ? `ring-2 ${tk.ring} shadow-lg` : ''}
      `}
    >
      {/* NEW badge */}
      {isLatest && (
        <span className='absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white tracking-wider shadow-md'>
          NEW
        </span>
      )}

      {/* Snapshot */}
      <div className='flex-shrink-0'>
        <div className='h-20 w-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center'>
          {imgErr ? (
            <User className='h-8 w-8 text-slate-600' />
          ) : (
            <img
              src={imgUrl}
              alt={`Idle – ${event.name}`}
              className='h-full w-full object-cover'
              onError={() => setImgErr(true)}
            />
          )}
        </div>
      </div>

      {/* Info */}
      <div className='flex-1 min-w-0 space-y-2'>
        {/* Top row */}
        <div className='flex items-start justify-between gap-2 flex-wrap'>
          <div>
            <p className='text-sm font-semibold text-white truncate'>{event.name}</p>
            <p className='text-[11px] text-slate-500 mt-0.5'>{event.event_type}</p>
          </div>
          {/* Severity badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${tk.badge}`}>
            <AlertTriangle className='h-3 w-3' />
            {tk.label}
          </span>
        </div>

        {/* Metadata grid */}
        <div className='grid grid-cols-2 gap-x-4 gap-y-1.5'>
          <div className='flex items-center gap-1.5 text-xs text-slate-400'>
            <Camera className={`h-3.5 w-3.5 text-slate-500`} />
            Camera {event.camera_id}
          </div>
          <div className='flex items-center gap-1.5 text-xs text-slate-400'>
            <MapPin className='h-3.5 w-3.5 text-slate-500' />
            Zone {event.zone_id}
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${tk.icon}`}>
            <Clock className='h-3.5 w-3.5' />
            Idle {formatDuration(event.idle_duration)}
          </div>
          <div className='flex items-center gap-1.5 text-xs text-slate-400'>
            <Activity className='h-3.5 w-3.5 text-slate-500' />
            {formatTs(event.timestamp)}
          </div>
        </div>

        {/* Duration visual bar */}
        <DurationBar seconds={event.idle_duration} />
      </div>
    </div>
  )
}

/** Mini bar chart of idle events per camera ID */
function CameraChart({ events }: { events: IdleEvent[] }) {
  if (events.length === 0) return null

  const counts: Record<number, number> = {}
  for (const e of events) {
    counts[e.camera_id] = (counts[e.camera_id] ?? 0) + 1
  }
  const entries = Object.entries(counts)
    .map(([cam, cnt]) => ({ cam: Number(cam), cnt }))
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 8)

  const max = Math.max(...entries.map((e) => e.cnt), 1)

  return (
    <div className='flex items-end gap-2 h-24 px-1'>
      {entries.map(({ cam, cnt }) => {
        const pct = (cnt / max) * 100
        return (
          <div key={cam} className='flex-1 flex flex-col items-center gap-1 group cursor-default'>
            <div className='relative w-full flex items-end justify-center' style={{ height: '72px' }}>
              <div
                className='w-full bg-amber-500 group-hover:brightness-125 rounded-t-sm transition-all duration-300 relative'
                style={{ height: `${Math.max(pct, 4)}%`, opacity: 0.6 + (pct / 100) * 0.4 }}
              >
                <span className='absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-900 px-1 rounded'>
                  {cnt}
                </span>
              </div>
            </div>
            <span className='text-[9px] text-slate-500'>C{cam}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Longest idle event leaderboard */
function TopIdlers({ events }: { events: IdleEvent[] }) {
  if (events.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-6 gap-2 text-slate-600'>
        <TimerOff className='h-8 w-8 opacity-30' />
        <p className='text-sm'>No events yet</p>
      </div>
    )
  }

  const top = [...events]
    .sort((a, b) => b.idle_duration - a.idle_duration)
    .slice(0, 5)

  const maxDur = top[0].idle_duration

  return (
    <div className='space-y-3'>
      {top.map((e, i) => {
        const tk = severityTokens(e.idle_duration)
        const pct = (e.idle_duration / maxDur) * 100
        return (
          <div key={e.id} className='flex items-center gap-3'>
            <span className='text-[10px] font-bold text-slate-600 w-4 text-right flex-shrink-0'>
              {i + 1}
            </span>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center justify-between mb-1'>
                <span className='text-xs font-medium text-slate-300 truncate'>{e.name}</span>
                <span className={`text-xs font-bold tabular-nums ${tk.icon}`}>
                  {formatDuration(e.idle_duration)}
                </span>
              </div>
              <div className='h-1.5 bg-slate-800 rounded-full overflow-hidden'>
                <div
                  className={`h-full ${tk.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Idle() {
  const { status, subscribe } = useWS()
  const [events, setEvents] = useState<IdleEvent[]>([])
  const counterRef = useRef(0)

  // Subscribe to idle-events from WebSocket
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type !== 'idle-events') return
      const d = msg.data as Omit<IdleEvent, 'id'>
      const event: IdleEvent = {
        ...d,
        id: `idle-${++counterRef.current}-${Date.now()}`,
      }
      setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS))
    })
    return unsub
  }, [subscribe])

  const critical = events.filter((e) => e.idle_duration >= 60)
  const warning  = events.filter((e) => e.idle_duration < 60)
  const avgIdle  = events.length
    ? Math.round(events.reduce((sum, e) => sum + e.idle_duration, 0) / events.length)
    : 0

  return (
    <div className='flex-1 overflow-auto bg-slate-950 p-5 space-y-5'>

      {/* ── Background grid ──────────────────────────────────────────────────── */}
      <div
        className='fixed inset-0 pointer-events-none'
        style={{
          backgroundImage:
            'linear-gradient(rgba(251,191,36,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.025) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          zIndex: 0,
        }}
      />

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className='relative flex items-center justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-3'>
          <div className='relative h-10 w-10 rounded-xl bg-gradient-to-br from-amber-600/30 to-orange-700/30 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10'>
            <TimerOff className='h-5 w-5 text-amber-400' />
            <span className='absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-slate-950' />
          </div>
          <div>
            <h1 className='text-base font-black text-white tracking-tight'>Idle Monitor</h1>
            <p className='text-[11px] text-slate-500'>Real-time idle worker detection via WebSocket</p>
          </div>
        </div>
        <WSStatusChip />
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────────────── */}
      <div className='relative grid grid-cols-2 xl:grid-cols-4 gap-4'>
        <StatCard
          label='Total Events'
          value={events.length}
          icon={Activity}
          color='text-blue-400'
          bg='bg-blue-500/10 border border-blue-500/20'
        />
        <StatCard
          label='Critical (≥1 min)'
          value={critical.length}
          icon={AlertTriangle}
          color='text-red-400'
          bg='bg-red-500/10 border border-red-500/20'
        />
        <StatCard
          label='Warnings (<1 min)'
          value={warning.length}
          icon={Clock}
          color='text-amber-400'
          bg='bg-amber-500/10 border border-amber-500/20'
        />
        <StatCard
          label='Avg Idle Time'
          value={formatDuration(avgIdle)}
          icon={TrendingUp}
          color='text-cyan-400'
          bg='bg-cyan-500/10 border border-cyan-500/20'
        />
      </div>

      {/* ── Main 2-column layout ─────────────────────────────────────────────── */}
      <div className='relative grid grid-cols-1 xl:grid-cols-3 gap-5'>

        {/* Left col: event feed (2/3 width) */}
        <div className='xl:col-span-2 space-y-4'>

          {/* Critical */}
          <section>
            <h2 className='text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2'>
              <AlertTriangle className='h-3.5 w-3.5' />
              Critical — ≥ 1 min ({critical.length})
            </h2>

            {critical.length === 0 ? (
              <div className='flex flex-col items-center justify-center h-32 rounded-2xl border border-dashed border-slate-800 text-slate-600 text-sm gap-2'>
                <TimerOff className='h-7 w-7 opacity-30' />
                No critical idle events
              </div>
            ) : (
              <div className='space-y-3'>
                {critical.map((e, i) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    isLatest={i === 0 && events[0]?.id === e.id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Warning */}
          <section>
            <h2 className='text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2'>
              <Clock className='h-3.5 w-3.5' />
              Warnings — &lt; 1 min ({warning.length})
            </h2>

            {warning.length === 0 ? (
              <div className='flex flex-col items-center justify-center h-32 rounded-2xl border border-dashed border-slate-800 text-slate-600 text-sm gap-2'>
                <Clock className='h-7 w-7 opacity-30' />
                No warning-level idle events
              </div>
            ) : (
              <div className='space-y-3'>
                {warning.map((e, i) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    isLatest={i === 0 && events[0]?.id === e.id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right col: analytics panels (1/3 width) */}
        <div className='space-y-4'>

          {/* Events by Camera */}
          <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
            <div className='flex items-center gap-2 mb-4'>
              <BarChart3 className='h-4 w-4 text-slate-400' />
              <h3 className='text-xs font-bold text-slate-300 uppercase tracking-widest'>
                Events by Camera
              </h3>
            </div>
            <CameraChart events={events} />
            {events.length === 0 && (
              <div className='flex flex-col items-center py-6 gap-2 text-slate-600'>
                <BarChart3 className='h-8 w-8 opacity-30' />
                <p className='text-sm'>No data yet</p>
              </div>
            )}
          </div>

          {/* Top Idlers */}
          <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
            <div className='flex items-center gap-2 mb-4'>
              <TrendingUp className='h-4 w-4 text-slate-400' />
              <h3 className='text-xs font-bold text-slate-300 uppercase tracking-widest'>
                Longest Idle
              </h3>
            </div>
            <TopIdlers events={events} />
          </div>

          {/* Zone distribution */}
          <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
            <div className='flex items-center gap-2 mb-4'>
              <MapPin className='h-4 w-4 text-slate-400' />
              <h3 className='text-xs font-bold text-slate-300 uppercase tracking-widest'>
                Zones Affected
              </h3>
            </div>
            {events.length === 0 ? (
              <div className='flex flex-col items-center py-6 gap-2 text-slate-600'>
                <MapPin className='h-8 w-8 opacity-30' />
                <p className='text-sm'>No zones yet</p>
              </div>
            ) : (
              <div className='space-y-2'>
                {Array.from(new Set(events.map((e) => e.zone_id))).map((zid) => {
                  const cnt = events.filter((e) => e.zone_id === zid).length
                  return (
                    <div key={zid} className='flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0'>
                      <div className='flex items-center gap-2 text-xs text-slate-300'>
                        <MapPin className='h-3.5 w-3.5 text-slate-500' />
                        Zone {zid}
                      </div>
                      <span className='text-xs font-bold text-amber-400 tabular-nums'>
                        {cnt} event{cnt !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Empty / waiting state ─────────────────────────────────────────────── */}
      {events.length === 0 && status === 'connected' && (
        <div className='flex flex-col items-center justify-center py-20 text-slate-600 gap-3'>
          <div className='relative'>
            <Wifi className='h-10 w-10 text-green-500/40' />
          </div>
          <p className='text-sm'>Connected — waiting for idle events…</p>
          <p className='text-[11px] text-slate-700'>
            Events will appear here as workers are detected idle
          </p>
        </div>
      )}
    </div>
  )
}
