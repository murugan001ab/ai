import { useState, useEffect, useCallback } from 'react'
import {
  getZoneRules,
  createZoneRule,
  deleteZoneRule,
} from '../../../services/zone.service'
import type { ZoneRuleItem, CreateZoneRulePayload } from '../types'

const PAGE_SIZE = 20

interface State {
  items: ZoneRuleItem[]
  total: number
  pages: number
  page: number
  loading: boolean
  error: string | null
}

export function useZoneRules() {
  const [state, setState] = useState<State>({
    items: [], total: 0, pages: 1, page: 1, loading: true, error: null,
  })

  const load = useCallback(async (page: number) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await getZoneRules(page, PAGE_SIZE)
      setState((s) => ({ ...s, items: res.data, total: res.total, pages: res.pages, page, loading: false }))
    } catch (err: any) {
      setState((s) => ({
        ...s, loading: false,
        error: err?.response?.data?.detail ?? err?.message ?? 'Failed to load zone rules.',
      }))
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  const add = async (payload: CreateZoneRulePayload) => {
    const created = await createZoneRule(payload)
    setState((s) => ({ ...s, items: [...s.items, created], total: s.total + 1 }))
  }

  const remove = async (id: number) => {
    await deleteZoneRule(id)
    setState((s) => ({ ...s, items: s.items.filter((r) => r.id !== id), total: s.total - 1 }))
  }

  return { ...state, setPage: load, add, remove, reload: () => load(state.page) }
}
