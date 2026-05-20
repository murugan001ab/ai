import { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import { FormField, Input } from '../../../components/ui/FormField'
import type { EquipmentItem, CreateEquipmentPayload, UpdateEquipmentPayload } from '../types'

interface Props {
  equipment: Partial<EquipmentItem> | null
  onClose: () => void
  onAdd: (payload: CreateEquipmentPayload) => Promise<void>
  onEdit: (id: number, payload: UpdateEquipmentPayload) => Promise<void>
}

function extractError(err: any): string {
  const d = err?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x: any) => x.msg).join(', ')
  return err?.message ?? 'Something went wrong.'
}

export default function EquipmentModal({ equipment, onClose, onAdd, onEdit }: Props) {
  const isEdit = !!equipment?.id
  const [name, setName]     = useState(equipment?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return }
    setError(null)
    setSaving(true)
    try {
      if (isEdit && equipment?.id) await onEdit(equipment.id, { name: name.trim() })
      else await onAdd({ name: name.trim() })
      onClose()
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Equipment' : 'Add Equipment'}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveLabel={isEdit ? 'Save Changes' : 'Add Equipment'}
      error={error}
    >
      <FormField label='Equipment Name'>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='e.g. Hard Hat, Safety Vest, Gloves'
          autoFocus
        />
      </FormField>
    </Modal>
  )
}
