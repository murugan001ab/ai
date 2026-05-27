import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getPPEDashboard,
  getPPECamerasForZone,
  type PPEDashboardData,
  type PPECameraOption,
} from '../../services/ppe.service'
import { useWS } from '../../contexts/WSContext'

const POLL_MS = 30_000   // background polling interval (30 s)

interface DashState {
  data:    PPEDashboardData | null
  loading: boolean
  error:   string | null
}

interface CamState {
  cameras: PPECameraOption[]
  loading: boolean
}

export function usePPEDashboard() {
  const { subscribe } = useWS()

  const [zoneId,   setZoneId]   = useState<number | null>(null)
  const [cameraId, setCameraId] = useState<number | null>(null)

  const [dashState, setDashState] = useState<DashState>({ data: null, loading: false, error: null })
  const [camState,  setCamState]  = useState<CamState>({ cameras: [], loading: false })

  // Keep mutable refs so timer callbacks always see current IDs
  const zoneIdRef   = useRef<number | null>(null)
  const cameraIdRef = useRef<number | null>(null)
  zoneIdRef.current   = zoneId
  cameraIdRef.current = cameraId

  const pollTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wsDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Core fetch ─────────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async (
    zId: number | null,
    cId: number | null,
  ) => {
    setDashState((s) => ({ ...s, loading: true, error: null }))
    try {
      const params: Parameters<typeof getPPEDashboard>[0] = { recent_limit: 20 }
      if (zId != null) params.zone_id   = zId
      if (cId != null) params.camera_id = cId
      const result = await getPPEDashboard(params)
      setDashState({ data: result, loading: false, error: null })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e as { message?: string })?.message ??
        'Failed to load dashboard.'
      setDashState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [])

  // ── Polling ────────────────────────────────────────────────────────────
  const schedulePoll = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    pollTimer.current = setTimeout(async () => {
      await fetchDashboard(zoneIdRef.current, cameraIdRef.current)
      schedulePoll()
    }, POLL_MS)
  }, [fetchDashboard])

  // ── WS-triggered debounced refetch (2 s after last ppe event) ──────────
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type !== 'ppe_violation' && msg.type !== 'ppe-events') return
      if (wsDebounce.current) clearTimeout(wsDebounce.current)
      wsDebounce.current = setTimeout(() => {
        fetchDashboard(zoneIdRef.current, cameraIdRef.current)
      }, 2_000)
    })
  }, [subscribe, fetchDashboard])

  // ── Fetch cameras when zone is set ──────────────────────────────────────
  const loadCameras = useCallback(async (zId: number) => {
    setCamState({ cameras: [], loading: true })
    try {
      const cameras = await getPPECamerasForZone(zId)
      setCamState({ cameras, loading: false })
    } catch {
      setCamState({ cameras: [], loading: false })
    }
  }, [])

  // ── Initial fetch + poll start ──────────────────────────────────────────
  useEffect(() => {
    fetchDashboard(zoneId, cameraId)
    schedulePoll()
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current) }
  }, [zoneId, cameraId, fetchDashboard, schedulePoll])

  // ── Selectors ───────────────────────────────────────────────────────────
  const selectZone = useCallback((id: number | null) => {
    setZoneId(id)
    setCameraId(null)       // always reset camera when zone changes
    setCamState({ cameras: [], loading: false })
    if (id != null) loadCameras(id)
  }, [loadCameras])

  const selectCamera = useCallback((id: number | null) => {
    setCameraId(id)
  }, [])

  const refetch = useCallback(() => {
    fetchDashboard(zoneIdRef.current, cameraIdRef.current)
  }, [fetchDashboard])

  return {
    zoneId,
    cameraId,
    data:        dashState.data,
    loading:     dashState.loading,
    error:       dashState.error,
    cameras:     camState.cameras,
    camsLoading: camState.loading,
    selectZone,
    selectCamera,
    refetch,
  }
}
