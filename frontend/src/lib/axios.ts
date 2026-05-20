import axios from 'axios'

/**
 * Single Axios instance.
 * withCredentials: true → browser sends httpOnly cookies on every request.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  // headers: { 'Content-Type': 'application/json' },
})

// ── Refresh state ─────────────────────────────────────────────────────────
let isRefreshing = false
let pendingQueue: Array<{
  resolve: () => void
  reject: (reason?: unknown) => void
}> = []

function flushQueue(error: unknown) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve()))
  pendingQueue = []
}

/**
 * Set to true by AuthContext once the initial session check is done.
 * Before that, a 401 on /auth/me just means "no session" — don't try to refresh.
 * After that, a 401 means the access cookie expired — do try to refresh.
 */
let sessionEstablished = false
export function markSessionEstablished() {
  sessionEstablished = true
}
export function markSessionCleared() {
  sessionEstablished = false
}

/**
 * Called by AuthContext when refresh fails or logout happens,
 * so we can navigate without a full page reload (which would cause an infinite loop).
 */
let onUnauthenticated: (() => void) | null = null
export function setUnauthenticatedHandler(fn: () => void) {
  onUnauthenticated = fn
}

// ── Response interceptor ──────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const url: string = original.url ?? ''

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    // Never intercept the refresh or login endpoints themselves
    if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
      return Promise.reject(error)
    }

    // On initial load (/auth/me with no session), don't attempt refresh —
    // there's nothing to refresh yet. AuthContext handles this gracefully.
    if (!sessionEstablished) {
      return Promise.reject(error)
    }

    // Session was established before → access cookie expired → try refresh
    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then(() => apiClient(original))
    }

    original._retry = true
    isRefreshing = true

    try {
      await apiClient.post('/auth/refresh')
      flushQueue(null)
      return apiClient(original)
    } catch (refreshError) {
      flushQueue(refreshError)
      markSessionCleared()
      onUnauthenticated?.()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default apiClient
