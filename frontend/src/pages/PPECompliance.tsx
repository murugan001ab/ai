// ─────────────────────────────────────────────────────────────────────────────
// PPECompliance.tsx
//
// Fixes applied vs. the previous version:
//  1. Removed stale `import { data } from 'react-router-dom'`
//  2. EquipmentBreakdown now iterates the array directly (not Object.entries)
//  3. Removed all references to `dash?.camera?.cam_url` / iframe — the PPE
//     dashboard API's `camera` field only has {id, name, status}; no stream URL
//  4. SelectBox.onChange typed as (id: number | null) — supports deselection
//  5. `selectZone` / `selectCamera` both receive null when user picks placeholder
//  6. Zone reset correctly clears camera via usePPEDashboard.selectZone(null)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import {
  ShieldCheck, AlertTriangle, Camera, ChevronDown,
  RefreshCw, Loader2, AlertCircle, BarChart3,
} from 'lucide-react'
import { usePPEDashboard } from '../features/ppe/usePPEDashboard'
import { usePPEEvents }    from '../features/ppe/usePPEEvents'
import { useWS }           from '../contexts/WSContext'
import { getZones }        from '../services/zone.service'
import type { ZoneItem }   from '../services/zone.service'

const API_BASE_IMAGE = import.meta.env.VITE_API_BASE_IMAGE_URL ?? 'http://localhost:8080'

// ── PPE colour helpers ─────────────────────────────────────────────────────

const PPE_COLORS: Record<string, string> = {
  helmet:  'bg-red-400/10 text-red-400 border-red-400/20',
  gloves:  'bg-orange-400/10 text-orange-400 border-orange-400/20',
  vest:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  boots:   'bg-purple-400/10 text-purple-400 border-purple-400/20',
  goggles: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
}

const BAR_COLORS: Record<string, string> = {
  helmet:  'bg-red-500',
  gloves:  'bg-orange-500',
  vest:    'bg-yellow-500',
  boots:   'bg-purple-500',
  goggles: 'bg-blue-500',
}

const ppeColorCls = (name: string) =>
  PPE_COLORS[name.toLowerCase()] ?? 'bg-slate-700/50 text-slate-400 border-slate-600/30'

const barColorCls = (name: string) =>
  BAR_COLORS[name.toLowerCase()] ?? 'bg-blue-500'

// ── Atomic components ──────────────────────────────────────────────────────

