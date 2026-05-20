import { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import { FormField, Input, Select } from '../../../components/ui/FormField'
import type { CameraItem, CreateCameraPayload, UpdateCameraPayload } from '../types'

interface Props {
  /** null → add mode, populated → edit mode */
  camera: Partial<CameraItem> | null
  onClose: () => void
  onAdd: (payload: CreateCameraPayload) => Promise<void>
  onEdit: (id: number, payload: UpdateCameraPayload) => Promise<void>
}

const EMPTY: Partial<CameraItem> = { name: '', rtsp_url: '', zone_id: null, status: 'active' }

function extractError(err: any): string {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(', ')
  return err?.message ?? 'Something went wrong.'
}

export default function CameraModal({ camera, onClose, onAdd, onEdit }: Props) {
  const isEdit = !!camera?.id
  const [form, setForm]     = useState<Partial<CameraItem>>(camera ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function set<K extends keyof CameraItem>(key: K, value: CameraItem[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.name?.trim())     { setError('Name is required.');     return }
    if (!form.rtsp_url?.trim()) { setError('RTSP URL is required.'); return }

    setError(null)
    setSaving(true)
    try {
      if (isEdit && camera?.id) {
        const { id, ...rest } = form as CameraItem
        await onEdit(camera.id, rest)
      } else {
        await onAdd({
          name:     form.name!,
          rtsp_url: form.rtsp_url!,
          zone_id:  form.zone_id ?? null,
          status:   form.status ?? 'active',
        })
      }
      onClose()
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Camera' : 'Add Camera'}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveLabel={isEdit ? 'Save Changes' : 'Add Camera'}
      error={error}
    >
      <FormField label='Name'>
        <Input
          value={form.name ?? ''}
          onChange={(e) => set('name', e.target.value)}
          placeholder='CAM-01 — Main Entrance'
        />
      </FormField>

      <FormField label='RTSP URL'>
        <Input
          value={form.rtsp_url ?? ''}
          onChange={(e) => set('rtsp_url', e.target.value)}
          placeholder='rtsp://192.168.1.101/stream'
          className='font-mono'
        />
      </FormField>

      <FormField label='Zone ID (optional)'>
        <Input
          type='number'
          value={form.zone_id ?? ''}
          onChange={(e) => set('zone_id', e.target.value ? Number(e.target.value) : null)}
          placeholder='Leave blank for none'
        />
      </FormField>

      <FormField label='Status'>
        <Select
          value={form.status ?? 'active'}
          onChange={(e) => set('status', e.target.value as CameraItem['status'])}
        >
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
          <option value='error'>Error</option>
        </Select>
      </FormField>
    </Modal>
  )
}
