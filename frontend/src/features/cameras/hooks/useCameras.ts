import { useState, useEffect, useCallback } from 'react'
import {
  getCameras,
  createCamera,
  updateCamera,
  deleteCamera,
} from '../../../services/camera.service'
import type { CameraItem, CreateCameraPayload, UpdateCameraPayload } from '../types'

const PAGE_SIZE = 20

interface State {
  items: CameraItem[]
  total: number
  pages: number
  page: number
  loading: boolean
  error: string | null
}

export function useCameras() {
  const [state, setState] = useState<State>({
    items: [],
    total: 0,
    pages: 1,
    page: 1,
    loading: true,
    error: null,
  })

  const load = useCallback(async (page: number) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await getCameras(page, PAGE_SIZE)
      setState((s) => ({
        ...s,
        items: res.data,
        total: res.total,
        pages: res.pages,
        page,
        loading: false,
      }))
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ?? err?.message ?? 'Failed to load cameras.'
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  const setPage = (page: number) => load(page)

  const add = async (payload: CreateCameraPayload): Promise<void> => {
    const created = await createCamera(payload)
    setState((s) => ({
      ...s,
      items: [...s.items, created],
      total: s.total + 1,
    }))
  }

  const edit = async (id: number, payload: UpdateCameraPayload): Promise<void> => {
    const updated = await updateCamera(id, payload)
    setState((s) => ({
      ...s,
      items: s.items.map((c) => (c.id === id ? updated : c)),
    }))
  }

  const remove = async (id: number): Promise<void> => {
    await deleteCamera(id)
    setState((s) => ({
      ...s,
      items: s.items.filter((c) => c.id !== id),
      total: s.total - 1,
    }))
  }

  return { ...state, setPage, add, edit, remove, reload: () => load(state.page) }
}