function PPEBadge({ item }: { item: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${ppeColorCls(item)}`}
    >
      {item}
    </span>
  )
}

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className='bg-slate-800 rounded-xl px-4 py-3 text-center flex-1 min-w-0'>
      <p className={`text-xl font-bold truncate ${color}`}>{value}</p>
      <p className='text-[10px] text-slate-500 mt-0.5 truncate'>{label}</p>
    </div>
  )
}

// ── SelectBox ──────────────────────────────────────────────────────────────
// FIX: onChange typed as (id: number | null) — null means "clear / show all"
// FIX: value='' → calls onChange(null) so the hook receives a proper null

function SelectBox({
  label,
  value,
  onChange,
  options,
  loading,
  placeholder,
  disabled,
}: {
  label:       string
  value:       number | null
  onChange:    (id: number | null) => void   // null = deselect
  options:     { id: number; name: string; sub?: string }[]
  loading?:    boolean
  placeholder: string
  disabled?:   boolean
}) {
  return (
    <div className='flex flex-col gap-1.5 min-w-0'>
      <label className='text-xs text-slate-500 uppercase tracking-wider'>{label}</label>
      <div className='relative'>
        <select
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            // FIX: empty string → null (deselect), not NaN
            onChange(raw === '' ? null : Number(raw))
          }}
          disabled={disabled || loading}
          className='w-full appearance-none bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 pr-9 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
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
            ? <Loader2 className='h-4 w-4 animate-spin text-slate-500' />
            : <ChevronDown className='h-4 w-4 text-slate-500' />}
        </div>
      </div>
    </div>
  )
}

// ── Hourly bar chart ───────────────────────────────────────────────────────

function HourlyChart({ trend }: { trend: { hour: number; violation_count: number }[] }) {
  if (!trend.length) {
    return (
      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-center text-slate-600 text-sm'>
        No hourly data
      </div>
    )
  }
  const max = Math.max(...trend.map((t) => t.violation_count), 1)

  return (
    <div className='bg-slate-900 border border-slate-800 rounded-2xl p-5'>
      <div className='flex items-center gap-2 mb-4'>
        <BarChart3 className='h-4 w-4 text-slate-400' />
        <h3 className='text-sm font-semibold text-white'>Hourly Trend</h3>
      </div>
      <div className='flex items-end gap-1 h-28'>
        {trend.map((t) => {
          const pct = (t.violation_count / max) * 100
          return (
            <div key={t.hour} className='flex-1 flex flex-col items-center gap-1 group'>
              <div className='relative w-full flex items-end justify-center' style={{ height: '80px' }}>
                <div
                  className='w-full bg-blue-500/30 group-hover:bg-blue-500/60 rounded-t transition-all relative'
                  style={{ height: `${Math.max(pct, 2)}%` }}
                >
                  {t.violation_count > 0 && (
                    <span className='absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap'>
                      {t.violation_count}
                    </span>
                  )}
                </div>
              </div>
              <span className='text-[10px] text-slate-600'>{t.hour}h</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Equipment breakdown ────────────────────────────────────────────────────
// FIX: was using Object.entries() on an array — now iterates the array directly

function EquipmentBreakdown({
  breakdown,
}: {
  breakdown: Record<string,number>
}) {
  if (!Object.keys(breakdown).length) {
    // console.log(breakdown)
    return (
      <p className='text-sm text-slate-500 py-4 text-center'>No violations recorded</p>
    )
  }
  const total =Object.values(breakdown).reduce((a,b)=>a+b)
  console.log("total",total)
  return (
    <div className='space-y-3'>
      {Object.entries(breakdown).map(([key,value]) => {
        const pct     = total > 0 ? (value / total) * 100 : 0
        const textCls = ppeColorCls(key).split(' ')[1] ?? 'text-slate-400'
        const barCls  = barColorCls(key)

        return (
          <div key={key}>
            <div className='flex items-center justify-between mb-1.5'>
              <span className={`text-sm font-medium capitalize ${textCls}`}>
                {key}
              </span>
              <span className='text-sm font-bold text-white'>{value}</span>
            </div>
            <div className='h-2 bg-slate-800 rounded-full overflow-hidden'>
              <div
                className={`h-full ${barCls} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── WS status bar ──────────────────────────────────────────────────────────

function WSStatusBar() {
  const { status, reconnect } = useWS()
  if (status === 'connected') return null

  const label =
    status === 'connecting' ? 'Connecting…'
    : status === 'error'   ? 'Connection error'
    : 'Disconnected'

  return (
    <div className='mx-6 mt-3 px-4 py-2 bg-amber-400/10 border border-amber-400/20 rounded-xl flex items-center gap-2 text-xs text-amber-400'>
      <AlertCircle className='h-3.5 w-3.5 flex-shrink-0' />
      <span className='flex-1'>WebSocket {label} — live updates paused</span>
      {status !== 'connecting' && (
        <button onClick={reconnect} className='flex items-center gap-1 hover:text-amber-300 transition-colors'>
          <RefreshCw className='h-3 w-3' /> Reconnect
        </button>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PPECompliance() {
  const [zones,       setZones]   = useState<ZoneItem[]>([])
  const [zonesLoading, setZLd]    = useState(true)

  const dash       = usePPEDashboard()
  const { events } = usePPEEvents()

  // Load zone list once on mount
  useEffect(() => {
    setZLd(true)
    getZones(1, 100)
      .then((res) => setZones(res.data))
      .catch(() => setZones([]))
      .finally(() => setZLd(false))
  }, [])

  const d = dash.data

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className='px-6 py-4 border-b border-slate-800 flex-shrink-0'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center'>
              <ShieldCheck className='h-4 w-4 text-blue-400' />
            </div>
            <div>
              <h1 className='text-lg font-bold text-white'>PPE Compliance</h1>
              <p className='text-xs text-slate-500'>Zone → Camera drill-down with live refresh</p>
            </div>
          </div>
          <button
            onClick={dash.refetch}
            disabled={dash.loading}
            className='p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors'
            title='Refresh'
          >
            <RefreshCw className={`h-4 w-4 ${dash.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Zone + Camera selectors */}
        <div className='flex flex-wrap gap-4 mt-4'>
          <div className='flex-1 min-w-[180px] max-w-xs'>
            <SelectBox
              label='1. Select Zone'
              value={dash.zoneId}
              onChange={dash.selectZone}          // receives null when placeholder chosen
              options={zones.map((z) => ({ id: z.id, name: z.name }))}
              loading={zonesLoading}
              placeholder='All Zones'
            />
          </div>

          <div className='flex-1 min-w-[180px] max-w-xs'>
            <SelectBox
              label='2. Select Camera'
              value={dash.cameraId}
              onChange={dash.selectCamera}        // receives null to clear
              options={dash.cameras.map((c) => ({
                id:   c.id,
                name: c.name,
                sub:  c.violations_today > 0
                  ? `${c.violations_today} violation${c.violations_today !== 1 ? 's' : ''} today`
                  : c.status,
              }))}
              loading={dash.camsLoading}
              placeholder='All Cameras'
              disabled={!dash.zoneId}
            />
          </div>

          {/* Required PPE pills */}
          {d?.required_ppe && d.required_ppe.length > 0 && (
            <div className='flex flex-col gap-1.5'>
              <span className='text-xs text-slate-500 uppercase tracking-wider'>Required PPE</span>
              <div className='flex flex-wrap gap-1.5 items-center'>
                {d.required_ppe.map((p) => (
                  <PPEBadge key={p.equipment_id} item={p.name} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WS warning banner */}
      <WSStatusBar />

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className='flex-1 overflow-y-auto px-6 py-6 space-y-5'>

        {/* First-load spinner */}
        {dash.loading && !d && (
          <div className='flex items-center justify-center py-20'>
            <Loader2 className='h-7 w-7 animate-spin text-slate-500' />
          </div>
        )}

        {/* Error state */}
        {!dash.loading && dash.error && (
          <div className='bg-red-400/10 border border-red-400/20 rounded-2xl p-5 flex items-center gap-3 text-red-400'>
            <AlertCircle className='h-5 w-5 flex-shrink-0' />
            <div>
              <p className='font-medium'>Failed to load data</p>
              <p className='text-xs mt-0.5 text-red-300'>{dash.error}</p>
            </div>
            <button onClick={dash.refetch} className='ml-auto text-xs underline hover:text-red-300'>
              Retry
            </button>
          </div>
        )}

        {/* Data */}
        {d && (
          <>
            {/* Stat chips — dim slightly while background-refreshing */}
            <div className={`flex gap-3 transition-opacity ${dash.loading ? 'opacity-60' : 'opacity-100'}`}>
              <StatChip label='Total Violations' value={d.stats.total_violations}                  color='text-red-400' />
              <StatChip label='Compliant Events'  value={d.stats.total_compliant}                  color='text-green-400' />
              <StatChip label='Compliance Rate'   value={`${d.stats.compliance_rate.toFixed(1)}%`} color='text-blue-400' />
              <StatChip label='Violation Rate'    value={`${d.stats.violation_rate.toFixed(1)}%`}  color='text-amber-400' />
            </div>

            {/* Breakdown + trend */}
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
              <div className='bg-slate-900 border border-slate-800 rounded-2xl p-5'>
                <h3 className='text-sm font-semibold text-white mb-4'>Missing PPE Breakdown</h3>
                {/* FIX: passes the array directly — EquipmentBreakdown iterates it with .map() */}
                <EquipmentBreakdown breakdown={d.equipment_breakdown} />
              </div>
              <HourlyChart trend={d.hourly_trend} />
            </div>

            {/* Recent violations */}
            <div className='bg-slate-900 border border-slate-800 rounded-2xl p-5'>
              <div className='flex items-center justify-between mb-4'>
                <div className='flex items-center gap-2'>
                  <Camera className='h-4 w-4 text-slate-400' />
                  <h3 className='text-sm font-semibold text-white'>Recent Violations</h3>
                  <span className='text-xs text-slate-500'>— {d.recent_violations.length} shown</span>
                </div>
                {events.length > 0 && (
                  <div className='flex items-center gap-1.5'>
                    <span className='h-1.5 w-1.5 bg-red-400 rounded-full animate-pulse' />
                    <span className='text-xs text-red-400'>{events.length} new live</span>
                  </div>
                )}
              </div>

              {d.recent_violations.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-10 text-slate-600 gap-2'>
                  <ShieldCheck className='h-8 w-8' />
                  <p className='text-sm'>No violations for this selection</p>
                </div>
              ) : (
                <div className='space-y-2'>
                  {d.recent_violations.map((viol) => (
                    <div
                      key={viol.event_id}
                      className='flex items-start gap-3 bg-slate-950 border border-slate-800 border-l-2 border-l-red-500 rounded-xl p-3'
                    >
                      {/* Snapshot thumbnail — only rendered if path exists */}
                      {viol.image_path && (
                        <img
                          src={`${API_BASE_IMAGE}/${viol.image_path}`}
                          alt='violation frame'
                          className='h-14 w-20 object-cover rounded-lg flex-shrink-0 bg-slate-800'
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-start justify-between gap-2'>
                          <p className='text-sm font-medium text-white'>
                            {viol.camera_name ?? 'Unknown Camera'}
                          </p>
                          <span className='text-[10px] text-slate-600 flex-shrink-0'>
                            {new Date(viol.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {viol.missing_ppe.length > 0 ? (
                          <div className='flex flex-wrap gap-1 mt-2'>
                            {viol.missing_ppe.map((item) => (
                              <PPEBadge key={item} item={item} />
                            ))}
                          </div>
                        ) : (
                          <p className='text-xs text-slate-600 mt-1'>No PPE details recorded</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty state — no zone selected and no data yet */}
        {!d && !dash.loading && !dash.error && (
          <div className='flex flex-col items-center justify-center py-20 text-slate-600 gap-3'>
            <AlertTriangle className='h-10 w-10' />
            <p className='text-slate-400 font-medium'>Select a zone to view compliance data</p>
          </div>
        )}

      </div>
    </div>
  )
}
