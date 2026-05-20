import { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import { FormField, Select, Toggle } from '../../../components/ui/FormField'
import type { AIConfigItem, CameraItem, CreateAIConfigPayload, UpdateAIConfigPayload } from '../types'

interface Props {
  config: Partial<AIConfigItem> | null
  cameras: CameraItem[]
  onClose: () => void
  onAdd: (payload: CreateAIConfigPayload) => Promise<void>
  onEdit: (id: number, payload: UpdateAIConfigPayload) => Promise<void>
}

const EMPTY: Partial<AIConfigItem> = {
  camera_id: undefined,
  ppe_detection: false,
  idle_detection: false,
  zone_intrusion: false,
  confidence_threshold: 0.75,
}

const TOGGLE_FIELDS: { key: keyof Pick<AIConfigItem, 'ppe_detection' | 'idle_detection' | 'zone_intrusion'>; label: string }[] = [
  { key: 'ppe_detection',  label: 'PPE Detection'  },
  { key: 'idle_detection', label: 'Idle Detection' },
  { key: 'zone_intrusion', label: 'Zone Intrusion' },
]

function extractError(err: any): string {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(', ')
  return err?.message ?? 'Something went wrong.'
}

export default function AIConfigModal({ config, cameras, onClose, onAdd, onEdit }: Props) {
  const isEdit = !!config?.id
  const [form, setForm]     = useState<Partial<AIConfigItem>>(config ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function set<K extends keyof AIConfigItem>(key: K, value: AIConfigItem[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.camera_id) { setError('Please select a camera.'); return }

    setError(null)
    setSaving(true)
    try {
      const payload = {
        camera_id:            form.camera_id,
        ppe_detection:        form.ppe_detection        ?? false,
        idle_detection:       form.idle_detection       ?? false,
        zone_intrusion:       form.zone_intrusion       ?? false,
        confidence_threshold: form.confidence_threshold ?? 0.75,
      }
      if (isEdit && config?.id) {
        await onEdit(config.id, payload)
      } else {
        await onAdd(payload)
      }
      onClose()
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const threshold = form.confidence_threshold ?? 0.75

  return (
    <Modal
      title={isEdit ? 'Edit AI Config' : 'Add AI Config'}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveLabel={isEdit ? 'Save Changes' : 'Add Config'}
      error={error}
    >
      {/* Camera picker */}
      <FormField label='Camera'>
        <Select
          value={form.camera_id ?? ''}
          onChange={(e) => set('camera_id', Number(e.target.value))}
        >
          <option value=''>Select camera…</option>
          {cameras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>

      {/* Detection toggles */}
      {TOGGLE_FIELDS.map(({ key, label }) => (
        <Toggle
          key={key}
          label={label}
          checked={!!form[key]}
          onChange={(val) => set(key, val as any)}
        />
      ))}

      {/* Confidence threshold */}
      <div>
        <label className='block text-xs text-slate-400 mb-1.5'>
          Confidence Threshold —{' '}
          <span className='text-blue-400'>{(threshold * 100).toFixed(0)}%</span>
        </label>
        <input
          type='range'
          min={0.5}
          max={1}
          step={0.01}
          value={threshold}
          onChange={(e) => set('confidence_threshold', Number(e.target.value))}
          className='w-full accent-blue-500'
        />
        <div className='flex justify-between text-xs text-slate-600 mt-1'>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </Modal>
  )
}
