import { useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Video,
  ShieldCheck,
  FileBarChart,
  Settings,
  ChevronRight,
  Activity,
  Cctv,
  LogOut,
  MapPin,
  User,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const menus = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Live Monitoring', icon: Video, badge: '12', path: '/live' },
  { label: 'PPE Compliance', icon: ShieldCheck, path: '/ppe' },
  { label: 'Illegal Entry', icon: ShieldAlert, path: '/illegal-entry' },
  { label: 'Idle Moniter', icon: FileBarChart, path: '/idle-moniter' },
  { label: 'Reports', icon: FileBarChart, path: '/reports' },
]

const adminMenus = [
  { label: 'Camera Management', icon: Cctv, path: '/cameras' },
  { label: 'Zone Management', icon: MapPin, path: '/zones' },
  { label: 'User Management', icon: User, path: '/users' },

]

export default function Sidebar() {
  const { pathname } = useLocation()
  const { isAdmin, user, roleLabel, logout } = useAuth()

  return (
    <div className='w-64 bg-slate-900 border-r border-slate-800 flex-col hidden lg:flex'>
      {/* Logo */}
      <div className='p-5 border-b border-slate-800'>
        <div className='flex items-center gap-3'>
          <div className='h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center'>
            <Activity className='h-5 w-5 text-white' />
          </div>
          <div>
            <h1 className='text-sm font-bold text-white'>AI CCTV</h1>
            <p className='text-xs text-slate-500'>Industrial Safety Platform</p>
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className='mx-4 mt-4 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2'>
        <span className='h-2 w-2 bg-green-400 rounded-full animate-pulse' />
        <span className='text-xs text-green-400 font-medium'>System Live</span>
        <span className='ml-auto text-xs text-green-600'>12 feeds</span>
      </div>

      {/* Navigation */}
      <nav className='flex-1 p-4 space-y-1'>
        <p className='text-xs text-slate-600 uppercase tracking-widest font-medium mb-3 px-2'>
          Navigation
        </p>
        {menus.map(({ label, icon: Icon, badge, path }) => (
          <Link
            to={path}
            key={label}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
              pathname === path
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon className='h-4 w-4 flex-shrink-0' />
            <span className='flex-1 text-left'>{label}</span>
            {badge && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${
                  pathname === path ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {badge}
              </span>
            )}
            {pathname === path && <ChevronRight className='h-3 w-3 opacity-60' />}
          </Link>
        ))}

        {/* Admin-only section */}
        {isAdmin && (
          <>
            <p className='text-xs text-slate-600 uppercase tracking-widest font-medium mt-5 mb-3 px-2'>
              Admin
            </p>
            {adminMenus.map(({ label, icon: Icon, path }) => (
              <Link
                to={path}
                key={label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  pathname === path
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className='h-4 w-4 flex-shrink-0' />
                <span className='flex-1 text-left'>{label}</span>
                {pathname === path && <ChevronRight className='h-3 w-3 opacity-60' />}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User chip + bottom actions */}
      <div className='p-4 border-t border-slate-800 space-y-1'>
        {user && (
          <div className='flex items-center gap-2.5 px-3 py-2.5 mb-2 rounded-xl bg-slate-800/60 border border-slate-700/50'>
            <div className='h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0'>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className='min-w-0'>
              <p className='text-xs font-medium text-white truncate'>{user.name}</p>
              <p className='text-[10px] text-slate-500'>{roleLabel}</p>
            </div>
          </div>
        )}

        <button className='w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-800 hover:text-white transition-all duration-200'>
          <Settings className='h-4 w-4' />
          Settings
        </button>

        <button
          onClick={logout}
          className='w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200'
        >
          <LogOut className='h-4 w-4' />
          Logout
        </button>
      </div>
    </div>
  )
}
