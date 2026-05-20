import { ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts'

export default function ShiftSummary() {
  const efficiency = 88.2
  const data = [{ name: 'Efficiency', value: efficiency, fill: '#22c55e' }]

  return (
    <div className='bg-slate-900 border border-slate-800 rounded-2xl p-5 h-[320px] flex flex-col'>
      <div className='flex items-center justify-between mb-2'>
        <h2 className='text-base font-semibold'>Shift Summary</h2>
        <span className='text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg'>Morning Shift</span>
      </div>
      <div className='flex-1 flex flex-col items-center justify-center'>
        <div className='relative h-[140px] w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <RadialBarChart innerRadius='65%' outerRadius='95%' data={data} startAngle={180} endAngle={0}>
              <RadialBar dataKey='value' background={{ fill: '#1e293b' }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className='absolute inset-0 flex flex-col items-center justify-center mt-8'>
            <span className='text-3xl font-bold text-green-400'>{efficiency}%</span>
            <span className='text-xs text-slate-500 mt-0.5'>Efficiency</span>
          </div>
        </div>
        <div className='grid grid-cols-2 gap-3 w-full mt-4'>
          <div className='bg-slate-800/60 rounded-xl p-3 text-center'>
            <p className='text-lg font-bold text-blue-400'>427</p>
            <p className='text-xs text-slate-500 mt-0.5'>Active Workers</p>
          </div>
          <div className='bg-slate-800/60 rounded-xl p-3 text-center'>
            <p className='text-lg font-bold text-green-400'>0</p>
            <p className='text-xs text-slate-500 mt-0.5'>Incidents</p>
          </div>
        </div>
      </div>
    </div>
  )
}
