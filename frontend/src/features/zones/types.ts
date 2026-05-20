// ── Zone ──────────────────────────────────────────────────────────────────

export interface ZoneItem {
  id: number
  name: string
  description: string | null
  created_at: string
}

export type CreateZonePayload = { name: string; description?: string | null }
export type UpdateZonePayload = Partial<CreateZonePayload>

// ── Equipment ─────────────────────────────────────────────────────────────

export interface EquipmentItem {
  id: number
  name: string
  created_at: string
}

export type CreateEquipmentPayload = { name: string }
export type UpdateEquipmentPayload = Partial<CreateEquipmentPayload>

// ── Zone Equipment Rules ──────────────────────────────────────────────────

export interface ZoneRuleItem {
  id: number
  zone_id: number
  zone_name?: string
  equipment_id: number
  equipment_name?: string
}

export type CreateZoneRulePayload = { zone_id: number; equipment_id: number }

// ── User Zone Permissions ─────────────────────────────────────────────────

export interface ZonePermItem {
  id: number
  user_id: number
  user_name?: string
  zone_id: number
  zone_name?: string
}

export type CreateZonePermPayload = { user_id: number; zone_id: number }
