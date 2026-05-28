import { useState } from 'react'
import { Plus, RefreshCw, Camera } from 'lucide-react'
import { useCameras } from './hooks/useCameras'
import { useZones } from '../zones/hooks/useZones'
import CameraTable from './components/CameraTable'
import CameraModal from './components/CameraModal'
import type { CameraItem } from './types'

/**
 * Full cameras feature — tab switcher + tables + modals.
 * Rendered by the thin CameraManagement page shell.
 */
export default function CamerasFeature() {
  const cam = useCameras()
  const zones = useZones()
  const [camModal, setCamModal] = useState<Partial<CameraItem> | null | false>(false)

  const openAddCamera  = ()              => setCamModal({})
  const openEditCamera = (c: CameraItem) => setCamModal(c)
  const closeCamera    = ()              => setCamModal(false)

  const handleDeleteCamera = async (id: number) => {
    if (!window.confirm('Delete this camera? This cannot be undone.')) return
    try { await cam.remove(id) }
    catch (err: any) { alert(err?.response?.data?.detail ?? 'Failed to delete camera.') }
  }

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
            onClick={cam.reload}
            disabled={cam.loading}
            className='p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors'
            title='Refresh'
          >
            <RefreshCw className={`h-4 w-4 ${cam.loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openAddCamera}
            className='flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors'
          >
            <Plus className='h-4 w-4' />
            Add Camera
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <CameraTable
        items={cam.items}
        zones={zones.items}
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

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {camModal !== false && (
        <CameraModal
          camera={camModal}
          zones={zones.items}
          onClose={closeCamera}
          onAdd={cam.add}
          onEdit={cam.edit}
        />
      )}

    </div>
  )
}
