import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface WSMessage {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

type MessageHandler = (msg: WSMessage) => void

interface WSContextValue {
  status:      WSStatus
  lastMessage: string | null          // raw string — for hooks that parse manually
  subscribe:   (fn: MessageHandler) => () => void   // parsed-message pub-sub
  reconnect:   () => void
  disconnect:  () => void
}

const WSContext = createContext<WSContextValue>({
  status:      'disconnected',
  lastMessage: null,
  subscribe:   () => () => {},
  reconnect:   () => {},
  disconnect:  () => {},
})

// ── Constants ──────────────────────────────────────────────────────────────

const WS_URL              = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws/events'
const BASE_RETRY_MS       = 3_000
const MAX_RETRY_MS        = 30_000
const MAX_RETRIES         = 10

// ── Provider ───────────────────────────────────────────────────────────────

export function WSProvider({ children }: { children: ReactNode }) {
  const [status,      setStatus]      = useState<WSStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  const wsRef          = useRef<WebSocket | null>(null)
  const retryRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retriesRef     = useRef(0)
  const intentionalRef = useRef(false)
  // Registered parsed-message subscribers
  const handlersRef    = useRef<Set<MessageHandler>>(new Set())

  const clearTimer = () => {
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null }
  }

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return

    intentionalRef.current = false
    setStatus('connecting')

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      retriesRef.current = 0
    }

    ws.onmessage = (e: MessageEvent<string>) => {
      // 1. raw string for legacy lastMessage consumers
      setLastMessage(e.data)
      // 2. parsed dispatch for subscribe() consumers
      try {
        const msg: WSMessage = JSON.parse(e.data)
        handlersRef.current.forEach((h) => h(msg))
      } catch {
        // non-JSON frame — ignore for parsed subscribers
      }
    }

    ws.onerror = () => setStatus('error')

    ws.onclose = () => {
      wsRef.current = null
      if (intentionalRef.current) { setStatus('disconnected'); return }
      if (retriesRef.current >= MAX_RETRIES) { setStatus('error'); return }

      setStatus('disconnected')
      const delay = Math.min(BASE_RETRY_MS * 2 ** retriesRef.current, MAX_RETRY_MS)
      retriesRef.current += 1
      clearTimer()
      retryRef.current = setTimeout(connect, delay)
    }
  }, [])

  const disconnect = useCallback(() => {
    intentionalRef.current = true
    clearTimer()
    wsRef.current?.close()
    wsRef.current = null
    setStatus('disconnected')
  }, [])

  const reconnect = useCallback(() => {
    intentionalRef.current = true
    clearTimer()
    wsRef.current?.close()
    wsRef.current = null
    setTimeout(() => {
      intentionalRef.current = false
      retriesRef.current = 0
      connect()
    }, 100)
  }, [connect])

  /** Subscribe to parsed WS messages. Returns an unsubscribe fn. */
  const subscribe = useCallback((handler: MessageHandler): (() => void) => {
    handlersRef.current.add(handler)
    return () => { handlersRef.current.delete(handler) }
  }, [])

  // Connect on mount, clean up on unmount
  useEffect(() => {
    connect()
    return () => {
      intentionalRef.current = true
      clearTimer()
      wsRef.current?.close()
    }
  }, [connect])

  return (
    <WSContext.Provider value={{ status, lastMessage, subscribe, reconnect, disconnect }}>
      {children}
    </WSContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useWS() {
  return useContext(WSContext)
}
