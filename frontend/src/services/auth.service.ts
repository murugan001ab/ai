import apiClient from '../lib/axios'
import type { AuthUser } from '../contexts/AuthContext'

export interface LoginPayload {
  email: string
  password: string
}

/**
 * POST /auth/login
 * Backend sets httpOnly access + refresh cookies in the response.
 * We just fetch the profile afterwards — no tokens to store in JS.
 */
export async function login(payload: LoginPayload): Promise<AuthUser> {
  // Login sets the cookies; response body may vary by backend
  await apiClient.post('/auth/login', payload)
  // Fetch the authenticated user profile using the freshly-set cookie
  return fetchProfile()
}

/**
 * GET /auth/me  (or /auth/profile — adjust to match your backend)
 * Cookie is sent automatically via withCredentials.
 */
export async function fetchProfile() {
  try {
    const { data } = await apiClient.get('/auth/me')

    return data.user

  } catch (error:any) {
    if(error.status==401){

    }
    console.log("error", error.status)

  }

}

/**
 * POST /auth/refresh
 * Browser sends the httpOnly refresh cookie automatically.
 * Backend rotates and re-sets both cookies.
 * Called automatically by the Axios interceptor on 401 — rarely needed directly.
 */
export async function refreshTokens(): Promise<void> {
  await apiClient.post('/auth/refresh')
}

/**
 * Logout: call backend if it has a logout endpoint to clear cookies server-side,
 * otherwise the cookies will expire naturally.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout')

  } catch {
    // Ignore errors — we navigate away regardless
  }
}
