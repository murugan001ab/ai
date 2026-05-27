import apiClient from '../lib/axios'

// ── Response wrappers ─────────────────────────────────────────────────────

export interface PPESummary {
  today_total_violations: number
  today_compliance_rate:  number
  active_cameras:         number
  most_missing_item:      string | null
  zones_with_violations:  number
}

export interface PPEDashboardData {
  zone:   { id: number; name: string; description: string | null } | null
  camera: { id: number; name: string; status: string } | null
  required_ppe: { equipment_id: number; name: string }[]
  stats: {
    total_violations: number
    total_compliant:  number
    compliance_rate:  number
    violation_rate:   number
    date:             string
  }
  /** Array from backend — NOT a plain object.  */
  equipment_breakdown: { equipment_name: string; missing_count: number }[]
  recent_violations: {
    event_id:    number
    camera_name: string | null
    image_path:  string | null
    missing_ppe: string[]
    timestamp:   string   // ISO
  }[]
  hourly_trend: { hour: number; violation_count: number }[]
}

/**
 * Camera option returned by  GET /ppe-compliance/zones/{id}/cameras
 * NOTE: the endpoint does NOT return rtsp_url / cam_url.
 *       Stream URLs are built separately via the MediaMTX proxy.
 */
export interface PPECameraOption {
  id:               number
  name:             string
  status:           string
  violations_today: number
}

// ── API calls ─────────────────────────────────────────────────────────────

export async function getPPESummary(): Promise<PPESummary> {
  const { data } = await apiClient.get<{ data: PPESummary }>('/ppe-compliance/summary')
  return data.data
}

export async function getPPEDashboard(params: {
  zone_id?:      number
  camera_id?:    number
  recent_limit?: number
}): Promise<PPEDashboardData> {
  const { data } = await apiClient.get<{ data: PPEDashboardData }>('/ppe-compliance', { params })
  return data.data
}

export async function getPPECamerasForZone(zone_id: number): Promise<PPECameraOption[]> {
  const { data } = await apiClient.get<{ data: PPECameraOption[] }>(
    `/ppe-compliance/zones/${zone_id}/cameras`,
  )
  return data.data
}
