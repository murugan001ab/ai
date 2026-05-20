// ── Camera ────────────────────────────────────────────────────────────────

export interface CameraItem {
  id: number
  name: string
  rtsp_url: string
  zone_id: number | null
  status: 'active' | 'inactive' | 'error'
}

export type CreateCameraPayload = Omit<CameraItem, 'id'>
export type UpdateCameraPayload = Partial<CreateCameraPayload>

// ── AI Config ─────────────────────────────────────────────────────────────

export interface AIConfigItem {
  id: number
  camera_id: number
  camera_name?: string
  ppe_detection: boolean
  idle_detection: boolean
  zone_intrusion: boolean
  confidence_threshold: number
}

export type CreateAIConfigPayload = Omit<AIConfigItem, 'id' | 'camera_name'>
export type UpdateAIConfigPayload = Partial<CreateAIConfigPayload>
