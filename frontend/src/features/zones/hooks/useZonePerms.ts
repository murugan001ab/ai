import { useState, useEffect, useCallback } from 'react'
import {
  getZonePerms,
  createZonePerm,
  deleteZonePerm,
} from '../../../services/zone.service'
import type { ZonePermItem, CreateZonePermPayload } from '../types'



interface State {
  items: ZonePermItem[]
  total: number
  pages: number
  page: number
  loading: boolean
  error: string | null
}

export function useZonePerms() {
  const [state, setState] = useState<State>({
    items: [], total: 0, pages: 1, page: 1, loading: true, error: null,
  })

  const load = useCallback(async (page: number) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await getZonePerms(page)
      setState((s) => ({ ...s, items: res.data, total: res.total, pages: res.pages, page, loading: false }))
    } catch (err: any) {
      setState((s) => ({
        ...s, loading: false,
        error: err?.response?.data?.detail ?? err?.message ?? 'Failed to load zone permissions.',
      }))
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  const add = async (payload: CreateZonePermPayload) => {
    const created = await createZonePerm(payload)
    setState((s) => ({ ...s, items: [...s.items, created], total: s.total + 1 }))
  }

  const remove = async (id: number) => {
    await deleteZonePerm(id)
    setState((s) => ({ ...s, items: s.items.filter((p) => p.id !== id), total: s.total - 1 }))
  }

  return { ...state, setPage: load, add, remove, reload: () => load(state.page) }
}
