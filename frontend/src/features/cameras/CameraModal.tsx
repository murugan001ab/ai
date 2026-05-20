import { useState } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import type { CameraItem } from './types'

interface Props {
  /** null = add mode, CameraItem = edit mode */
  camera: Partial<CameraItem> | null
  onClose: () => void
  onSave: (data: Partial<CameraItem>) => Promise<void>
}

const TEXT_FIELDS = [
  { key: 'name'       as const, label: 'Name',        placeholder: 'CAM-01' },
  { key: 'location'   as const, label: 'Location',    placeholder: 'Main Workshop' },
  { key: 'ip_address' as const, label: 'IP Address',  placeholder: '192.168.1.101' },
  { key: 'stream_url' as const, label: 'Stream URL',  placeholder: 'rtsp://192.168.1.101/stream' },
]

export default function CameraModal({ camera, onClose, onSave }: Props) {
  const [form, setForm]     = useState<Partial<CameraItem>>(camera ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const isEdit = !!camera?.id

  function setField<K extends keyof CameraItem>(key: K, value: CameraItem[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    // Basic client-side validation
    if (!form.name?.trim()) { setError('Name is required.'); return }
    if (!form.ip_address?.trim()) { setError('IP address is required.'); return }

    setError(null)
    setSaving(true)
    try {
      await onSave(form)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: any) => d.msg).join(', ')
            : err?.message ?? 'Failed to save camera.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl'>

        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-slate-800'>
          <h2 className='text-base font-semibold text-white'>
            {isEdit ? 'Edit Camera' : 'Add Camera'}
          </h2>
          <button onClick={onClose} className='text-slate-500 hover:text-white transition-colors'>
            <X className='h-5 w-5' />
          </button>
        </div>

        {/* Body */}
        <div className='p-6 space-y-4'>
          {TEXT_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className='block text-xs text-slate-400 mb-1.5'>{label}</label>
              <input
                value={(form[key] as string) ?? ''}
                onChange={(e) => setField(key, e.target.value as any)}
                placeholder={placeholder}
                className='w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors'
              />
            </div>
          ))}

          {/* Status */}
          <div>
            <label className='block text-xs text-slate-400 mb-1.5'>Status</label>
            <select
              value={form.status ?? 'online'}
              onChange={(e) => setField('status', e.target.value as CameraItem['status'])}
              className='w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors'
            >
              <option value='online'>Online</option>
              <option value='offline'>Offline</option>
              <option value='warning'>Warning</option>
            </select>
          </div>

          {/* FPS */}
          <div>
            <label className='block text-xs text-slate-400 mb-1.5'>FPS</label>
            <input
              type='number'
              min={0}
              max={120}
              value={form.fps ?? 30}
              onChange={(e) => setField('fps', Number(e.target.value))}
              className='w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors'
            />
          </div>

          {/* Error */}
          {error && (
            <p className='text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2'>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className='flex gap-3 px-6 py-4 border-t border-slate-800'>
          <button
            onClick={onClose}
            className='flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition-colors'
          >
            {saving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
            {isEdit ? 'Save Changes' : 'Add Camera'}
          </button>
        </div>

      </div>
    </div>
  )
}
