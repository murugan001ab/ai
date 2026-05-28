import { useEffect, useState, useRef } from 'react'
import { useWS } from '../contexts/WSContext'
import { ShieldAlert, ShieldCheck, User, Camera, MapPin, Clock, Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface FaceEvent {
  id: string            // synthetic – assigned on receive
  event_name: string
  camera_id: number
  zone_id: number
  name: string
  similarity: number
  authorized: boolean
  image_path: string
  timestamp: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const IMAGE_BASE_URL =
  `${import.meta.env.VITE_API_BASE_IMAGE_URL ?? 'http://localhost:8080'}/facecaptures`
const MAX_EVENTS     = 50   // keep the last N events in memory

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTs(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

function similarityLabel(sim: number) {
  if (sim >= 0.8) return { text: 'High', color: 'text-green-400' }
  if (sim >= 0.5) return { text: 'Medium', color: 'text-yellow-400' }
  return { text: 'Low', color: 'text-red-400' }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ authorized }: { authorized: boolean }) {
  return authorized ? (
    <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30'>
      <ShieldCheck className='h-3.5 w-3.5' />
      Authorized
    </span>
  ) : (
    <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30'>
      <ShieldAlert className='h-3.5 w-3.5' />
      Unauthorized
    </span>
  )
}

function EventCard({ event, isLatest }: { event: FaceEvent; isLatest: boolean }) {
  const [imgErr, setImgErr] = useState(false)
  const sim = similarityLabel(event.similarity)
  const imgUrl = `${IMAGE_BASE_URL}/${event.image_path}`

  return (
    <div
      className={`relative flex gap-4 p-4 rounded-2xl border transition-all duration-300
        ${event.authorized
          ? 'bg-green-500/5 border-green-500/20'
          : 'bg-red-500/5 border-red-500/20'}
        ${isLatest ? 'ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10' : ''}
      `}
    >
      {/* NEW badge */}
      {isLatest && (
        <span className='absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white tracking-wider'>
          NEW
        </span>
      )}

      {/* Person image */}
      <div className='flex-shrink-0'>
        <div className='h-20 w-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center'>
          {imgErr ? (
            <User className='h-8 w-8 text-slate-500' />
          ) : (
            <img
              src={imgUrl}
              alt={event.name}
              className='h-full w-full object-cover'
              onError={() => setImgErr(true)}
            />
          )}
        </div>
      </div>

      {/* Info */}
      <div className='flex-1 min-w-0 space-y-2'>
        <div className='flex items-start justify-between gap-2 flex-wrap'>
          <div>
            <p className='text-sm font-semibold text-white truncate'>{event.name}</p>
            <p className='text-xs text-slate-500 mt-0.5'>{event.event_name}</p>
          </div>
          <StatusBadge authorized={event.authorized} />
        </div>

        <div className='grid grid-cols-2 gap-x-4 gap-y-1.5'>
          <div className='flex items-center gap-1.5 text-xs text-slate-400'>
            <Camera className='h-3.5 w-3.5 text-slate-500' />
            Camera {event.camera_id}
          </div>
          <div className='flex items-center gap-1.5 text-xs text-slate-400'>
            <MapPin className='h-3.5 w-3.5 text-slate-500' />
            Zone {event.zone_id}
          </div>
          <div className='flex items-center gap-1.5 text-xs text-slate-400'>
            <span className='text-slate-500 text-[10px] font-medium uppercase tracking-wider'>Sim</span>
            <span className={`font-semibold ${sim.color}`}>
              {(event.similarity * 100).toFixed(1)}% — {sim.text}
            </span>
          </div>
          <div className='flex items-center gap-1.5 text-xs text-slate-400'>
            <Clock className='h-3.5 w-3.5 text-slate-500' />
            {formatTs(event.timestamp)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function IlligalEntry() {
  const { status, subscribe } = useWS()
  const [events, setEvents]   = useState<FaceEvent[]>([])
  const counterRef             = useRef(0)

  // Subscribe to face-events from WS
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type !== 'face-events') return
      const d = msg.data as Omit<FaceEvent, 'id'>
      const event: FaceEvent = { ...d, id: `evt-${++counterRef.current}-${Date.now()}` }
      setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS))
    })
    return unsub
  }, [subscribe])

  const unauthorized = events.filter((e) => !e.authorized)
  const authorized   = events.filter((e) => e.authorized)

  const wsColor =
    status === 'connected'    ? 'text-green-400' :
    status === 'connecting'   ? 'text-yellow-400' :
    status === 'error'        ? 'text-red-400' :
                                'text-slate-500'

  const WsIcon = status === 'connected' ? Wifi : status === 'connecting' ? Loader2 : WifiOff

  return (
    <div className='flex-1 overflow-auto bg-slate-950 p-6 space-y-6'>

      {/* ── Header ── */}
      <div className='flex items-center justify-between flex-wrap gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-white flex items-center gap-2'>
            <AlertTriangle className='h-6 w-6 text-red-400' />
            Illegal Entry Monitor
          </h1>
          <p className='text-sm text-slate-500 mt-1'>
            Real-time face recognition events via WebSocket
          </p>
        </div>

        {/* WS status */}
        <div className={`flex items-center gap-2 text-sm font-medium ${wsColor}`}>
          <WsIcon className={`h-4 w-4 ${status === 'connecting' ? 'animate-spin' : ''}`} />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className='grid grid-cols-3 gap-4'>
        {[
          { label: 'Total Events',  value: events.length,      color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Unauthorized',  value: unauthorized.length, color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'Authorized',    value: authorized.length,   color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
            <p className='text-xs text-slate-500 uppercase tracking-wider font-medium'>{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Main content: two columns ── */}
      <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>

        {/* Unauthorized */}
        <section>
          <h2 className='text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2'>
            <ShieldAlert className='h-4 w-4' />
            Unauthorized Entries ({unauthorized.length})
          </h2>
          {unauthorized.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-40 rounded-2xl border border-dashed border-slate-700 text-slate-600 text-sm gap-2'>
              <ShieldAlert className='h-8 w-8 opacity-40' />
              No unauthorized entries detected yet
            </div>
          ) : (
            <div className='space-y-3'>
              {unauthorized.map((e, i) => (
                <EventCard key={e.id} event={e} isLatest={i === 0 && events[0]?.id === e.id} />
              ))}
            </div>
          )}
        </section>

        {/* Authorized */}
        <section>
          <h2 className='text-sm font-semibold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2'>
            <ShieldCheck className='h-4 w-4' />
            Authorized Entries ({authorized.length})
          </h2>
          {authorized.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-40 rounded-2xl border border-dashed border-slate-700 text-slate-600 text-sm gap-2'>
              <ShieldCheck className='h-8 w-8 opacity-40' />
              No authorized entries detected yet
            </div>
          ) : (
            <div className='space-y-3'>
              {authorized.map((e, i) => (
                <EventCard key={e.id} event={e} isLatest={i === 0 && events[0]?.id === e.id} />
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Empty state – no events at all */}
      {events.length === 0 && status === 'connected' && (
        <div className='flex flex-col items-center justify-center py-20 text-slate-600 gap-3'>
          <Wifi className='h-10 w-10 text-green-500/40' />
          <p className='text-sm'>Connected — waiting for face events…</p>
        </div>
      )}
    </div>
  )
}
