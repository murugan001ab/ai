import apiClient from '../lib/axios'
import type {
  CameraItem,
  CreateCameraPayload,
  UpdateCameraPayload,
  AIConfigItem,
  CreateAIConfigPayload,
  UpdateAIConfigPayload,
} from '../features/cameras/types'

// Re-export so anything importing from the service still works
export type {
  CameraItem,
  CreateCameraPayload,
  UpdateCameraPayload,
  AIConfigItem,
  CreateAIConfigPayload,
  UpdateAIConfigPayload,
}

// ── Shared response wrappers ──────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface BaseResponse<T> {
  data: T
  message?: string
}

// ── Camera endpoints ──────────────────────────────────────────────────────

export async function getCameras(
  page = 1,
  page_size = 20,
): Promise<PaginatedResponse<CameraItem>> {
  const { data } = await apiClient.get<PaginatedResponse<CameraItem>>('/cameras', {
    params: { page, page_size },
  })
  return data
}

export async function getCamera(id: number): Promise<CameraItem> {
  const { data } = await apiClient.get<BaseResponse<CameraItem>>(`/cameras/${id}`)
  return data.data
}

export async function createCamera(payload: CreateCameraPayload): Promise<CameraItem> {
  const { data } = await apiClient.post<BaseResponse<CameraItem>>('/cameras', payload)
  return data.data
}

export async function updateCamera(
  id: number,
  payload: UpdateCameraPayload,
): Promise<CameraItem> {
  const { data } = await apiClient.patch<BaseResponse<CameraItem>>(`/cameras/${id}`, payload)
  return data.data
}

export async function deleteCamera(id: number): Promise<void> {
  await apiClient.delete(`/cameras/${id}`)
}

// ── AI Config endpoints ───────────────────────────────────────────────────

export async function getConfigs(
  page = 1,
  page_size = 20,
): Promise<PaginatedResponse<AIConfigItem>> {
  const { data } = await apiClient.get<PaginatedResponse<AIConfigItem>>('/cameras/configs', {
    params: { page, page_size },
  })
  return data
}

export async function createConfig(payload: CreateAIConfigPayload): Promise<AIConfigItem> {
  const { data } = await apiClient.post<BaseResponse<AIConfigItem>>(
    '/cameras/configs',
    payload,
  )
  return data.data
}

export async function updateConfig(
  id: number,
  payload: UpdateAIConfigPayload,
): Promise<AIConfigItem> {
  const { data } = await apiClient.patch<BaseResponse<AIConfigItem>>(
    `/cameras/configs/${id}`,
    payload,
  )
  return data.data
}

export async function deleteConfig(id: number): Promise<void> {
  await apiClient.delete(`/cameras/configs/${id}`)
}
