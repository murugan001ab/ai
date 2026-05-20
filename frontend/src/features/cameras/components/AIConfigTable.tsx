import { Pencil, Trash2 } from 'lucide-react'
import Pagination from '../../../components/ui/Pagination'
import { TableLoading, TableError, TableEmpty } from '../../../components/ui/TableStates'
import type { AIConfigItem } from '../types'

const COLS = ['Camera', 'PPE Detection', 'Idle Detection', 'Zone Intrusion', 'Confidence', '']

const DETECTION_KEYS = ['ppe_detection', 'idle_detection', 'zone_intrusion'] as const

interface Props {
  items: AIConfigItem[]
  total: number
  pages: number
  page: number
  loading: boolean
  error: string | null
  onEdit: (config: AIConfigItem) => void
  onDelete: (id: number) => void
  onPageChange: (page: number) => void
  onRetry: () => void
}

function OnOffBadge({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
        on ? 'bg-green-400/10 text-green-400' : 'bg-slate-700/50 text-slate-500'
      }`}
    >
      {on ? 'On' : 'Off'}
    </span>
  )
}

export default function AIConfigTable({
  items, total, pages, page, loading, error,
  onEdit, onDelete, onPageChange, onRetry,
}: Props) {
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
            <TableEmpty cols={COLS.length} message='No AI configs yet. Add one to get started.' />
          ) : (
            items.map((cfg) => (
              <tr key={cfg.id} className='hover:bg-slate-800/40 transition-colors group'>
                <td className='px-5 py-4 font-medium text-white'>
                  {cfg.camera_name ?? `Camera #${cfg.camera_id}`}
                </td>
                {DETECTION_KEYS.map((key) => (
                  <td key={key} className='px-5 py-4'>
                    <OnOffBadge on={cfg[key]} />
                  </td>
                ))}
                <td className='px-5 py-4 text-slate-400'>
                  {(cfg.confidence_threshold * 100).toFixed(0)}%
                </td>
                <td className='px-5 py-4'>
                  <div className='flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity'>
                    <button
                      onClick={() => onEdit(cfg)}
                      className='p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors'
                      title='Edit'
                    >
                      <Pencil className='h-4 w-4' />
                    </button>
                    <button
                      onClick={() => onDelete(cfg.id)}
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
