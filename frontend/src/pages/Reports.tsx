// ─────────────────────────────────────────────────────────────────────────────
// Reports.tsx  –  Unified report viewer for PPE / Idle / Illegal Entry / Full
// Endpoints:
//   GET /api/v1/reports/ppe-violations
//   GET /api/v1/reports/idle-monitoring
//   GET /api/v1/reports/illegal-entry
//   GET /api/v1/reports/full
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'
import {
  FileBarChart2, ShieldCheck, TimerOff, ShieldAlert, LayoutGrid,
  RefreshCw, Loader2, AlertCircle, Download, Calendar,
  TrendingUp, BarChart3, Camera, MapPin, AlertTriangle,
  CheckCircle, XCircle, Clock, Activity, ChevronDown,
} from 'lucide-react'
import {
  getPPEViolationsReport,
  getIdleMonitoringReport,
  getIllegalEntryReport,
  getFullReport,
  downloadPPEViolationsPDF,
  downloadIdleMonitoringPDF,
  downloadIllegalEntryPDF,
  downloadFullReportPDF,
  type PPEViolationsReport,
  type IdleMonitoringReport,
  type IllegalEntryReport,
  type FullReport,
  type DateRangeParams,
} from '../services/report.service'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportTab = 'ppe' | 'idle' | 'illegal' | 'full'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals)
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color, bg,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string; bg: string
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${bg}`}>
      <div className='flex items-center justify-between'>
        <p className='text-[10px] text-slate-500 uppercase tracking-widest font-semibold'>{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className={`text-3xl font-black tabular-nums ${color}`}>{value}</p>
      {sub && <p className='text-[10px] text-slate-500'>{sub}</p>}
    </div>
  )
}

function SectionTitle({ icon: Icon, label, color = 'text-slate-400' }: {
  icon: React.ElementType; label: string; color?: string
}) {
  return (
    <div className='flex items-center gap-2 mb-4'>
      <Icon className={`h-4 w-4 ${color}`} />
      <h3 className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</h3>
    </div>
  )
}

/** Simple horizontal bar chart */
function MiniBarChart({
  data, labelKey, valueKey, color,
}: {
  data: Record<string, unknown>[]
  labelKey: string; valueKey: string; color: string
}) {
  if (!data.length) return (
    <div className='flex flex-col items-center py-6 gap-2 text-slate-600'>
      <BarChart3 className='h-7 w-7 opacity-30' />
      <p className='text-xs'>No data</p>
    </div>
  )
  const max = Math.max(...data.map(d => Number(d[valueKey])), 1)
  return (
    <div className='space-y-2.5'>
      {data.map((d, i) => {
        const pct = (Number(d[valueKey]) / max) * 100
        return (
          <div key={i} className='flex items-center gap-3'>
            <span className='text-[10px] text-slate-400 w-28 truncate flex-shrink-0'>{String(d[labelKey])}</span>
            <div className='flex-1 h-2 bg-slate-800 rounded-full overflow-hidden'>
              <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <span className='text-xs font-bold text-white tabular-nums w-8 text-right'>{String(d[valueKey])}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Vertical bar chart (hourly trend) */
function HourlyBars({
  trend, valueKey, color,
}: {
  trend: Record<string, number>[]; valueKey: string; color: string
}) {
  if (!trend.length) return (
    <div className='flex items-center justify-center py-8 text-slate-600 text-xs gap-2'>
      <BarChart3 className='h-4 w-4' /> No data
    </div>
  )
  const max = Math.max(...trend.map(t => t[valueKey] ?? 0), 1)
  return (
    <div className='flex items-end gap-1 h-24'>
      {trend.map((t, i) => {
        const v = t[valueKey] ?? 0
        const pct = (v / max) * 100
        return (
          <div key={i} className='flex-1 flex flex-col items-center gap-1 group cursor-default'>
            <div className='relative w-full flex items-end justify-center' style={{ height: '72px' }}>
              <div
                className={`w-full ${color} rounded-t-sm group-hover:brightness-125 transition-all duration-300 relative`}
                style={{ height: `${Math.max(pct, 3)}%`, opacity: 0.6 + (pct / 100) * 0.4 }}
              >
                {v > 0 && (
                  <span className='absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-900 px-1 rounded'>
                    {v}
                  </span>
                )}
              </div>
            </div>
            <span className='text-[9px] text-slate-600'>{t.hour ?? i}h</span>
          </div>
        )
      })}
    </div>
  )
}

/** Daily trend table */
function DailyTable({ rows, cols }: {
  rows: Record<string, unknown>[]
  cols: { key: string; label: string; render?: (v: unknown) => React.ReactNode }[]
}) {
  if (!rows.length) return (
    <div className='text-center py-6 text-slate-600 text-xs'>No daily data</div>
  )
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs'>
        <thead>
          <tr className='border-b border-slate-800'>
            {cols.map(c => (
              <th key={c.key} className='text-left py-2 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold'>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className='border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors'>
              {cols.map(c => (
                <td key={c.key} className='py-2.5 px-2 text-slate-300'>
                  {c.render ? c.render(r[c.key]) : String(r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Date range picker ─────────────────────────────────────────────────────────

function DateFilter({
  startDate, endDate, onApply,
}: {
  startDate: string; endDate: string
  onApply: (start: string, end: string) => void
}) {
  const [start, setStart] = useState(startDate)
  const [end, setEnd]     = useState(endDate)

  const presets = [
    { label: 'Today',    start: today(),      end: today() },
    { label: '7 days',   start: daysAgo(6),   end: today() },
    { label: '30 days',  start: daysAgo(29),  end: today() },
    { label: '90 days',  start: daysAgo(89),  end: today() },
  ]

  return (
    <div className='flex flex-wrap items-end gap-3'>
      {/* Presets */}
      <div className='flex gap-1.5'>
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => { setStart(p.start); setEnd(p.end); onApply(p.start, p.end) }}
            className='px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700/60'
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      <div className='flex items-center gap-2'>
        <input
          type='date'
          value={start}
          onChange={e => setStart(e.target.value)}
          className='bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/60'
        />
        <span className='text-slate-600 text-xs'>→</span>
        <input
          type='date'
          value={end}
          onChange={e => setEnd(e.target.value)}
          className='bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/60'
        />
        <button
          onClick={() => onApply(start, end)}
          className='px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors'
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ── Error / Loading wrappers ──────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className='flex flex-col items-center justify-center py-24 gap-3'>
      <div className='relative'>
        <Loader2 className='h-8 w-8 animate-spin text-cyan-500' />
        <div className='absolute inset-0 rounded-full border border-cyan-500/20 animate-ping' />
      </div>
      <p className='text-xs text-slate-500 animate-pulse'>Loading report…</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className='bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 text-red-400'>
      <AlertCircle className='h-5 w-5 flex-shrink-0' />
      <div className='flex-1'>
        <p className='font-semibold text-sm'>Failed to load report</p>
        <p className='text-xs mt-0.5 text-red-400/70'>{message}</p>
      </div>
      <button
        onClick={onRetry}
        className='text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 px-3 py-1.5 rounded-lg transition-colors'
      >
        Retry
      </button>
    </div>
  )
}

// ── PPE Report view ───────────────────────────────────────────────────────────

function PPEReportView({ data }: { data: PPEViolationsReport }) {
  const { summary, equipment_breakdown, hourly_trend, daily_trend, top_cameras, top_zones } = data

  return (
    <div className='space-y-5'>
      {/* Summary cards */}
      <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
        <StatCard label='Total Violations' value={summary.total_violations}
          icon={AlertTriangle} color='text-red-400' bg='bg-red-500/10 border border-red-500/20' />
        <StatCard label='Compliant Events' value={summary.total_compliant}
          icon={CheckCircle} color='text-green-400' bg='bg-green-500/10 border border-green-500/20' />
        <StatCard label='Compliance Rate' value={`${fmt(summary.compliance_rate)}%`}
          icon={ShieldCheck} color='text-cyan-400' bg='bg-cyan-500/10 border border-cyan-500/20' />
        <StatCard label='Zones Affected' value={summary.zones_affected}
          sub={`${summary.cameras_affected} cameras`}
          icon={MapPin} color='text-purple-400' bg='bg-purple-500/10 border border-purple-500/20' />
      </div>

      {/* Most missing + breakdown */}
      <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={TrendingUp} label='Equipment Breakdown' color='text-cyan-400' />
          <MiniBarChart
            data={equipment_breakdown.map(e => ({ name: e.equipment_name, count: e.missing_count }))}
            labelKey='name' valueKey='count' color='bg-gradient-to-r from-cyan-600 to-cyan-400'
          />
        </div>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={BarChart3} label='Hourly Violations' color='text-orange-400' />
          <HourlyBars trend={hourly_trend as unknown as Record<string, number>[]} valueKey='violation_count' color='bg-orange-500' />
        </div>
      </div>

      {/* Top cameras + zones */}
      <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={Camera} label='Top Cameras' />
          <MiniBarChart
            data={top_cameras.map(c => ({ name: c.camera_name, count: c.violation_count }))}
            labelKey='name' valueKey='count' color='bg-gradient-to-r from-red-600 to-red-400'
          />
        </div>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={MapPin} label='Top Zones' />
          <MiniBarChart
            data={top_zones.map(z => ({ name: z.zone_name, count: z.violation_count }))}
            labelKey='name' valueKey='count' color='bg-gradient-to-r from-purple-600 to-purple-400'
          />
        </div>
      </div>

      {/* Daily trend */}
      <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
        <SectionTitle icon={Calendar} label='Daily Trend' />
        <DailyTable
          rows={daily_trend as unknown as Record<string, unknown>[]}
          cols={[
            { key: 'date', label: 'Date' },
            { key: 'violation_count', label: 'Violations' },
            {
              key: 'compliance_rate', label: 'Compliance',
              render: v => (
                <span className={Number(v) >= 80 ? 'text-green-400' : Number(v) >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                  {fmt(Number(v))}%
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

// ── Idle Report view ──────────────────────────────────────────────────────────

function IdleReportView({ data }: { data: IdleMonitoringReport }) {
  const { summary, hourly_trend, daily_trend, top_cameras, top_zones } = data

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
        <StatCard label='Total Events' value={summary.total_events}
          icon={Activity} color='text-blue-400' bg='bg-blue-500/10 border border-blue-500/20' />
        <StatCard label='Critical (≥1 min)' value={summary.critical_events}
          icon={AlertTriangle} color='text-red-400' bg='bg-red-500/10 border border-red-500/20' />
        <StatCard label='Avg Idle Time' value={fmtDuration(summary.avg_idle_duration)}
          sub={`Max: ${fmtDuration(summary.max_idle_duration)}`}
          icon={Clock} color='text-amber-400' bg='bg-amber-500/10 border border-amber-500/20' />
        <StatCard label='Zones Affected' value={summary.zones_affected}
          sub={`${summary.cameras_affected} cameras`}
          icon={MapPin} color='text-purple-400' bg='bg-purple-500/10 border border-purple-500/20' />
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={BarChart3} label='Hourly Events' color='text-amber-400' />
          <HourlyBars trend={hourly_trend as unknown as Record<string, number>[]} valueKey='event_count' color='bg-amber-500' />
        </div>
        <div className='grid grid-cols-1 gap-5'>
          <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
            <SectionTitle icon={Camera} label='Top Cameras by Events' />
            <MiniBarChart
              data={top_cameras.map(c => ({ name: c.camera_name, count: c.event_count }))}
              labelKey='name' valueKey='count' color='bg-gradient-to-r from-amber-600 to-amber-400'
            />
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={MapPin} label='Top Zones' />
          <MiniBarChart
            data={top_zones.map(z => ({ name: z.zone_name, count: z.event_count }))}
            labelKey='name' valueKey='count' color='bg-gradient-to-r from-orange-600 to-orange-400'
          />
        </div>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={Calendar} label='Daily Trend' />
          <DailyTable
            rows={daily_trend as unknown as Record<string, unknown>[]}
            cols={[
              { key: 'date', label: 'Date' },
              { key: 'event_count', label: 'Events' },
              { key: 'avg_duration', label: 'Avg Duration', render: v => fmtDuration(Number(v)) },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

// ── Illegal Entry Report view ─────────────────────────────────────────────────

function IllegalEntryReportView({ data }: { data: IllegalEntryReport }) {
  const { summary, hourly_trend, daily_trend, top_cameras, top_zones } = data

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
        <StatCard label='Total Events' value={summary.total_events}
          icon={Activity} color='text-blue-400' bg='bg-blue-500/10 border border-blue-500/20' />
        <StatCard label='Unauthorized' value={summary.unauthorized_count}
          icon={XCircle} color='text-red-400' bg='bg-red-500/10 border border-red-500/20' />
        <StatCard label='Authorized' value={summary.authorized_count}
          icon={CheckCircle} color='text-green-400' bg='bg-green-500/10 border border-green-500/20' />
        <StatCard label='Unique Persons' value={summary.unique_persons}
          sub={`${summary.zones_affected} zones`}
          icon={MapPin} color='text-purple-400' bg='bg-purple-500/10 border border-purple-500/20' />
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={BarChart3} label='Hourly Events' color='text-red-400' />
          <HourlyBars trend={hourly_trend as unknown as Record<string, number>[]} valueKey='unauthorized' color='bg-red-500' />
        </div>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={Camera} label='Top Cameras (Unauthorized)' />
          <MiniBarChart
            data={top_cameras.map(c => ({ name: c.camera_name, count: c.unauthorized_count }))}
            labelKey='name' valueKey='count' color='bg-gradient-to-r from-red-600 to-red-400'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={MapPin} label='Top Zones (Unauthorized)' />
          <MiniBarChart
            data={top_zones.map(z => ({ name: z.zone_name, count: z.unauthorized_count }))}
            labelKey='name' valueKey='count' color='bg-gradient-to-r from-red-600 to-orange-400'
          />
        </div>
        <div className='bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5'>
          <SectionTitle icon={Calendar} label='Daily Trend' />
          <DailyTable
            rows={daily_trend as unknown as Record<string, unknown>[]}
            cols={[
              { key: 'date', label: 'Date' },
              { key: 'unauthorized', label: 'Unauthorized', render: v => <span className='text-red-400 font-semibold'>{String(v)}</span> },
              { key: 'authorized', label: 'Authorized', render: v => <span className='text-green-400 font-semibold'>{String(v)}</span> },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

// ── Full Report view ──────────────────────────────────────────────────────────

function FullReportView({ data }: { data: FullReport }) {
  return (
    <div className='space-y-8'>
      {/* Meta */}
      <div className='flex flex-wrap gap-4 items-center px-1'>
        <div className='flex items-center gap-2 text-xs text-slate-500'>
          <Calendar className='h-3.5 w-3.5' />
          {data.date_range.start} → {data.date_range.end}
        </div>
        <div className='flex items-center gap-2 text-xs text-slate-500'>
          <Clock className='h-3.5 w-3.5' />
          Generated: {new Date(data.generated_at).toLocaleString()}
        </div>
      </div>

      {/* PPE section */}
      <section>
        <div className='flex items-center gap-3 mb-5'>
          <div className='h-8 w-8 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center'>
            <ShieldCheck className='h-4 w-4 text-cyan-400' />
          </div>
          <h2 className='text-sm font-bold text-white uppercase tracking-widest'>PPE Violations</h2>
          <div className='flex-1 h-px bg-slate-800' />
        </div>
        <PPEReportView data={data.ppe} />
      </section>

      {/* Idle section */}
      <section>
        <div className='flex items-center gap-3 mb-5'>
          <div className='h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center'>
            <TimerOff className='h-4 w-4 text-amber-400' />
          </div>
          <h2 className='text-sm font-bold text-white uppercase tracking-widest'>Idle Monitoring</h2>
          <div className='flex-1 h-px bg-slate-800' />
        </div>
        <IdleReportView data={data.idle} />
      </section>

      {/* Illegal Entry section */}
      <section>
        <div className='flex items-center gap-3 mb-5'>
          <div className='h-8 w-8 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center'>
            <ShieldAlert className='h-4 w-4 text-red-400' />
          </div>
          <h2 className='text-sm font-bold text-white uppercase tracking-widest'>Illegal Entry</h2>
          <div className='flex-1 h-px bg-slate-800' />
        </div>
        <IllegalEntryReportView data={data.illegal_entry} />
      </section>
    </div>
  )
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS: {
  id: ReportTab; label: string; icon: React.ElementType; color: string
  accentBg: string; accentBorder: string
}[] = [
  {
    id: 'ppe', label: 'PPE Violations', icon: ShieldCheck,
    color: 'text-cyan-400', accentBg: 'bg-cyan-500/10', accentBorder: 'border-cyan-500/30',
  },
  {
    id: 'idle', label: 'Idle Monitoring', icon: TimerOff,
    color: 'text-amber-400', accentBg: 'bg-amber-500/10', accentBorder: 'border-amber-500/30',
  },
  {
    id: 'illegal', label: 'Illegal Entry', icon: ShieldAlert,
    color: 'text-red-400', accentBg: 'bg-red-500/10', accentBorder: 'border-red-500/30',
  },
  {
    id: 'full', label: 'Full Report', icon: LayoutGrid,
    color: 'text-purple-400', accentBg: 'bg-purple-500/10', accentBorder: 'border-purple-500/30',
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('ppe')
  const [startDate, setStartDate] = useState(daysAgo(6))
  const [endDate, setEndDate]     = useState(today())
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError]     = useState<string | null>(null)

  const [ppeData,     setPpeData]     = useState<PPEViolationsReport | null>(null)
  const [idleData,    setIdleData]    = useState<IdleMonitoringReport | null>(null)
  const [illegalData, setIllegalData] = useState<IllegalEntryReport | null>(null)
  const [fullData,    setFullData]    = useState<FullReport | null>(null)

  const params = useCallback((): DateRangeParams => ({
    start_date: startDate,
    end_date:   endDate,
  }), [startDate, endDate])

  const fetchReport = useCallback(async (tab: ReportTab, start: string, end: string) => {
    setLoading(true)
    setError(null)
    const p: DateRangeParams = { start_date: start, end_date: end }
    try {
      switch (tab) {
        case 'ppe':
          setPpeData(await getPPEViolationsReport(p)); break
        case 'idle':
          setIdleData(await getIdleMonitoringReport(p)); break
        case 'illegal':
          setIllegalData(await getIllegalEntryReport(p)); break
        case 'full':
          setFullData(await getFullReport(p)); break
      }
    } catch (e) {
      setError((e as Error).message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch whenever tab changes (if no cached data yet)
  useEffect(() => {
    const has = activeTab === 'ppe'     ? ppeData
              : activeTab === 'idle'    ? idleData
              : activeTab === 'illegal' ? illegalData
              :                          fullData
    if (!has) fetchReport(activeTab, startDate, endDate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  function handleApplyDate(start: string, end: string) {
    setStartDate(start)
    setEndDate(end)
    // Clear cached data to force re-fetch
    setPpeData(null)
    setIdleData(null)
    setIllegalData(null)
    setFullData(null)
    fetchReport(activeTab, start, end)
  }

  function handleRefresh() {
    fetchReport(activeTab, startDate, endDate)
  }

  function handleExportJSON() {
    const d = activeTab === 'ppe'     ? ppeData
            : activeTab === 'idle'    ? idleData
            : activeTab === 'illegal' ? illegalData
            :                          fullData
    if (!d) return
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeTab}-report-${startDate}-${endDate}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownloadPDF() {
    const p: DateRangeParams = { start_date: startDate, end_date: endDate }
    setPdfLoading(true)
    setPdfError(null)
    try {
      switch (activeTab) {
        case 'ppe':     await downloadPPEViolationsPDF(p); break
        case 'idle':    await downloadIdleMonitoringPDF(p); break
        case 'illegal': await downloadIllegalEntryPDF(p); break
        case 'full':    await downloadFullReportPDF(p); break
      }
    } catch (e) {
      setPdfError((e as Error).message ?? 'PDF download failed')
    } finally {
      setPdfLoading(false)
    }
  }

  const currentTab = TABS.find(t => t.id === activeTab)!

  const activeData = activeTab === 'ppe'     ? ppeData
                   : activeTab === 'idle'    ? idleData
                   : activeTab === 'illegal' ? illegalData
                   :                          fullData

  return (
    <div className='flex-1 flex flex-col overflow-hidden bg-slate-950 min-h-0'>

      {/* ── Background grid ──────────────────────────────────────────────── */}
      <div className='absolute inset-0 pointer-events-none overflow-hidden' style={{
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className='relative px-5 pt-5 pb-4 border-b border-slate-800/60 flex-shrink-0 backdrop-blur-sm'>
        <div className='flex flex-wrap items-start justify-between gap-4 mb-5'>
          {/* Title */}
          <div className='flex items-center gap-3'>
            <div className='relative h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600/30 to-purple-700/30 border border-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/10'>
              <FileBarChart2 className='h-5 w-5 text-indigo-400' />
              <span className='absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-indigo-500 border-2 border-slate-950' />
            </div>
            <div>
              <h1 className='text-base font-black text-white tracking-tight'>Reports</h1>
              <p className='text-[11px] text-slate-500'>Industrial Safety Analytics</p>
            </div>
          </div>

          {/* Actions */}
          <div className='flex items-center gap-2'>
            <button
              onClick={handleExportJSON}
              disabled={!activeData || loading}
              className='flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 disabled:opacity-40 transition-all'
            >
              <Download className='h-3.5 w-3.5' />
              Export JSON
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={loading || pdfLoading}
              title={pdfError ?? 'Download PDF report'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all
                ${
                  pdfError
                    ? 'text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                    : 'text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30'
                }
                disabled:opacity-40`}
            >
              {pdfLoading
                ? <Loader2 className='h-3.5 w-3.5 animate-spin' />
                : <Download className='h-3.5 w-3.5' />}
              {pdfLoading ? 'Generating…' : 'Download PDF'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className='p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 disabled:opacity-40 transition-all'
              title='Refresh'
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Date filter */}
        <div className='flex items-center gap-2 mb-5 flex-wrap'>
          <Calendar className='h-3.5 w-3.5 text-slate-500 flex-shrink-0' />
          <DateFilter startDate={startDate} endDate={endDate} onApply={handleApplyDate} />
        </div>

        {/* Tabs */}
        <div className='flex gap-1.5 flex-wrap'>
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                  isActive
                    ? `${tab.accentBg} ${tab.accentBorder} ${tab.color}`
                    : 'text-slate-500 border-transparent hover:bg-slate-800/60 hover:text-slate-300'
                }`}
              >
                <Icon className='h-3.5 w-3.5' />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className='flex-1 overflow-y-auto px-5 py-5 relative'>

        {loading && <LoadingState />}

        {!loading && error && (
          <ErrorState message={error} onRetry={handleRefresh} />
        )}

        {!loading && !error && activeData && (
          <>
            {activeTab === 'ppe'     && <PPEReportView     data={ppeData!} />}
            {activeTab === 'idle'    && <IdleReportView    data={idleData!} />}
            {activeTab === 'illegal' && <IllegalEntryReportView data={illegalData!} />}
            {activeTab === 'full'    && <FullReportView    data={fullData!} />}
          </>
        )}

        {!loading && !error && !activeData && (
          <div className='flex flex-col items-center justify-center py-24 gap-4 text-slate-700'>
            <div className={`relative h-16 w-16 rounded-2xl ${currentTab.accentBg} border ${currentTab.accentBorder} flex items-center justify-center`}>
              <currentTab.icon className={`h-8 w-8 ${currentTab.color} opacity-50`} />
            </div>
            <div className='text-center'>
              <p className='text-slate-400 font-semibold'>{currentTab.label}</p>
              <p className='text-xs text-slate-600 mt-1'>
                Select a date range and click Apply to load the report
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ${currentTab.accentBg} ${currentTab.color} border ${currentTab.accentBorder} transition-all`}
            >
              <RefreshCw className='h-3.5 w-3.5' />
              Load Report
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
