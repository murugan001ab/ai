import { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import { FormField, Input, Select } from '../../../components/ui/FormField'
import type { ZoneItem, CreateZonePermPayload } from '../types'

interface Props {
  zones: ZoneItem[]
  onClose: () => void
  onAdd: (payload: CreateZonePermPayload) => Promise<void>
}

function extractError(err: any): string {
  const d = err?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x: any) => x.msg).join(', ')
  return err?.message ?? 'Something went wrong.'
}

export default function ZonePermModal({ zones, onClose, onAdd }: Props) {
  const [userId, setUserId] = useState<string>('')
  const [zoneId, setZoneId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSave() {
    const uid = Number(userId)
    if (!uid || isNaN(uid))  { setError('Please enter a valid User ID.'); return }
    if (!zoneId)              { setError('Please select a zone.');         return }
    setError(null)
    setSaving(true)
    try {
      await onAdd({ user_id: uid, zone_id: Number(zoneId) })
      onClose()
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title='Grant Zone Permission'
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveLabel='Grant Access'
      error={error}
    >
      <FormField label='User ID'>
        <Input
          type='number'
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder='Enter user ID'
        />
      </FormField>

      <FormField label='Zone'>
        <Select value={zoneId} onChange={(e) => setZoneId(Number(e.target.value))}>
          <option value=''>Select zone…</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </Select>
      </FormField>
    </Modal>
  )
}
