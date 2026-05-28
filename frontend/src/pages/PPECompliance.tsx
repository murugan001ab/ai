// ─────────────────────────────────────────────────────────────────────────────
// PPECompliance.tsx  –  Industrial-safety dark UI + MediaMTX WebRTC live stream
// ─────────────────────────────────────────────────────────────────────────────
//
// Stream architecture:
//   • Each camera has an RTSP URL like  rtsp://<host>:554/stream-name
//   • MediaMTX ingests those streams and re-publishes them under  cam-{id}
//   • MediaMTX WebRTC viewer (built-in HTML page) lives at:
//       http://<mediamtx-host>:<VITE_MEDIAMTX_PORT>/cam-{id}
//   • We embed that page in an <iframe> — no plugin needed
//
//  .env keys used:
//   VITE_API_BASE_IMAGE_URL   – MediaMTX base URL (default http://localhost:8080)
//   VITE_MEDIAMTX_PORT        – Optional: override port for WebRTC viewer
//                               e.g. VITE_MEDIAMTX_PORT=8889
//                               Falls back to the port in VITE_API_BASE_IMAGE_URL
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  ShieldCheck, AlertTriangle, Camera, ChevronDown,
  RefreshCw, Loader2, AlertCircle, BarChart3,
  Wifi, WifiOff, Eye, Clock, TrendingUp, Activity,
  Video, VideoOff, Maximize2, Minimize2, Radio,
} from 'lucide-react'
import { usePPEDashboard } from '../features/ppe/usePPEDashboard'
import { usePPEEvents } from '../features/ppe/usePPEEvents'
import { useWS } from '../contexts/WSContext'
import { getZones } from '../services/zone.service'
import { getCamera } from '../services/camera.service'
import type { ZoneItem } from '../services/zone.service'

// ── Env / stream URL builder ──────────────────────────────────────────────────
const API_BASE_IMAGE =
  `${import.meta.env.VITE_API_BASE_IMAGE_URL ?? 'http://localhost:8080'}/ppe_violations`

/**
 * Derive the MediaMTX WebRTC viewer URL for a given camera ID.
 *
 * Priority:
 *  1. VITE_MEDIAMTX_PORT  – explicit port override, uses same host as API image URL
 *  2. VITE_API_BASE_IMAGE_URL as-is  – assumes MediaMTX runs on the same base URL
 *
 * Result: http://<host>:<port>/cam-{id}
 */
function buildStreamUrl(rtspUrl: string): string {
  const webrtcPort =
    import.meta.env.VITE_MEDIAMTX_PORT ?? '8889'

  try {
    const url = new URL(rtspUrl)

    // change protocol
    url.protocol = 'http:'

    // change only port
    url.port = webrtcPort

    return url.toString()
  } catch {
    return ''
  }
}

