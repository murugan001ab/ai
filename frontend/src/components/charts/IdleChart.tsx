import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type{ TrendData } from '../../types/dashboard'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className='bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl'>
      <p className='text-xs text-slate-400 mb-2'>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className='text-sm font-semibold' style={{ color: entry.color }}>
          Idle Time: {entry.value} min
        </p>
      ))}
    </div>
  )
}

export default function IdleChart({ data }: { data: TrendData[] }) {
  const avg = (data.reduce((s, d) => s + d.idle, 0) / data.length).toFixed(1)
  return (
    <div className='bg-slate-900 border border-slate-800 rounded-2xl p-5 h-[320px]'>
      <div className='flex items-center justify-between mb-5'>
        <h2 className='text-base font-semibold'>Idle Time Trend</h2>
        <span className='text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-lg'>
          avg {avg} min
        </span>
      </div>
      <ResponsiveContainer width='100%' height='85%'>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id='idleGrad' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='5%' stopColor='#f59e0b' stopOpacity={0.3} />
              <stop offset='95%' stopColor='#f59e0b' stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
          <XAxis dataKey='day' stroke='#475569' tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis stroke='#475569' tick={{ fontSize: 10 }} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type='monotone'
            dataKey='idle'
            stroke='#f59e0b'
            strokeWidth={2.5}
            fill='url(#idleGrad)'
            dot={false}
            activeDot={{ r: 5, fill: '#f59e0b', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
