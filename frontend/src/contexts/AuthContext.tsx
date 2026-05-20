import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProfile, logout as apiLogout } from '../services/auth.service'
import {
  setUnauthenticatedHandler,
  markSessionEstablished,
  markSessionCleared,
} from '../lib/axios'

// ── Role enum (mirrors backend ROLES list, 1-indexed) ─────────────────────
export enum UserRole {
  SUPER_ADMIN = 1,
  ADMIN       = 2,
  SUPERVISOR  = 3,
  USER        = 4
}

/** Human-readable label for display purposes */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.ADMIN]:       'Admin',
  [UserRole.SUPERVISOR]:  'Supervisor',
  [UserRole.USER]:        'User',
}

export interface AuthUser {
  id: number
  name: string
  email: string
  role_id: UserRole   // backend sends 1 | 2 | 3 | 4
}

interface AuthContextValue {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  /** role_id 1 or 2 */
  isAdmin: boolean
  /** role_id 1 */
  isSuperAdmin: boolean
  /** role_id 1, 2, or 3 */
  isSupervisorOrAbove: boolean
  /** human-readable role label */
  roleLabel: string
  isLoading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Normalise the raw API response: role_id may arrive as a number or string */
function normaliseUser(raw: AuthUser): AuthUser {
  return { ...raw, role_id: Number(raw.role_id) as UserRole }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const navigate    = useNavigate()
  const loggingOut  = useRef(false)

  const logout = useCallback(async () => {
    if (loggingOut.current) return
    loggingOut.current = true
    try { await apiLogout() } catch { /* clear state regardless */ }
    markSessionCleared()
    setUserState(null)
    loggingOut.current = false
    navigate('/login', { replace: true })
  }, [navigate])

  // Register axios callback — fires when refresh fails mid-session
  useEffect(() => {
    setUnauthenticatedHandler(() => { if (!loggingOut.current) logout() })
  }, [logout])

  // Restore session on mount
  useEffect(() => {
    fetchProfile()
      .then((profile) => {
        setUserState(normaliseUser(profile))
        markSessionEstablished()
      })
      .catch(() => setUserState(null))
      .finally(() => setIsLoading(false))
  }, [])

  // Exposed setUser — normalises role_id and updates session flag
  const setUser = useCallback((u: AuthUser | null) => {
    const normalised = u ? normaliseUser(u) : null
    setUserState(normalised)
    if (normalised) markSessionEstablished()
    else markSessionCleared()
  }, [])

  // ── Derived permission flags ──────────────────────────────────────────────
  const roleId             = user?.role_id ?? 0
  const isAdmin            = roleId === UserRole.SUPER_ADMIN || roleId === UserRole.ADMIN
  const isSuperAdmin       = roleId === UserRole.SUPER_ADMIN
  const isSupervisorOrAbove = roleId <= UserRole.SUPERVISOR && roleId > 0
  const roleLabel          = user ? (ROLE_LABELS[user.role_id] ?? 'Unknown') : ''

  return (
    <AuthContext.Provider
      value={{ user, setUser, isAdmin, isSuperAdmin, isSupervisorOrAbove, roleLabel, isLoading, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
