
import IdleChart from '../components/charts/IdleChart'
import ViolationChart from '../components/charts/ViolationChart'
import ShiftSummary from '../components/charts/ShiftSummary'
import { stats, trendData, violations, alerts, cameras } from '../store'
import {
  ShieldCheck, Users, AlertTriangle, Camera, Clock, TrendingUp, TrendingDown,
  Wifi, WifiOff, AlertCircle, Eye,
} from 'lucide-react'
import ComplianceChart from '../components/charts/ComplianceChart'
import AlertsPanel from '../components/AlertsPanel'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'shield-check': ShieldCheck,
  users: Users,
  'alert-triangle': AlertTriangle,
  camera: Camera,
  clock: Clock,
  'trending-up': TrendingUp,
}

export default function Dashboard() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
        <div className='px-6 py-4 border-b border-slate-800'>
         
        </div>
        <div className='flex-1 overflow-y-auto px-6 py-6 space-y-6'>

          {/* Stats */}
          <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4'>
            {stats.map((stat) => {
              const Icon = iconMap[stat.icon]
              return (
                <div key={stat.title} className='bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 hover:border-slate-600 transition-all duration-200'>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-slate-400 font-medium uppercase tracking-wide'>{stat.title}</span>
                    <div className={`${stat.bgColor} p-2 rounded-lg`}>
                      {Icon && <Icon className={`h-4 w-4 ${stat.color}`} />}
                    </div>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    {stat.delta && (
                      <p className='text-xs mt-1 flex items-center gap-1'>
                        {stat.deltaType === 'up'
                          ? <TrendingUp className='h-3 w-3 text-green-400' />
                          : <TrendingDown className='h-3 w-3 text-red-400' />}
                        <span className={stat.deltaType === 'up' ? 'text-green-400' : 'text-red-400'}>{stat.delta}</span>
                        <span className='text-slate-500'>vs yesterday</span>
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Charts row 1 */}
          <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
            <div className='xl:col-span-2'><ComplianceChart data={trendData} /></div>
            <ShiftSummary />
          </div>

          {/* Charts row 2 */}
          <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
            <ViolationChart data={violations} />
            <IdleChart data={trendData} />
          </div>

          {/* Cameras + Alerts */}
          <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
            <div className='xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5'>
              <div className='flex items-center justify-between mb-5'>
                <h2 className='text-lg font-semibold'>Live Camera Feeds</h2>
                <span className='text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full'>
                  {cameras.filter((c) => c.status === 'online').length} / {cameras.length} Online
                </span>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                {cameras.map((cam) => (
                  <div key={cam.id} className='relative group rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-all duration-200 cursor-pointer'>
                    <img src={cam.image} alt={cam.name} className='w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300' />
                    <div className='absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent' />
                    <div className='absolute top-2 right-2'>
                      {cam.status === 'online' && (
                        <span className='flex items-center gap-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full'>
                          <Wifi className='h-3 w-3' /> LIVE
                        </span>
                      )}
                      {cam.status === 'warning' && (
                        <span className='flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full'>
                          <AlertCircle className='h-3 w-3' /> WARN
                        </span>
                      )}
                      {cam.status === 'offline' && (
                        <span className='flex items-center gap-1 text-xs bg-slate-700/60 text-slate-400 border border-slate-600 px-2 py-0.5 rounded-full'>
                          <WifiOff className='h-3 w-3' /> OFF
                        </span>
                      )}
                    </div>
                    <div className='absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'>
                      <div className='bg-blue-600/80 rounded-full p-2'><Eye className='h-5 w-5 text-white' /></div>
                    </div>
                    <div className='absolute bottom-0 left-0 right-0 p-3'>
                      <p className='text-sm font-semibold'>{cam.name}</p>
                      <p className='text-xs text-slate-400'>{cam.area}</p>
                      <div className='flex gap-3 mt-1'>
                        <span className='text-xs text-blue-400'>{cam.persons} persons</span>
                        {cam.violations > 0 && <span className='text-xs text-red-400'>{cam.violations} violations</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <AlertsPanel alerts={alerts} />
          </div>

        </div>
    </div>
  )
}
