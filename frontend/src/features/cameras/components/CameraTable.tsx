import { Pencil, Trash2 } from 'lucide-react'
import Pagination from '../../../components/ui/Pagination'
import { TableLoading, TableError, TableEmpty } from '../../../components/ui/TableStates'
import StatusBadge from './StatusBadge'
import type { CameraItem } from '../types'
import type { ZoneItem } from '../../zones/types'

const COLS = ['Name', 'RTSP URL', 'Zone', 'Status', '']

interface Props {
  items: CameraItem[]
  zones: ZoneItem[]
  total: number
  pages: number
  page: number
  loading: boolean
  error: string | null
  onEdit: (camera: CameraItem) => void
  onDelete: (id: number) => void
  onPageChange: (page: number) => void
  onRetry: () => void
}

export default function CameraTable({
  items, zones, total, pages, page, loading, error,
  onEdit, onDelete, onPageChange, onRetry,
}: Props) {
  const zoneMap = new Map(zones.map((z) => [z.id, z.name]))
  return (
    <div className='bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-b border-slate-800'>
            {COLS.map((h) => (
              <th
                key={h}
                className='px-5 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider'
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-slate-800'>
          {loading ? (
            <TableLoading cols={COLS.length} />
          ) : error ? (
            <TableError cols={COLS.length} message={error} onRetry={onRetry} />
          ) : items.length === 0 ? (
            <TableEmpty cols={COLS.length} message='No cameras found. Add one to get started.' />
          ) : (
            items.map((cam) => (
              <tr key={cam.id} className='hover:bg-slate-800/40 transition-colors group'>
                <td className='px-5 py-4 font-medium text-white'>{cam.name}</td>
                <td className='px-5 py-4 text-slate-400 font-mono text-xs max-w-xs truncate'>
                  {cam.rtsp_url}
                </td>
                <td className='px-5 py-4 text-slate-400'>
                  {cam.zone_id != null
                    ? (zoneMap.get(cam.zone_id) ?? `Zone ${cam.zone_id}`)
                    : <span className='text-slate-600'>—</span>}
                </td>
                <td className='px-5 py-4'>
                  <StatusBadge status={cam.status} />
                </td>
                <td className='px-5 py-4'>
                  <div className='flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity'>
                    <button
                      onClick={() => onEdit(cam)}
                      className='p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors'
                      title='Edit'
                    >
                      <Pencil className='h-4 w-4' />
                    </button>
                    <button
                      onClick={() => onDelete(cam.id)}
                      className='p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors'
                      title='Delete'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!loading && !error && (
        <Pagination
          page={page}
          pages={pages}
          total={total}
          onPrev={() => onPageChange(page - 1)}
          onNext={() => onPageChange(page + 1)}
        />
      )}
    </div>
  )
}
