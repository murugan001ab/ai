// ── WebSocket raw event ───────────────────────────────────────────────────

export interface PPERawEvent {
  type: 'ppe-events'
  data: {
    id: string
    camera: string
    worker_id: string
    missing_ppe: string[]
    image_path: string
    timestamp: number    // unix epoch float (seconds)
  }
}

// ── Normalised live event (from WS) ──────────────────────────────────────

export interface PPELiveEvent {
  id:          string
  zone:        string
  camera:      string
  worker_id:   string
  missing_ppe: string[]
  image_path:  string
  timestamp:   Date
}

// ── Re-export API types so features only import from one place ────────────

export type {
  PPESummary,
  PPEDashboardData,
  PPECameraOption,
} from '../../services/ppe.service'
