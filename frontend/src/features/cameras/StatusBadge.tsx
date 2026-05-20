import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import type { CameraItem } from './types'

const STATUS_MAP = {
  online:  { Icon: Wifi,         label: 'Online',  cls: 'text-green-400 bg-green-400/10 border-green-400/20' },
  offline: { Icon: WifiOff,      label: 'Offline', cls: 'text-slate-500 bg-slate-700/40 border-slate-600/20' },
  warning: { Icon: AlertCircle,  label: 'Warning', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
}

interface Props {
  status: CameraItem['status']
}

export default function StatusBadge({ status }: Props) {
  const { Icon, label, cls } = STATUS_MAP[status] ?? STATUS_MAP.offline
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cls}`}>
      <Icon className='h-3 w-3' />
      {label}
    </span>
  )
}
