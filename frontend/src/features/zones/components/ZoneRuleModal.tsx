import { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import { FormField, Select } from '../../../components/ui/FormField'
import type { ZoneItem, EquipmentItem, CreateZoneRulePayload } from '../types'

interface Props {
  zones: ZoneItem[]
  equipment: EquipmentItem[]
  onClose: () => void
  onAdd: (payload: CreateZoneRulePayload) => Promise<void>
}

function extractError(err: any): string {
  const d = err?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x: any) => x.msg).join(', ')
  return err?.message ?? 'Something went wrong.'
}

export default function ZoneRuleModal({ zones, equipment, onClose, onAdd }: Props) {
  const [zoneId, setZoneId]         = useState<number | ''>('')
  const [equipmentId, setEquipId]   = useState<number | ''>('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSave() {
    if (!zoneId)     { setError('Please select a zone.');      return }
    if (!equipmentId){ setError('Please select equipment.');   return }
    setError(null)
    setSaving(true)
    try {
      await onAdd({ zone_id: Number(zoneId), equipment_id: Number(equipmentId) })
      onClose()
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title='Add Zone Rule'
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveLabel='Add Rule'
      error={error}
    >
      <FormField label='Zone'>
        <Select value={zoneId} onChange={(e) => setZoneId(Number(e.target.value))}>
          <option value=''>Select zone…</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </Select>
      </FormField>

      <FormField label='Required Equipment'>
        <Select value={equipmentId} onChange={(e) => setEquipId(Number(e.target.value))}>
          <option value=''>Select equipment…</option>
          {equipment.map((eq) => (
            <option key={eq.id} value={eq.id}>{eq.name}</option>
          ))}
        </Select>
      </FormField>
    </Modal>
  )
}