// ── PPE colour maps ───────────────────────────────────────────────────────────
const PPE_COLORS: Record<string, { badge: string; bar: string; glow: string }> = {
  helmet: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', bar: 'bg-gradient-to-r from-red-600 to-red-400', glow: 'shadow-red-500/20' },
  gloves: { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', bar: 'bg-gradient-to-r from-orange-600 to-orange-400', glow: 'shadow-orange-500/20' },
  vest: { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', bar: 'bg-gradient-to-r from-yellow-600 to-yellow-400', glow: 'shadow-yellow-500/20' },
  boots: { badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30', bar: 'bg-gradient-to-r from-purple-600 to-purple-400', glow: 'shadow-purple-500/20' },
  goggles: { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', bar: 'bg-gradient-to-r from-cyan-600 to-cyan-400', glow: 'shadow-cyan-500/20' },
}
const fallback = {
  badge: 'bg-slate-700/50 text-slate-400 border-slate-600/30',
  bar: 'bg-gradient-to-r from-slate-600 to-slate-500',
  glow: 'shadow-slate-500/10',
}
const ppeCls = (name: string) => PPE_COLORS[name.toLowerCase()] ?? fallback

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function PPEBadge({ item }: { item: string }) {
  const cls = ppeCls(item)
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border capitalize tracking-wide ${cls.badge}`}>
      {item}
    </span>
  )
}

function ComplianceRing({ rate }: { rate: number }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const offset = circ - (rate / 100) * circ
  const color = rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width='96' height='96' className='rotate-[-90deg]'>
      <circle cx='48' cy='48' r={r} fill='none' stroke='#1e293b' strokeWidth='8' />
      <circle
        cx='48' cy='48' r={r} fill='none'
        stroke={color} strokeWidth='8'
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap='round'
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text
        x='48' y='48' textAnchor='middle' dominantBaseline='central'
        fill={color} fontSize='14' fontWeight='700'
        style={{ transform: 'rotate(90deg)', transformOrigin: '48px 48px' }}
      >
        {rate.toFixed(0)}%
      </text>
    </svg>
  )
}

// ── SelectBox ─────────────────────────────────────────────────────────────────
function SelectBox({
  label, icon, value, onChange, options, loading, placeholder, disabled,
}: {
  label: string; icon: React.ReactNode; value: number | null
  onChange: (id: number | null) => void
  options: { id: number; name: string; sub?: string }[]
  loading?: boolean; placeholder: string; disabled?: boolean
}) {
  return (
    <div className='flex flex-col gap-1.5 min-w-0'>
      <label className='flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-widest'>
        {icon}{label}
      </label>
      <div className='relative'>
        <select
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === '' ? null : Number(raw))
          }}
          disabled={disabled || loading}
          className='w-full appearance-none bg-slate-900/80 border border-slate-700/70 rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm'
        >
          <option value=''>{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}{o.sub ? ` — ${o.sub}` : ''}
            </option>
          ))}
        </select>
        <div className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2'>
          {loading
            ? <Loader2 className='h-4 w-4 animate-spin text-cyan-500' />
            : <ChevronDown className='h-4 w-4 text-slate-500' />}
        </div>
      </div>
    </div>
  )
}

// ── Hourly bar chart ──────────────────────────────────────────────────────────
function HourlyChart({ trend }: { trend: { hour: number; violation_count: number }[] }) {
  if (!trend.length) {
    return (
      <div className='flex items-center justify-center py-8 text-slate-600 text-sm gap-2'>
        <BarChart3 className='h-4 w-4' /> No hourly data
      </div>
    )
  }
  const max = Math.max(...trend.map((t) => t.violation_count), 1)

  return (
    <div className='flex items-end gap-1 h-24 px-1'>
      {trend.map((t) => {
        const pct = (t.violation_count / max) * 100
        const intensity = t.violation_count > 0 ? 'bg-cyan-500' : 'bg-slate-700'
        return (
          <div key={t.hour} className='flex-1 flex flex-col items-center gap-1 group cursor-default'>
            <div className='relative w-full flex items-end justify-center' style={{ height: '72px' }}>
              <div
                className={`w-full ${intensity} group-hover:brightness-125 rounded-t-sm transition-all duration-300 relative`}
                style={{ height: `${Math.max(pct, 3)}%`, opacity: 0.7 + (pct / 100) * 0.3 }}
              >
                {t.violation_count > 0 && (
                  <span className='absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-900 px-1 rounded'>
                    {t.violation_count}
                  </span>
                )}
              </div>
            </div>
            <span className='text-[9px] text-slate-600'>{t.hour}h</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Equipment breakdown ───────────────────────────────────────────────────────
function EquipmentBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown)
  if (!entries.length) {
    return (
      <div className='flex flex-col items-center py-6 gap-2 text-slate-600'>
        <ShieldCheck className='h-8 w-8 text-green-600/50' />
        <p className='text-sm'>No violations recorded</p>
      </div>
    )
  }
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)

  return (
    <div className='space-y-3'>
      {entries.map(([key, value]) => {
        const pct = total > 0 ? (value / total) * 100 : 0
        const cls = ppeCls(key)
        const textCls = cls.badge.split(' ')[1] ?? 'text-slate-400'
        return (
          <div key={key}>
            <div className='flex items-center justify-between mb-1.5'>
              <span className={`text-xs font-semibold capitalize ${textCls}`}>{key}</span>
              <div className='flex items-center gap-2'>
                <span className='text-[10px] text-slate-500'>{pct.toFixed(0)}%</span>
                <span className='text-sm font-bold text-white tabular-nums'>{value}</span>
              </div>
            </div>
            <div className='h-1.5 bg-slate-800 rounded-full overflow-hidden'>
              <div
                className={`h-full ${cls.bar} rounded-full transition-all duration-700 shadow-sm ${cls.glow}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Live Stream Panel ─────────────────────────────────────────────────────────
//
// When a camera is selected:
//  1. We fetch its full CameraItem to get rtsp_url (for display only)
//  2. We build the MediaMTX WebRTC viewer URL: buildStreamUrl(cameraId)
//  3. We embed it in an <iframe> — MediaMTX ships with a built-in WebRTC page
//
// The iframe key changes whenever cameraId changes, forcing a fresh load.
// A loading overlay is shown until the iframe fires onLoad.
// ─────────────────────────────────────────────────────────────────────────────
interface StreamPanelProps {
  cameraId: number | null
  cameraName: string | null
}

function LiveStreamPanel({ cameraId, cameraName }: StreamPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [iframeReady, setIframeReady] = useState(false)
  const [rtspUrl, setRtspUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Fetch full camera to display RTSP URL info
  useEffect(() => {
    setRtspUrl(null)
    if (!cameraId) return
    getCamera(cameraId)
      .then((cam) => setRtspUrl(cam.rtsp_url))
      .catch(() => setRtspUrl(null))
  }, [cameraId])

  // Reset ready state when camera changes
  useEffect(() => {
    setIframeReady(false)
  }, [cameraId])

  // Close fullscreen on Escape
  useEffect(() => {
    if (!expanded) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expanded])

  const scanlines = (
    <div className='absolute inset-0 pointer-events-none' style={{
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)',
      zIndex: 1,
    }} />
  )

  const cornerBrackets = (color: string) => (
    <>
      <div className={`absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 ${color}`} style={{ zIndex: 5 }} />
      <div className={`absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 ${color}`} style={{ zIndex: 5 }} />
      <div className={`absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 ${color}`} style={{ zIndex: 5 }} />
      <div className={`absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 ${color}`} style={{ zIndex: 5 }} />
    </>
  )

  // ── No camera selected ────────────────────────────────────────────────────
  if (!cameraId) {
    return (
      <div
        className='relative rounded-2xl border border-slate-800/60 bg-slate-900/50 overflow-hidden'
        style={{ aspectRatio: '16/9' }}
      >
        {scanlines}
        {cornerBrackets('border-slate-700/50')}
        <div className='absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600' style={{ zIndex: 2 }}>
          <VideoOff className='h-10 w-10 opacity-25' />
          <p className='text-sm font-medium text-slate-500'>No Camera Selected</p>
          <p className='text-[11px] text-slate-600'>Select a zone → camera to view live stream</p>
        </div>
      </div>
    )
  }

const streamUrl = rtspUrl
  ? buildStreamUrl(rtspUrl)
  : ''
  const displayName = cameraName ?? `CAM-${cameraId}`

  // ── Fullscreen portal ─────────────────────────────────────────────────────
  const streamContent = (isFullscreen: boolean) => (
    <div
      className={`relative bg-black overflow-hidden ${isFullscreen
          ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl shadow-cyan-500/10 border border-cyan-500/30'
          : 'rounded-2xl border border-cyan-500/20'
        }`}
      style={isFullscreen ? {} : { aspectRatio: '16/9' }}
    >
      {scanlines}
      {cornerBrackets('border-cyan-500/40')}

      {/* ── Top HUD ──────────────────────────────────────────────────── */}
      <div
        className='absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/80 to-transparent'
        style={{ zIndex: 10 }}
      >
        <div className='flex items-center gap-2'>
          <Radio className='h-3 w-3 text-red-400 animate-pulse' />
          <span className='text-[10px] font-bold text-white/90 uppercase tracking-widest'>LIVE</span>
          <span className='text-[11px] text-slate-300 ml-1 font-medium'>{displayName}</span>
          {rtspUrl && (
            <span className='hidden sm:block text-[9px] text-slate-500 font-mono bg-black/40 px-1.5 py-0.5 rounded ml-1 truncate max-w-[220px]'>
              {rtspUrl}
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
          className='p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors'
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        >
          {isFullscreen
            ? <Minimize2 className='h-3.5 w-3.5' />
            : <Maximize2 className='h-3.5 w-3.5' />}
        </button>
      </div>

      {/* ── Loading overlay — hidden after iframe fires onLoad ──────── */}
      {!iframeReady && (
        <div
          className='absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black'
          style={{ zIndex: 8 }}
        >
          <div className='relative'>
            <Loader2 className='h-6 w-6 animate-spin text-cyan-500' />
            <div className='absolute inset-0 rounded-full border border-cyan-500/20 animate-ping' />
          </div>
          <p className='text-[11px] text-slate-500 font-mono'>Connecting to stream…</p>
          <p className='text-[10px] text-slate-700 font-mono'>{streamUrl}</p>
        </div>
      )}

      {/* ── WebRTC iframe ────────────────────────────────────────────── */}
      {/*
          key={cameraId}  → forces full remount when camera changes
          allow="autoplay" is required for WebRTC audio/video autoplay
          MediaMTX built-in page handles all WebRTC negotiation internally
      */}
      <iframe
        ref={iframeRef}
        key={cameraId}
        src={streamUrl}
        className='w-full h-full border-0 bg-black block'
        allow='autoplay; camera; microphone; display-capture'
        sandbox='allow-scripts allow-same-origin allow-forms'
        title={`Live feed – ${displayName}`}
        onLoad={() => setIframeReady(true)}
        style={{ display: 'block', zIndex: iframeReady ? 2 : 0, position: 'relative' }}
      />

      {/* ── Bottom HUD ───────────────────────────────────────────────── */}
      <div
        className='absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/80 to-transparent'
        style={{ zIndex: 10, pointerEvents: 'none' }}
      >
        <span className='text-[9px] text-slate-600 font-mono'>{`cam-${cameraId}`}</span>
        <div className='flex items-center gap-1 text-[9px] text-cyan-400'>
          <Activity className='h-2.5 w-2.5' />
          <span className='uppercase tracking-wider'>WebRTC</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {streamContent(false)}
      {/* Fullscreen portal rendered outside normal flow */}
      {expanded && (
        <>
          {/* Backdrop */}
          <div
            className='fixed inset-0 bg-black/70 backdrop-blur-sm z-40'
            onClick={() => setExpanded(false)}
          />
          {streamContent(true)}
        </>
      )}
    </>
  )
}

// ── WS status bar ─────────────────────────────────────────────────────────────
function WSStatusBar() {
  const { status, reconnect } = useWS()
  if (status === 'connected') return null

  const label = status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Connection error' : 'Disconnected'

  return (
    <div className='mx-5 mt-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-xs text-amber-400'>
      <WifiOff className='h-3.5 w-3.5 flex-shrink-0' />
      <span className='flex-1'>WebSocket {label} — live updates paused</span>
      {status !== 'connecting' && (
        <button onClick={reconnect} className='flex items-center gap-1 text-amber-300 hover:text-white transition-colors'>
          <RefreshCw className='h-3 w-3' /> Reconnect
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PPECompliance() {
  const [zones, setZones] = useState<ZoneItem[]>([])
  const [zonesLoading, setZLd] = useState(true)

  const dash = usePPEDashboard()
  const { events } = usePPEEvents()

  useEffect(() => {
    setZLd(true)
    getZones(1, 100)
      .then((res) => setZones(res.data))
      .catch(() => setZones([]))
      .finally(() => setZLd(false))
  }, [])

  const d = dash.data

  const selectedCameraName =
    dash.cameras.find(c => c.id === dash.cameraId)?.name ?? null

  const breakdownMap: Record<string, number> =
    typeof d?.equipment_breakdown === 'object' &&
      d?.equipment_breakdown !== null
      ? d.equipment_breakdown
      : {}

  return (
    <div className='flex-1 flex flex-col overflow-hidden bg-slate-950 min-h-0'>

      {/* ── Background grid ────────────────────────────────────────────────── */}
      <div className='absolute inset-0 pointer-events-none overflow-hidden' style={{
        backgroundImage: 'linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className='relative px-5 pt-5 pb-4 border-b border-slate-800/60 flex-shrink-0 backdrop-blur-sm'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <div className='relative h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-600/30 to-blue-700/30 border border-cyan-500/20 flex items-center justify-center shadow-lg shadow-cyan-500/10'>
              <ShieldCheck className='h-5 w-5 text-cyan-400' />
              <span className='absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-cyan-500 border-2 border-slate-950' />
            </div>
            <div>
              <h1 className='text-base font-black text-white tracking-tight'>PPE Compliance</h1>
              <p className='text-[11px] text-slate-500'>Industrial Safety Monitoring</p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <WSStatusInline />
            <button
              onClick={dash.refetch}
              disabled={dash.loading}
              className='p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 disabled:opacity-40 transition-all'
              title='Refresh'
            >
              <RefreshCw className={`h-4 w-4 ${dash.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Selectors row */}
        <div className='flex flex-wrap gap-3'>
          <div className='flex-1 min-w-[160px] max-w-[260px]'>
            <SelectBox
              label='Zone'
              icon={<Activity className='h-3 w-3' />}
              value={dash.zoneId}
              onChange={dash.selectZone}
              options={zones.map((z) => ({ id: z.id, name: z.name }))}
              loading={zonesLoading}
              placeholder='All Zones'
            />
          </div>

          <div className='flex-1 min-w-[160px] max-w-[260px]'>
            <SelectBox
              label='Camera'
              icon={<Camera className='h-3 w-3' />}
              value={dash.cameraId}
              onChange={dash.selectCamera}
              options={dash.cameras.map((c) => ({
                id: c.id,
                name: c.name,
                sub: c.violations_today > 0
                  ? `⚠ ${c.violations_today} violations`
                  : c.status,
              }))}
              loading={dash.camsLoading}
              placeholder='Select Camera'
              disabled={!dash.zoneId}
            />
          </div>

          {d?.required_ppe && d.required_ppe.length > 0 && (
            <div className='flex flex-col gap-1.5 min-w-0'>
              <span className='text-[11px] font-semibold text-slate-400 uppercase tracking-widest'>Required PPE</span>
              <div className='flex flex-wrap gap-1.5'>
                {d.required_ppe.map((p) => (
                  <PPEBadge key={p.equipment_id} item={p.name} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WS error banner */}
      <WSStatusBar />

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className='flex-1 overflow-y-auto px-5 py-4'>

        {dash.loading && !d && (
          <div className='flex flex-col items-center justify-center py-24 gap-3'>
            <div className='relative'>
              <Loader2 className='h-8 w-8 animate-spin text-cyan-500' />
              <div className='absolute inset-0 h-8 w-8 rounded-full border border-cyan-500/20 animate-ping' />
            </div>
            <p className='text-xs text-slate-500 animate-pulse'>Loading compliance data…</p>
          </div>
        )}

        {!dash.loading && dash.error && (
          <div className='bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 text-red-400 mt-2'>
            <AlertCircle className='h-5 w-5 flex-shrink-0' />
            <div className='flex-1'>
              <p className='font-semibold text-sm'>Failed to load data</p>
              <p className='text-xs mt-0.5 text-red-400/70'>{dash.error}</p>
            </div>
            <button onClick={dash.refetch} className='text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 px-3 py-1.5 rounded-lg transition-colors'>
              Retry
            </button>
          </div>
        )}

        {d && (
          <div className={`space-y-4 transition-opacity duration-300 ${dash.loading ? 'opacity-60' : 'opacity-100'}`}>

            {/* ── Top row: Live Stream + Compliance Stats ───────────────────── */}
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>

              {/* Live Stream */}
              <div className='flex flex-col gap-2'>
                <div className='flex items-center gap-2 px-1'>
                  <Video className='h-3.5 w-3.5 text-cyan-500' />
                  <span className='text-xs font-bold text-slate-300 uppercase tracking-widest'>Live Stream</span>
                  {dash.cameraId ? (
                    <span className='ml-auto text-[10px] text-cyan-400 flex items-center gap-1.5'>
                      <span className='h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse' />
                      {selectedCameraName ?? `Camera ${dash.cameraId}`}
                    </span>
                  ) : (
                    <span className='ml-auto text-[10px] text-slate-600 flex items-center gap-1.5'>
                      <VideoOff className='h-3 w-3' />
                      No camera selected
                    </span>
                  )}
                </div>

                {/* Stream hint when zone selected but no camera */}
                {dash.zoneId && !dash.cameraId && dash.cameras.length > 0 && (
                  <div className='flex items-center gap-2 px-3 py-2 bg-cyan-500/5 border border-cyan-500/15 rounded-xl text-[11px] text-cyan-400/70'>
                    <Camera className='h-3.5 w-3.5 flex-shrink-0' />
                    Select a camera above to view its live WebRTC stream
                  </div>
                )}

                <LiveStreamPanel cameraId={dash.cameraId} cameraName={selectedCameraName} />
              </div>

              {/* Compliance summary */}
              <div className='flex flex-col gap-3'>
                <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4 flex items-center gap-5'>
                  <ComplianceRing rate={d.stats.compliance_rate} />
                  <div className='flex-1 space-y-2'>
                    <div>
                      <p className='text-[10px] text-slate-500 uppercase tracking-widest'>Compliance Rate</p>
                      <p className='text-2xl font-black text-white'>{d.stats.compliance_rate.toFixed(1)}<span className='text-base font-semibold text-slate-400'>%</span></p>
                    </div>
                    <div className='h-px bg-slate-800' />
                    <div className='grid grid-cols-2 gap-2'>
                      <div>
                        <p className='text-[9px] text-slate-600 uppercase tracking-wider'>Violations</p>
                        <p className='text-lg font-bold text-red-400 tabular-nums'>{d.stats.total_violations}</p>
                      </div>
                      <div>
                        <p className='text-[9px] text-slate-600 uppercase tracking-wider'>Compliant</p>
                        <p className='text-lg font-bold text-green-400 tabular-nums'>{d.stats.total_compliant}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-3'>
                  <div className='bg-slate-900/50 border border-red-500/10 rounded-2xl p-3'>
                    <div className='flex items-center justify-between mb-1'>
                      <span className='text-[9px] font-semibold text-slate-500 uppercase tracking-widest'>Violation Rate</span>
                      <AlertTriangle className='h-3 w-3 text-red-500/60' />
                    </div>
                    <p className='text-xl font-black text-red-400'>{d.stats.violation_rate.toFixed(1)}<span className='text-sm font-semibold text-red-500/60'>%</span></p>
                  </div>
                  <div className='bg-slate-900/50 border border-slate-700/30 rounded-2xl p-3'>
                    <div className='flex items-center justify-between mb-1'>
                      <span className='text-[9px] font-semibold text-slate-500 uppercase tracking-widest'>Date</span>
                      <Clock className='h-3 w-3 text-slate-600' />
                    </div>
                    <p className='text-sm font-bold text-slate-300 leading-snug'>
                      {new Date(d.stats.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {(d.zone || d.camera) && (
                  <div className='flex gap-2'>
                    {d.zone && (
                      <div className='flex-1 bg-slate-900/40 border border-slate-800/40 rounded-xl px-3 py-2'>
                        <p className='text-[9px] text-slate-600 uppercase tracking-wider'>Zone</p>
                        <p className='text-xs font-semibold text-slate-300 truncate'>{d.zone.name}</p>
                      </div>
                    )}
                    {d.camera && (
                      <div className='flex-1 bg-slate-900/40 border border-cyan-500/10 rounded-xl px-3 py-2'>
                        <p className='text-[9px] text-slate-600 uppercase tracking-wider'>Camera</p>
                        <p className='text-xs font-semibold text-cyan-300 truncate'>{d.camera.name}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Middle row: Equipment + Hourly ───────────────────────────── */}
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
              <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
                <div className='flex items-center gap-2 mb-4'>
                  <TrendingUp className='h-4 w-4 text-slate-400' />
                  <h3 className='text-xs font-bold text-slate-300 uppercase tracking-widest'>Missing PPE Breakdown</h3>
                </div>
                <EquipmentBreakdown breakdown={breakdownMap} />
              </div>

              <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
                <div className='flex items-center gap-2 mb-4'>
                  <BarChart3 className='h-4 w-4 text-slate-400' />
                  <h3 className='text-xs font-bold text-slate-300 uppercase tracking-widest'>Hourly Violations</h3>
                </div>
                <HourlyChart trend={d.hourly_trend} />
              </div>
            </div>

            {/* ── Recent violations ────────────────────────────────────────── */}
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
            <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5 xl:col-span-2'>
              <div className='flex items-center justify-between mb-4'>
                <div className='flex items-center gap-2'>
                  <Eye className='h-4 w-4 text-slate-400' />
                  <h3 className='text-xs font-bold text-slate-300 uppercase tracking-widest'>Recent Violations</h3>
                  <span className='text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full'>{d.recent_violations.length}</span>
                </div>
                {events.length > 0 && (
                  <div className='flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full'>
                    <span className='h-1.5 w-1.5 bg-red-400 rounded-full animate-pulse' />
                    <span className='text-[10px] text-red-400 font-semibold'>{events.length} new live</span>
                  </div>
                )}
              </div>

              {d.recent_violations.length === 0 ? (
                <div className='flex flex-col items-center py-10 gap-3 text-slate-600'>
                  <ShieldCheck className='h-10 w-10 text-green-600/30' />
                  <p className='text-sm text-slate-500'>No violations for this selection</p>
                </div>
              ) : (
                <div className='space-y-2'>
                  {d.recent_violations.map((viol) => (
                    <div
                      key={viol.event_id}
                      className='group flex items-start gap-3 bg-slate-950/60 border border-slate-800/50 border-l-2 border-l-red-500/70 rounded-xl p-3 hover:border-l-red-400 hover:bg-slate-900/60 transition-all'
                    >
                      {viol.image_path ? (
                        <img
                          src={`${API_BASE_IMAGE}/${viol.image_path}`}
                          alt='violation'
                          className='h-14 w-20 object-cover rounded-lg flex-shrink-0 bg-slate-800 border border-slate-700/50'
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className='h-14 w-20 rounded-lg bg-slate-800/60 border border-slate-700/30 flex items-center justify-center flex-shrink-0'>
                          <Camera className='h-5 w-5 text-slate-700' />
                        </div>
                      )}

                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center justify-between gap-2 mb-1.5'>
                          <p className='text-sm font-semibold text-white truncate'>
                            {viol.camera_name ?? 'Unknown Camera'}
                          </p>
                          <span className='text-[10px] text-slate-600 flex-shrink-0 font-mono bg-slate-800/60 px-2 py-0.5 rounded'>
                            {new Date(viol.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {viol.missing_ppe.length > 0 ? (
                          <div className='flex flex-wrap gap-1'>
                            {viol.missing_ppe.map((item) => (
                              <PPEBadge key={item} item={item} />
                            ))}
                          </div>
                        ) : (
                          <p className='text-[11px] text-slate-600 italic'>No PPE details recorded</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* Empty / no-zone state */}
        {!d && !dash.loading && !dash.error && (
          <div className='flex flex-col items-center justify-center py-24 gap-4 text-slate-700'>
            <div className='relative'>
              <ShieldCheck className='h-16 w-16 opacity-20' />
              <div className='absolute inset-0 rounded-full border border-slate-700/30 animate-pulse' />
            </div>
            <div className='text-center'>
              <p className='text-slate-400 font-semibold'>Select a Zone to Begin</p>
              <p className='text-xs text-slate-600 mt-1'>Use the dropdowns above to filter compliance data</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline WS status dot ──────────────────────────────────────────────────────
function WSStatusInline() {
  const { status } = useWS()
  const color =
    status === 'connected' ? 'bg-green-500' :
      status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
        'bg-red-500'
  const label =
    status === 'connected' ? 'Live' :
      status === 'connecting' ? 'Connecting' :
        'Offline'
  return (
    <div className='flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/60 px-2.5 py-1.5 rounded-lg'>
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className={`text-[10px] font-semibold ${status === 'connected' ? 'text-green-400' : status === 'connecting' ? 'text-yellow-400' : 'text-red-400'}`}>
        {label}
      </span>
      {status === 'connected' ? <Wifi className='h-3 w-3 text-green-500/60' /> : <WifiOff className='h-3 w-3 text-slate-600' />}
    </div>
  )
}
