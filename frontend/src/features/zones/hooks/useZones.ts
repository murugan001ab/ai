import { useState, useEffect, useCallback } from 'react'
import {
  getZones,
  createZone,
  updateZone,
  deleteZone,
} from '../../../services/zone.service'
import type { ZoneItem, CreateZonePayload, UpdateZonePayload } from '../types'

const PAGE_SIZE = 20

interface State {
  items: ZoneItem[]
  total: number
  pages: number
  page: number
  loading: boolean
  error: string | null
}

export function useZones() {
  const [state, setState] = useState<State>({
    items: [], total: 0, pages: 1, page: 1, loading: true, error: null,
  })

  const load = useCallback(async (page: number) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await getZones(page, PAGE_SIZE)
      setState((s) => ({ ...s, items: res.data, total: res.total, pages: res.pages, page, loading: false }))
    } catch (err: any) {
      setState((s) => ({
        ...s, loading: false,
        error: err?.response?.data?.detail ?? err?.message ?? 'Failed to load zones.',
      }))
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  const add = async (payload: CreateZonePayload) => {
    const created = await createZone(payload)
    setState((s) => ({ ...s, items: [...s.items, created], total: s.total + 1 }))
  }

  const edit = async (id: number, payload: UpdateZonePayload) => {
    const updated = await updateZone(id, payload)
    setState((s) => ({ ...s, items: s.items.map((z) => (z.id === id ? updated : z)) }))
  }

  const remove = async (id: number) => {
    await deleteZone(id)
    setState((s) => ({ ...s, items: s.items.filter((z) => z.id !== id), total: s.total - 1 }))
  }

  return { ...state, setPage: load, add, edit, remove, reload: () => load(state.page) }
}
