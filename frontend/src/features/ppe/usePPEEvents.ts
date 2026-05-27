import { useState, useEffect, useCallback, useRef } from 'react'
import { useWS } from '../../contexts/WSContext'

// Re-use the canonical type from types.ts
export type { PPELiveEvent } from './types'
import type { PPELiveEvent } from './types'

const MAX_EVENTS = 50

export interface PPEEventsState {
  events: PPELiveEvent[]
  clear:  () => void
}

/**
 * Collects PPE violation events pushed over the shared WebSocket.
 *
 * The server pushes JSON with:
 *   { type: "ppe_violation", event_id, camera_name, missing_ppe[], timestamp, image_path }
 *
 * Falls back gracefully when the WS is disconnected — the list just stops growing.
 */
export function usePPEEvents(): PPEEventsState {
  const { subscribe } = useWS()
  const [events, setEvents] = useState<PPELiveEvent[]>([])

  const handleMessage = useCallback((msg: { type: string; data: unknown }) => {
    // Accept both naming conventions the backend might send
    if (msg.type !== 'ppe_violation' && msg.type !== 'ppe-events') return

    const raw = msg.data as {
      id?:          string | number
      event_id?:    string | number
      camera_name?: string | null
      camera?:      string | null
      worker_id?:   string
      missing_ppe?: string[]
      image_path?:  string | null
      timestamp?:   string | number
    }

    const ev: PPELiveEvent = {
      id:          String(raw.id ?? raw.event_id ?? Date.now()),
      zone:        raw.camera_name ?? raw.camera ?? '',
      camera:      raw.camera_name ?? raw.camera ?? '',
      worker_id:   raw.worker_id ?? '',
      missing_ppe: Array.isArray(raw.missing_ppe) ? raw.missing_ppe : [],
      image_path:  raw.image_path ?? '',
      // timestamp can be ISO string or unix epoch seconds
      timestamp:   typeof raw.timestamp === 'number'
        ? new Date(raw.timestamp * 1000)
        : new Date(raw.timestamp ?? Date.now()),
    }

    setEvents((prev) => [ev, ...prev].slice(0, MAX_EVENTS))
  }, [])

  useEffect(() => subscribe(handleMessage), [subscribe, handleMessage])

  const clear = useCallback(() => setEvents([]), [])

  return { events, clear }
}
