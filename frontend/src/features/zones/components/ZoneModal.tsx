import { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import { FormField, Input } from '../../../components/ui/FormField'
import type { ZoneItem, CreateZonePayload, UpdateZonePayload } from '../types'

interface Props {
  zone: Partial<ZoneItem> | null
  onClose: () => void
  onAdd: (payload: CreateZonePayload) => Promise<void>
  onEdit: (id: number, payload: UpdateZonePayload) => Promise<void>
}

function extractError(err: any): string {
  const d = err?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x: any) => x.msg).join(', ')
  return err?.message ?? 'Something went wrong.'
}

export default function ZoneModal({ zone, onClose, onAdd, onEdit }: Props) {
  const isEdit = !!zone?.id
  const [name, setName]             = useState(zone?.name ?? '')
  const [description, setDesc]      = useState(zone?.description ?? '')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return }
    setError(null)
    setSaving(true)
    try {
      const payload = { name: name.trim(), description: description.trim() || null }
      if (isEdit && zone?.id) await onEdit(zone.id, payload)
      else await onAdd(payload)
      onClose()
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Zone' : 'Add Zone'}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveLabel={isEdit ? 'Save Changes' : 'Add Zone'}
      error={error}
    >
      <FormField label='Name'>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Main Workshop' />
      </FormField>
      <FormField label='Description (optional)'>
        <Input value={description} onChange={(e) => setDesc(e.target.value)} placeholder='Brief description…' />
      </FormField>
    </Modal>
  )
}
