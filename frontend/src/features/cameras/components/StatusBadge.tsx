import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import type { CameraItem } from '../types'

const STATUS_MAP: Record<
  CameraItem['status'],
  { Icon: React.ElementType; label: string; cls: string }
> = {
  active:   { Icon: CheckCircle2, label: 'Active',   cls: 'text-green-400 bg-green-400/10 border-green-400/20' },
  inactive: { Icon: XCircle,      label: 'Inactive', cls: 'text-slate-500 bg-slate-700/40 border-slate-600/20' },
  error:    { Icon: AlertCircle,  label: 'Error',    cls: 'text-red-400   bg-red-400/10   border-red-400/20'   },
}

export default function StatusBadge({ status }: { status: CameraItem['status'] }) {
  const { Icon, label, cls } = STATUS_MAP[status] ?? STATUS_MAP.inactive
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cls}`}>
      <Icon className='h-3 w-3' />
      {label}
    </span>
  )
}
