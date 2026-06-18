import { useEffect, useState, useCallback } from 'react'
import {
  ShieldCheck, Users, AlertTriangle, Camera, Clock, TrendingUp, TrendingDown,
  Wifi, WifiOff, AlertCircle, Eye, RefreshCw, CheckCircle2,
} from 'lucide-react'

import IdleChart from '../components/charts/IdleChart'
import ViolationChart from '../components/charts/ViolationChart'
import ShiftSummary from '../components/charts/ShiftSummary'
import ComplianceChart from '../components/charts/ComplianceChart'
import AlertsPanel from '../components/AlertsPanel'

import { getPPESummary } from '../services/ppe.service'
import { getPPEViolationsReport, getIdleMonitoringReport } from '../services/report.service'
import { getCameras } from '../services/camera.service'

import type { TrendData, ViolationData, Stat, Alert, Camera as CameraType } from '../types/dashboard'
import type { PPESummary } from '../services/ppe.service'
import type { PPEViolationsReport, IdleMonitoringReport } from '../services/report.service'
import type { CameraItem } from '../services/camera.service'

// ── helpers ───────────────────────────────────────────────────────────────

/** Map camera service status strings → dashboard union */
function mapStatus(s: string): 'online' | 'offline' | 'warning' {
  if (s === 'online') return 'online'
  if (s === 'offline') return 'offline'
  return 'warning'
}

/** Build stats cards from real API data */
function buildStats(
  summary: PPESummary,
  ppeReport: PPEViolationsReport,
  idleReport: IdleMonitoringReport,
  totalCameras: number,
): Stat[] {
  const complianceDelta = ppeReport.daily_trend.length >= 2
    ? (ppeReport.daily_trend.at(-1)!.compliance_rate - ppeReport.daily_trend.at(-2)!.compliance_rate).toFixed(1)
    : null

  const violationDelta = ppeReport.daily_trend.length >= 2
    ? ppeReport.daily_trend.at(-1)!.violation_count - ppeReport.daily_trend.at(-2)!.violation_count
    : null

  const avgIdleMin = idleReport.summary.avg_idle_duration > 0
    ? (idleReport.summary.avg_idle_duration / 60).toFixed(1)
    : '0.0'

  return [
    {
      title: 'PPE Compliance',
      value: `${summary.today_compliance_rate.toFixed(1)}%`,
      delta: complianceDelta != null ? `${Number(complianceDelta) >= 0 ? '+' : ''}${complianceDelta}%` : undefined,
      deltaType: complianceDelta != null ? (Number(complianceDelta) >= 0 ? 'up' : 'down') : undefined,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      icon: 'shield-check',
    },
    {
      title: 'PPE Violations',
      value: String(summary.today_total_violations),
      delta: violationDelta != null ? `${violationDelta >= 0 ? '+' : ''}${violationDelta}` : undefined,
      deltaType: violationDelta != null ? (violationDelta <= 0 ? 'up' : 'down') : undefined,
      color: 'text-red-400',
      bgColor: 'bg-red-400/10',
      icon: 'alert-triangle',
    },
    {
      title: 'Active Cameras',
      value: `${summary.active_cameras}/${totalCameras}`,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      icon: 'camera',
    },
    {
      title: 'Zones w/ Violations',
      value: String(summary.zones_with_violations),
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      icon: 'users',
    },
    {
      title: 'Avg Idle Time',
      value: `${avgIdleMin} min`,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-400/10',
      icon: 'clock',
    },
    {
      title: 'Idle Events',
      value: String(idleReport.summary.total_events),
      delta: idleReport.summary.critical_events > 0
        ? `${idleReport.summary.critical_events} critical`
        : undefined,
      deltaType: idleReport.summary.critical_events > 0 ? 'down' : undefined,
      color: 'text-orange-400',
      bgColor: 'bg-orange-400/10',
      icon: 'trending-up',
    },
  ]
}

/** Convert PPE daily_trend → TrendData for charts */
function buildTrendData(
  ppeReport: PPEViolationsReport,
  idleReport: IdleMonitoringReport,
): TrendData[] {
  const idleMap = new Map(idleReport.daily_trend.map((d) => [d.date, d.avg_duration / 60]))
  return ppeReport.daily_trend.map((d) => ({
    day: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    compliance: parseFloat(d.compliance_rate.toFixed(1)),
    violations: d.violation_count,
    idle: parseFloat((idleMap.get(d.date) ?? 0).toFixed(1)),
  }))
}

