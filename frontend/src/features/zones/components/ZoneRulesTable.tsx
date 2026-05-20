import { Trash2 } from 'lucide-react'
import Pagination from '../../../components/ui/Pagination'
import { TableLoading, TableError, TableEmpty } from '../../../components/ui/TableStates'
import type { ZoneRuleItem } from '../types'

const COLS = ['Zone', 'Required Equipment', '']

interface Props {
  items: ZoneRuleItem[]
  total: number
  pages: number
  page: number
  loading: boolean
  error: string | null
  onDelete: (id: number) => void
  onPageChange: (page: number) => void
  onRetry: () => void
}

export default function ZoneRulesTable({
  items, total, pages, page, loading, error,
  onDelete, onPageChange, onRetry,
}: Props) {
  return (
    <div className='bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-b border-slate-800'>
            {COLS.map((h) => (
              <th key={h} className='px-5 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider'>
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
            <TableEmpty cols={COLS.length} message='No zone rules yet. Define which equipment is required per zone.' />
          ) : (
            items.map((rule) => (
              <tr key={rule.id} className='hover:bg-slate-800/40 transition-colors group'>
                <td className='px-5 py-4'>
                  <span className='inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20'>
                    {rule.zone_name ?? `Zone #${rule.zone_id}`}
                  </span>
                </td>
                <td className='px-5 py-4'>
                  <span className='inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-400/10 text-purple-400 border border-purple-400/20'>
                    {rule.equipment_name ?? `Equipment #${rule.equipment_id}`}
                  </span>
                </td>
                <td className='px-5 py-4'>
                  <div className='flex justify-end opacity-0 group-hover:opacity-100 transition-opacity'>
                    <button
                      onClick={() => onDelete(rule.id)}
                      className='p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors'
                      title='Remove rule'
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
        <Pagination page={page} pages={pages} total={total} onPrev={() => onPageChange(page - 1)} onNext={() => onPageChange(page + 1)} />
      )}
    </div>
  )
}
