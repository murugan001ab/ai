import { useState, useEffect, useCallback } from 'react'
import { getPPESummary } from '../../services/ppe.service'
import type { PPESummary } from '../../services/ppe.service'

interface State {
  data: PPESummary | null
  loading: boolean
  error: string | null
}

export function usePPESummary() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })

  const fetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await getPPESummary()
      setState({ data, loading: false, error: null })
    } catch (err: any) {
      setState({
        data: null,
        loading: false,
        error: err?.response?.data?.detail ?? err?.message ?? 'Failed to load summary.',
      })
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { ...state, refetch: fetch }
}
