import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type{ TrendData } from '../../types/dashboard'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className='bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl'>
      <p className='text-xs text-slate-400 mb-2'>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className='text-sm font-semibold' style={{ color: entry.color }}>
          {entry.name}: {entry.value}%
        </p>
      ))}
    </div>
  )
}

export default function ComplianceChart({ data }: { data: TrendData[] }) {
  return (
    <div className='bg-slate-900 border border-slate-800 rounded-2xl p-5 h-[320px]'>
      <div className='flex items-center justify-between mb-5'>
        <h2 className='text-base font-semibold'>PPE Compliance Trend</h2>
        <span className='text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-1 rounded-lg'>
          14-day view
        </span>
      </div>
      <ResponsiveContainer width='100%' height='85%'>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
          <XAxis dataKey='day' stroke='#475569' tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis stroke='#475569' tick={{ fontSize: 10 }} tickLine={false} domain={[80, 100]} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={90} stroke='#334155' strokeDasharray='4 4' />
          <Line
            type='monotone'
            dataKey='compliance'
            name='Compliance'
            stroke='#22c55e'
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#22c55e', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
