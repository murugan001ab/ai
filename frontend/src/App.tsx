import { BrowserRouter, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import AppRouter from './router/AppRouter'
import Sidebar from './components/Sidebar'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { WSProvider, useWS } from './contexts/WSContext'

/**
 * Bridges AuthContext → WSContext: reconnects the WebSocket whenever
 * the user goes from unauthenticated → authenticated (login or page refresh).
 * Must be rendered *inside* both AuthProvider and WSProvider.
 */
function WSAuthBridge() {
  const { user } = useAuth()
  const { reconnect } = useWS()
  const prevUserId = useRef<number | null>(null)

  useEffect(() => {
    if (user && prevUserId.current !== user.id) {
      // User just became authenticated (login or session restore) — reconnect WS
      reconnect()
    }
    prevUserId.current = user?.id ?? null
  }, [user, reconnect])

  return null
}

function Layout() {
  const { pathname } = useLocation()
  const isLoginPage = pathname === '/login'

  return (
    <div className='flex h-screen bg-slate-950 text-white overflow-hidden'>
      {!isLoginPage && <Sidebar />}
      <div className='flex-1 flex flex-col overflow-hidden'>
        <AppRouter />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WSProvider>
          <WSAuthBridge />
          <Layout />
        </WSProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
