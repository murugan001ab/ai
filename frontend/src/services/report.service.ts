import apiClient from '../lib/axios'

// ── Shared params ──────────────────────────────────────────────────────────

export interface DateRangeParams {
  start_date?: string   // ISO date string  e.g. "2026-05-01"
  end_date?:   string
  zone_id?:    number
  camera_id?:  number
}

// ── PPE Violations Report ──────────────────────────────────────────────────

export interface PPEViolationsReport {
  summary: {
    total_violations:     number
    total_compliant:      number
    compliance_rate:      number
    violation_rate:       number
    most_missing_item:    string | null
    zones_affected:       number
    cameras_affected:     number
  }
  equipment_breakdown: { equipment_name: string; missing_count: number; percentage: number }[]
  hourly_trend:        { hour: number; violation_count: number }[]
  daily_trend:         { date: string; violation_count: number; compliance_rate: number }[]
  top_cameras:         { camera_id: number; camera_name: string; violation_count: number }[]
  top_zones:           { zone_id: number; zone_name: string; violation_count: number }[]
  violations: {
    event_id:    number
    camera_name: string | null
    zone_name:   string | null
    image_path:  string | null
    missing_ppe: string[]
    timestamp:   string
  }[]
}

// ── Idle Monitoring Report ─────────────────────────────────────────────────

export interface IdleMonitoringReport {
  summary: {
    total_events:      number
    critical_events:   number   // >= 60 s
    warning_events:    number   // < 60 s
    avg_idle_duration: number   // seconds
    max_idle_duration: number
    cameras_affected:  number
    zones_affected:    number
  }
  hourly_trend:  { hour: number; event_count: number; avg_duration: number }[]
  daily_trend:   { date: string; event_count: number; avg_duration: number }[]
  top_cameras:   { camera_id: number; camera_name: string; event_count: number; avg_duration: number }[]
  top_zones:     { zone_id: number; zone_name: string; event_count: number }[]
  events: {
    id:            number
    name:          string
    camera_id:     number
    zone_id:       number
    idle_duration: number
    image_path:    string
    timestamp:     number
  }[]
}

// ── Illegal Entry Report ───────────────────────────────────────────────────

export interface IllegalEntryReport {
  summary: {
    total_events:       number
    unauthorized_count: number
    authorized_count:   number
    unique_persons:     number
    cameras_affected:   number
    zones_affected:     number
  }
  hourly_trend: { hour: number; unauthorized: number; authorized: number }[]
  daily_trend:  { date: string; unauthorized: number; authorized: number }[]
  top_cameras:  { camera_id: number; camera_name: string; unauthorized_count: number }[]
  top_zones:    { zone_id: number; zone_name: string; unauthorized_count: number }[]
  events: {
    id:         number
    name:       string
    event_name: string
    camera_id:  number
    zone_id:    number
    similarity: number
    authorized: boolean
    image_path: string
    timestamp:  number
  }[]
}

// ── Full Report ────────────────────────────────────────────────────────────

export interface FullReport {
  generated_at:  string
  date_range:    { start: string; end: string }
  ppe:           PPEViolationsReport
  idle:          IdleMonitoringReport
  illegal_entry: IllegalEntryReport
}

// ── JSON API calls ─────────────────────────────────────────────────────────

export async function getPPEViolationsReport(params?: DateRangeParams): Promise<PPEViolationsReport> {
  const { data } = await apiClient.get<{ data: PPEViolationsReport }>('/reports/ppe-violations', { params })
  return data.data
}

export async function getIdleMonitoringReport(params?: DateRangeParams): Promise<IdleMonitoringReport> {
  const { data } = await apiClient.get<{ data: IdleMonitoringReport }>('/reports/idle-monitoring', { params })
  return data.data
}

export async function getIllegalEntryReport(params?: DateRangeParams): Promise<IllegalEntryReport> {
  const { data } = await apiClient.get<{ data: IllegalEntryReport }>('/reports/illegal-entry', { params })
  return data.data
}

export async function getFullReport(params?: DateRangeParams): Promise<FullReport> {
  const { data } = await apiClient.get<{ data: FullReport }>('/reports/full', { params })
  return data.data
}

// ── PDF download helpers ───────────────────────────────────────────────────
// These call the /pdf sub-routes which stream a PDF blob, then trigger a
// browser download. We use raw fetch() (not axios) so we can handle the
// binary response properly.

function _buildPdfUrl(path: string, params?: DateRangeParams): string {
  // Use the same base URL as the axios instance
  const base = (import.meta.env.VITE_API_BASE_URL ?? '') + path
  const qs = new URLSearchParams()
  if (params?.start_date) qs.set('start_date', params.start_date)
  if (params?.end_date)   qs.set('end_date',   params.end_date)
  const q = qs.toString()
  return q ? `${base}?${q}` : base
}

async function _downloadPdf(url: string, filename: string): Promise<void> {
  // Use credentials: 'include' to send the httpOnly auth cookies (same as axios withCredentials)
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`PDF download failed (HTTP ${res.status})`)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

export function downloadPPEViolationsPDF(params?: DateRangeParams): Promise<void> {
  return _downloadPdf(
    _buildPdfUrl('/reports/ppe-violations/pdf', params),
    `ppe-violations-${params?.start_date ?? 'report'}-${params?.end_date ?? ''}.pdf`,
  )
}

export function downloadIdleMonitoringPDF(params?: DateRangeParams): Promise<void> {
  return _downloadPdf(
    _buildPdfUrl('/reports/idle-monitoring/pdf', params),
    `idle-monitoring-${params?.start_date ?? 'report'}-${params?.end_date ?? ''}.pdf`,
  )
}

export function downloadIllegalEntryPDF(params?: DateRangeParams): Promise<void> {
  return _downloadPdf(
    _buildPdfUrl('/reports/illegal-entry/pdf', params),
    `illegal-entry-${params?.start_date ?? 'report'}-${params?.end_date ?? ''}.pdf`,
  )
}

export function downloadFullReportPDF(params?: DateRangeParams): Promise<void> {
  return _downloadPdf(
    _buildPdfUrl('/api/v1/reports/full/pdf', params),
    `full-report-${params?.start_date ?? 'report'}-${params?.end_date ?? ''}.pdf`,
  )
}
