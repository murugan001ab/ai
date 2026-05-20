import apiClient from '../lib/axios'
import type { PaginatedResponse, BaseResponse } from './camera.service'
import type {
  ZoneItem, CreateZonePayload, UpdateZonePayload,
  EquipmentItem, CreateEquipmentPayload, UpdateEquipmentPayload,
  ZoneRuleItem, CreateZoneRulePayload,
  ZonePermItem, CreateZonePermPayload,
} from '../features/zones/types'

export type {
  ZoneItem, CreateZonePayload, UpdateZonePayload,
  EquipmentItem, CreateEquipmentPayload, UpdateEquipmentPayload,
  ZoneRuleItem, CreateZoneRulePayload,
  ZonePermItem, CreateZonePermPayload,
}

// ── Zones ─────────────────────────────────────────────────────────────────

export async function getZones(page = 1, page_size = 10): Promise<PaginatedResponse<ZoneItem>> {
  const { data } = await apiClient.get<PaginatedResponse<ZoneItem>>('/zones', { params: { page, page_size } })
  return data
}

export async function getZone(id: number): Promise<ZoneItem> {
  const { data } = await apiClient.get<BaseResponse<ZoneItem>>(`/zones/${id}`)
  return data.data
}

export async function createZone(payload: CreateZonePayload): Promise<ZoneItem> {
  const { data } = await apiClient.post<BaseResponse<ZoneItem>>('/zones', payload)
  return data.data
}

export async function updateZone(id: number, payload: UpdateZonePayload): Promise<ZoneItem> {
  const { data } = await apiClient.patch<BaseResponse<ZoneItem>>(`/zones/${id}`, payload)
  return data.data
}

export async function deleteZone(id: number): Promise<void> {
  await apiClient.delete(`/zones/${id}`)
}

// ── Equipment ─────────────────────────────────────────────────────────────

export async function getEquipments(page = 1,page_size=10): Promise<PaginatedResponse<EquipmentItem>> {
  const { data } = await apiClient.get<PaginatedResponse<EquipmentItem>>('/equipments', { params: { page,page_size} })
  return data
}

export async function createEquipment(payload: CreateEquipmentPayload): Promise<EquipmentItem> {
  const { data } = await apiClient.post<BaseResponse<EquipmentItem>>('/equipments', payload)
  return data.data
}

export async function updateEquipment(id: number, payload: UpdateEquipmentPayload): Promise<EquipmentItem> {
  const { data } = await apiClient.patch<BaseResponse<EquipmentItem>>(`/equipments/${id}`, payload)
  return data.data
}

export async function deleteEquipment(id: number): Promise<void> {
  await apiClient.delete(`/equipments/${id}`)
}

// ── Zone Equipment Rules ──────────────────────────────────────────────────

export async function getZoneRules(page = 1, page_size = 10): Promise<PaginatedResponse<ZoneRuleItem>> {
  const { data } = await apiClient.get<PaginatedResponse<ZoneRuleItem>>('/zone-equipment-rules', { params: { page, page_size } })
  return data
}

export async function createZoneRule(payload: CreateZoneRulePayload): Promise<ZoneRuleItem> {
  const { data } = await apiClient.post<BaseResponse<ZoneRuleItem>>('/zone-equipment-rules', payload)
  return data.data
}

export async function deleteZoneRule(id: number): Promise<void> {
  await apiClient.delete(`/zone-equipment-rules/${id}`)
}

// ── User Zone Permissions ─────────────────────────────────────────────────

export async function getZonePerms(page = 1, page_size = 10): Promise<PaginatedResponse<ZonePermItem>> {
  const { data } = await apiClient.get<PaginatedResponse<ZonePermItem>>('/user-zone-permissions', { params: { page, page_size } })
  return data
}

export async function createZonePerm(payload: CreateZonePermPayload): Promise<ZonePermItem> {
  const { data } = await apiClient.post<BaseResponse<ZonePermItem>>('/user-zone-permissions', payload)
  return data.data
}

export async function deleteZonePerm(id: number): Promise<void> {
  await apiClient.delete(`/user-zone-permissions/${id}`)
}
