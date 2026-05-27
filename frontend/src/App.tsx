import { BrowserRouter, useLocation } from 'react-router-dom'
import AppRouter from './router/AppRouter'
import Sidebar from './components/Sidebar'
import { AuthProvider } from './contexts/AuthContext'
import { WSProvider } from './contexts/WSContext'

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
          <Layout />
        </WSProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
