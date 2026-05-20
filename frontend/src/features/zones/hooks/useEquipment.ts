import { useState, useEffect, useCallback } from 'react'
import {
  getEquipments,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from '../../../services/zone.service'
import type { EquipmentItem, CreateEquipmentPayload, UpdateEquipmentPayload } from '../types'


interface State {
  items: EquipmentItem[]
  total: number
  pages: number
  page: number
  loading: boolean
  error: string | null
}

export function useEquipment() {
  const [state, setState] = useState<State>({
    items: [], total: 0, pages: 1, page: 1, loading: true, error: null,
  })

  const load = useCallback(async (page: number) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await getEquipments(page)
      console.log(res)

      setState((s) => ({ ...s, items: res.data, total: res.total, pages: res.pages, page, loading: false }))
    } catch (err: any) {
      setState((s) => ({
        ...s, loading: false,
        error: err?.response?.data?.detail ?? err?.message ?? 'Failed to load equipment.',
      }))
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  const add = async (payload: CreateEquipmentPayload) => {
    const created = await createEquipment(payload)
    console.log(created)
    setState((s) => ({ ...s, items: [...s.items, created], total: s.total + 1 }))
  }

  const edit = async (id: number, payload: UpdateEquipmentPayload) => {
    const updated = await updateEquipment(id, payload)
    setState((s) => ({ ...s, items: s.items.map((e) => (e.id === id ? updated : e)) }))
  }

  const remove = async (id: number) => {
    await deleteEquipment(id)
    setState((s) => ({ ...s, items: s.items.filter((e) => e.id !== id), total: s.total - 1 }))
  }

  return { ...state, setPage: load, add, edit, remove, reload: () => load(state.page) }
}
