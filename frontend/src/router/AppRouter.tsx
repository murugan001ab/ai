import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth }         from '../contexts/AuthContext'
import Dashboard           from '../pages/Dashboard'
import Live                from '../pages/Live'
import CameraManagement    from '../pages/CameraManagement'
import ZoneManagement      from '../pages/ZoneManagement'
import PPECompliance       from '../pages/PPECompliance'
import Login               from '../pages/Login'
import UserManagementPage from '../pages/UserManagementPage'
import { Loader2 }         from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return (
    <div className='flex-1 flex items-center justify-center'>
      <Loader2 className='h-6 w-6 animate-spin text-slate-500' />
    </div>
  )
  if (!user) return <Navigate to='/login' replace />
  return <>{children}</>
}

export default function AppRouter() {
  const { user, isLoading } = useAuth()
  if (isLoading) return (
    <div className='flex-1 flex items-center justify-center'>
      <Loader2 className='h-6 w-6 animate-spin text-slate-500' />
    </div>
  )

  return (
    <Routes>
      <Route path='/login' element={user ? <Navigate to='/' replace /> : <Login />} />

      {/* <Route path='/' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /> */}
      <Route path='/live' element={<ProtectedRoute><Live /></ProtectedRoute>} />
      <Route path='/ppe' element={<ProtectedRoute><PPECompliance /></ProtectedRoute>} />
      <Route path='/cameras' element={<ProtectedRoute><CameraManagement /></ProtectedRoute>} />
      <Route path='/zones' element={<ProtectedRoute><ZoneManagement /></ProtectedRoute>} />
      <Route path='/users' element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />

    </Routes>
  )
}