/** Convert PPE equipment_breakdown → ViolationData */
function buildViolationData(ppeReport: PPEViolationsReport): ViolationData[] {
  const palette = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#06b6d4', '#22c55e']
  return ppeReport.equipment_breakdown.map((e, i) => ({
    type: e.equipment_name,
    count: e.missing_count,
    color: palette[i % palette.length],
  }))
}

/** Build recent alerts from PPE violation events */
function buildAlerts(ppeReport: PPEViolationsReport): Alert[] {
  return ppeReport.violations.slice(0, 8).map((v, idx) => ({
    id: `alert-${v.event_id}`,
    message: `PPE Violation: Missing ${v.missing_ppe.join(', ')}`,
    camera: v.camera_name ?? `Camera #${idx + 1}`,
    severity: v.missing_ppe.length >= 2 ? 'critical' : 'warning',
    timestamp: new Date(v.timestamp),
    acknowledged: false,
  }))
}

/** Map CameraItem[] → Camera[] for the live feed grid */
function buildCameras(items: CameraItem[]): CameraType[] {
  return items.slice(0, 6).map((c) => ({
    id: String(c.id),
    name: c.name,
    area: (c as any).zone_name ?? (c as any).location ?? 'Zone',
    image: `https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=800&auto=format&fit=crop`,
    status: mapStatus(c.status),
    persons: (c as any).persons ?? 0,
    violations: (c as any).violations_today ?? 0,
    fps: (c as any).fps ?? 25,
  }))
}

// ── icon map ──────────────────────────────────────────────────────────────

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'shield-check': ShieldCheck,
  users: Users,
  'alert-triangle': AlertTriangle,
  camera: Camera,
  clock: Clock,
  'trending-up': TrendingUp,
}

// ── skeleton ──────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-800 rounded-xl ${className ?? ''}`} />
}

// ── component ─────────────────────────────────────────────────────────────

interface DashboardState {
  stats: Stat[]
  trendData: TrendData[]
  violations: ViolationData[]
  alerts: Alert[]
  cameras: CameraType[]
  complianceRate: number
  activeWorkers: number
  incidents: number
  lastUpdated: Date | null
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const [summary, ppeReport, idleReport, camerasPage] = await Promise.all([
        getPPESummary(),
        getPPEViolationsReport({ start_date: startOfMonth, end_date: todayStr }),
        getIdleMonitoringReport({ start_date: startOfMonth, end_date: todayStr }),
        getCameras(1, 6),
      ])

      const trendData = buildTrendData(ppeReport, idleReport)

