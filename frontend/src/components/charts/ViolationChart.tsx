import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import type { ViolationData } from '../../types/dashboard'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className='bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl'>
      <p className='text-xs text-slate-400 mb-1'>{label}</p>
      <p className='text-sm font-semibold text-red-400'>{payload[0].value} violations</p>
    </div>
  )
}

export default function ViolationChart({ data }: { data: ViolationData[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div className='bg-slate-900 border border-slate-800 rounded-2xl p-5 h-[320px]'>
      <div className='flex items-center justify-between mb-5'>
        <h2 className='text-base font-semibold'>PPE Violations Breakdown</h2>
        <span className='text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-1 rounded-lg'>
          {total} total
        </span>
      </div>
      <ResponsiveContainer width='100%' height='85%'>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' vertical={false} />
          <XAxis dataKey='type' stroke='#475569' tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis stroke='#475569' tick={{ fontSize: 10 }} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey='count' radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color ?? '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
