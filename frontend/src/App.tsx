import { BrowserRouter, useLocation } from 'react-router-dom'
import AppRouter from './router/AppRouter'
import Sidebar from './components/Sidebar'
import { AuthProvider } from './contexts/AuthContext'

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

// AuthProvider is INSIDE BrowserRouter so useNavigate works inside AuthContext
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </BrowserRouter>
  )
}
