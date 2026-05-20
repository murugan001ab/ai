import { useState } from 'react'
import { Plus, RefreshCw, Camera } from 'lucide-react'
import { useCameras } from './hooks/useCameras'
import { useAIConfigs } from './hooks/useAIConfigs'
import CameraTable from './components/CameraTable'
import AIConfigTable from './components/AIConfigTable'
import CameraModal from './components/CameraModal'
import AIConfigModal from './components/AIConfigModal'
import type { CameraItem, AIConfigItem } from './types'

type Tab = 'cameras' | 'configs'

const TABS: { key: Tab; label: string }[] = [
  { key: 'cameras', label: 'Cameras'    },
  { key: 'configs', label: 'AI Configs' },
]

/**
 * Full cameras feature — tab switcher + tables + modals.
 * Rendered by the thin CameraManagement page shell.
 */
export default function CamerasFeature() {
  const [tab, setTab] = useState<Tab>('cameras')

  // ── Camera state ──────────────────────────────────────────────────────────
  const cam = useCameras()
  const [camModal, setCamModal] = useState<Partial<CameraItem> | null | false>(false)

  const openAddCamera  = ()                 => setCamModal({})
  const openEditCamera = (c: CameraItem)    => setCamModal(c)
  const closeCamera    = ()                 => setCamModal(false)

  const handleDeleteCamera = async (id: number) => {
    if (!window.confirm('Delete this camera? This cannot be undone.')) return
    try { await cam.remove(id) }
    catch (err: any) { alert(err?.response?.data?.detail ?? 'Failed to delete camera.') }
  }

  // ── AI Config state ───────────────────────────────────────────────────────
  const cfg = useAIConfigs()
  const [cfgModal, setCfgModal] = useState<Partial<AIConfigItem> | null | false>(false)

  const openAddConfig  = ()                  => setCfgModal({})
  const openEditConfig = (c: AIConfigItem)   => setCfgModal(c)
  const closeConfig    = ()                  => setCfgModal(false)

  const handleDeleteConfig = async (id: number) => {
    if (!window.confirm('Delete this AI config?')) return
    try { await cfg.remove(id) }
    catch (err: any) { alert(err?.response?.data?.detail ?? 'Failed to delete config.') }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isLoading = tab === 'cameras' ? cam.loading : cfg.loading
  const onRefresh = tab === 'cameras' ? cam.reload  : cfg.reload
  const onAdd     = tab === 'cameras' ? openAddCamera : openAddConfig

  return (
    <div className='flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6'>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center gap-3'>
          <div className='h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center'>
            <Camera className='h-4 w-4 text-blue-400' />
          </div>
          <div>
            <h1 className='text-lg font-bold text-white'>Camera Management</h1>
            <p className='text-xs text-slate-500'>Manage cameras and AI detection configurations</p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className='p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors'
            title='Refresh'
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onAdd}
            className='flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors'
          >
            <Plus className='h-4 w-4' />
            Add {tab === 'cameras' ? 'Camera' : 'Config'}
          </button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className='flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 w-fit mb-6'>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tables ──────────────────────────────────────────────────────── */}
      {tab === 'cameras' && (
        <CameraTable
          items={cam.items}
          total={cam.total}
          pages={cam.pages}
          page={cam.page}
          loading={cam.loading}
          error={cam.error}
          onEdit={openEditCamera}
          onDelete={handleDeleteCamera}
          onPageChange={cam.setPage}
          onRetry={cam.reload}
        />
      )}

      {tab === 'configs' && (
        <AIConfigTable
          items={cfg.items}
          total={cfg.total}
          pages={cfg.pages}
          page={cfg.page}
          loading={cfg.loading}
          error={cfg.error}
          onEdit={openEditConfig}
          onDelete={handleDeleteConfig}
          onPageChange={cfg.setPage}
          onRetry={cfg.reload}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {camModal !== false && (
        <CameraModal
          camera={camModal}
          onClose={closeCamera}
          onAdd={cam.add}
          onEdit={cam.edit}
        />
      )}

      {cfgModal !== false && (
        <AIConfigModal
          config={cfgModal}
          cameras={cam.items}
          onClose={closeConfig}
          onAdd={cfg.add}
          onEdit={cfg.edit}
        />
      )}

    </div>
  )
}