      setData({
        stats: buildStats(summary, ppeReport, idleReport, camerasPage.total),
        trendData,
        violations: buildViolationData(ppeReport),
        alerts: buildAlerts(ppeReport),
        cameras: buildCameras(camerasPage.data),
        complianceRate: summary.today_compliance_rate,
        activeWorkers: camerasPage.total,
        incidents: idleReport.summary.critical_events,
        lastUpdated: new Date(),
      })
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [startOfMonth, todayStr])

  useEffect(() => {
    fetchAll()
    // auto-refresh every 60 s
    const id = setInterval(() => fetchAll(true), 60_000)
    return () => clearInterval(id)
  }, [fetchAll])

  // ── loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <div className='px-6 py-4 border-b border-slate-800'>
          <Skeleton className='h-7 w-56' />
        </div>
        <div className='flex-1 overflow-y-auto px-6 py-6 space-y-6'>
          <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4'>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-28' />)}
          </div>
          <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
            <Skeleton className='xl:col-span-2 h-[320px]' />
            <Skeleton className='h-[320px]' />
          </div>
          <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
            <Skeleton className='h-[320px]' />
            <Skeleton className='h-[320px]' />
          </div>
          <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
            <Skeleton className='xl:col-span-2 h-[420px]' />
            <Skeleton className='h-[420px]' />
          </div>
        </div>
      </div>
    )
  }

  // ── error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 px-6'>
        <AlertTriangle className='h-12 w-12 text-red-400' />
        <p className='text-lg font-semibold text-white'>Failed to load dashboard</p>
        <p className='text-sm text-slate-500 text-center max-w-md'>{error}</p>
        <button
          onClick={() => fetchAll()}
          className='mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors'
        >
          <RefreshCw className='h-4 w-4' /> Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>

      {/* ── Header ── */}
      <div className='px-6 py-4 border-b border-slate-800 flex items-center justify-between'>
        <div>
          <h1 className='text-lg font-semibold text-white'>Overview</h1>
          {data.lastUpdated && (
            <p className='text-xs text-slate-500 mt-0.5 flex items-center gap-1.5'>
              <CheckCircle2 className='h-3 w-3 text-green-500' />
              Last updated {data.lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className='flex items-center gap-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50'
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className='flex-1 overflow-y-auto px-6 py-6 space-y-6'>

        {/* ── Stats ── */}
        <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4'>
          {data.stats.map((stat) => {
            const Icon = iconMap[stat.icon]
            return (
              <div
                key={stat.title}
                className='bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 hover:border-slate-600 transition-all duration-200'
              >
                <div className='flex items-center justify-between'>
                  <span className='text-xs text-slate-400 font-medium uppercase tracking-wide'>
                    {stat.title}
                  </span>
                  <div className={`${stat.bgColor} p-2 rounded-lg`}>
                    {Icon && <Icon className={`h-4 w-4 ${stat.color}`} />}
                  </div>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  {stat.delta && (
                    <p className='text-xs mt-1 flex items-center gap-1'>
                      {stat.deltaType === 'up'
                        ? <TrendingUp className='h-3 w-3 text-green-400' />
                        : <TrendingDown className='h-3 w-3 text-red-400' />}
                      <span className={stat.deltaType === 'up' ? 'text-green-400' : 'text-red-400'}>
                        {stat.delta}
                      </span>
                      <span className='text-slate-500'>vs yesterday</span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Charts row 1 ── */}
        <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
          <div className='xl:col-span-2'>
            <ComplianceChart data={data.trendData} />
          </div>
          <ShiftSummary
            complianceRate={data.complianceRate}
            activeWorkers={data.activeWorkers}
            incidents={data.incidents}
          />
        </div>

        {/* ── Charts row 2 ── */}
        <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
          <ViolationChart data={data.violations} />
          <IdleChart data={data.trendData} />
        </div>

        {/* ── Cameras + Alerts ── */}
        <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
          <div className='xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5'>
            <div className='flex items-center justify-between mb-5'>
              <h2 className='text-lg font-semibold'>Live Camera Feeds</h2>
              <span className='text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full'>
                {data.cameras.filter((c) => c.status === 'online').length} / {data.cameras.length} Online
              </span>
            </div>

            {data.cameras.length === 0 ? (
              <div className='flex flex-col items-center justify-center h-36 text-slate-500 gap-2'>
                <Camera className='h-8 w-8' />
                <p className='text-sm'>No cameras found</p>
              </div>
            ) : (
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                {data.cameras.map((cam) => (
                  <div
                    key={cam.id}
                    className='relative group rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-all duration-200 cursor-pointer'
                  >
                    <img
                      src={cam.image}
                      alt={cam.name}
                      className='w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300'
                    />
                    <div className='absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent' />

                    {/* Status badge */}
                    <div className='absolute top-2 right-2'>
                      {cam.status === 'online' && (
                        <span className='flex items-center gap-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full'>
                          <Wifi className='h-3 w-3' /> LIVE
                        </span>
                      )}
                      {cam.status === 'warning' && (
                        <span className='flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full'>
                          <AlertCircle className='h-3 w-3' /> WARN
                        </span>
                      )}
                      {cam.status === 'offline' && (
                        <span className='flex items-center gap-1 text-xs bg-slate-700/60 text-slate-400 border border-slate-600 px-2 py-0.5 rounded-full'>
                          <WifiOff className='h-3 w-3' /> OFF
                        </span>
                      )}
                    </div>

                    {/* Hover eye */}
                    <div className='absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'>
                      <div className='bg-blue-600/80 rounded-full p-2'>
                        <Eye className='h-5 w-5 text-white' />
                      </div>
                    </div>

                    {/* Info */}
                    <div className='absolute bottom-0 left-0 right-0 p-3'>
                      <p className='text-sm font-semibold'>{cam.name}</p>
                      <p className='text-xs text-slate-400'>{cam.area}</p>
                      <div className='flex gap-3 mt-1'>
                        {cam.persons > 0 && (
                          <span className='text-xs text-blue-400'>{cam.persons} persons</span>
                        )}
                        {cam.violations > 0 && (
                          <span className='text-xs text-red-400'>{cam.violations} violations</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <AlertsPanel alerts={data.alerts} />
        </div>

      </div>
    </div>
  )
}
