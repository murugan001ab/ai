import { useState } from 'react'
import { Plus, RefreshCw, MapPin } from 'lucide-react'

import { useZones }     from './hooks/useZones'
import { useEquipment } from './hooks/useEquipment'
import { useZoneRules } from './hooks/useZoneRules'
import { useZonePerms } from './hooks/useZonePerms'

import ZoneTable      from './components/ZoneTable'
import ZoneModal      from './components/ZoneModal'
import EquipmentTable from './components/EquipmentTable'
import EquipmentModal from './components/EquipmentModal'
import ZoneRulesTable from './components/ZoneRulesTable'
import ZoneRuleModal  from './components/ZoneRuleModal'
import ZonePermsTable from './components/ZonePermsTable'
import ZonePermModal  from './components/ZonePermModal'

import type { ZoneItem, EquipmentItem } from './types'

// ── Tab definition ────────────────────────────────────────────────────────

type Tab = 'zones' | 'equipment' | 'rules' | 'permissions'

const TABS: { key: Tab; label: string }[] = [
  { key: 'zones',       label: 'Zones'       },
  { key: 'equipment',   label: 'Equipment'   },
  { key: 'rules',       label: 'Zone Rules'  },
  { key: 'permissions', label: 'Permissions' },
]

const ADD_LABELS: Record<Tab, string> = {
  zones:       'Add Zone',
  equipment:   'Add Equipment',
  rules:       'Add Rule',
  permissions: 'Grant Permission',
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ZonesFeature() {
  const [tab, setTab] = useState<Tab>('zones')

  // ── Hooks ──────────────────────────────────────────────────────────────
  const zones  = useZones()
  const equip  = useEquipment()
  const rules  = useZoneRules()
  const perms  = useZonePerms()

  // ── Modal state ────────────────────────────────────────────────────────
  const [zoneModal,  setZoneModal]  = useState<Partial<ZoneItem>     | null | false>(false)
  const [equipModal, setEquipModal] = useState<Partial<EquipmentItem>| null | false>(false)
  const [ruleModal,  setRuleModal]  = useState(false)
  const [permModal,  setPermModal]  = useState(false)

  // ── Delete helpers ─────────────────────────────────────────────────────
  async function confirmDelete(label: string, fn: () => Promise<void>) {
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return
    try { await fn() }
    catch (err: any) { alert(err?.response?.data?.detail ?? `Failed to delete ${label}.`) }
  }

  // ── Derived: which hook / modal is active for this tab ─────────────────
  const activeHook = { zones, equipment: equip, rules, permissions: perms }[tab]
  const isLoading  = activeHook.loading

  function handleRefresh() {
    activeHook.reload()
  }

  function handleAdd() {
    if (tab === 'zones')       setZoneModal({})
    if (tab === 'equipment')   setEquipModal({})
    if (tab === 'rules')       setRuleModal(true)
    if (tab === 'permissions') setPermModal(true)
  }

  return (
    <div className='flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6'>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center gap-3'>
          <div className='h-9 w-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center'>
            <MapPin className='h-4 w-4 text-emerald-400' />
          </div>
          <div>
            <h1 className='text-lg font-bold text-white'>Zone Management</h1>
            <p className='text-xs text-slate-500'>Manage zones, equipment, rules and user permissions</p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className='p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors'
            title='Refresh'
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleAdd}
            className='flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors'
          >
            <Plus className='h-4 w-4' />
            {ADD_LABELS[tab]}
          </button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className='flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 w-fit mb-6'>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tables ──────────────────────────────────────────────────── */}
      {tab === 'zones' && (
        <ZoneTable
          {...zones}
          items={zones.items}
          onEdit={(z) => setZoneModal(z)}
          onDelete={(id) => confirmDelete('zone', () => zones.remove(id))}
          onPageChange={zones.setPage}
          onRetry={zones.reload}
        />
      )}

      {tab === 'equipment' && (
        <EquipmentTable
          {...equip}
          items={equip.items}
          onEdit={(e) => setEquipModal(e)}
          onDelete={(id) => confirmDelete('equipment', () => equip.remove(id))}
          onPageChange={equip.setPage}
          onRetry={equip.reload}
        />
      )}

      {tab === 'rules' && (
        <ZoneRulesTable
          {...rules}
          items={rules.items}
          onDelete={(id) => confirmDelete('rule', () => rules.remove(id))}
          onPageChange={rules.setPage}
          onRetry={rules.reload}
        />
      )}

      {tab === 'permissions' && (
        <ZonePermsTable
          {...perms}
          items={perms.items}
          onDelete={(id) => confirmDelete('permission', () => perms.remove(id))}
          onPageChange={perms.setPage}
          onRetry={perms.reload}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {zoneModal !== false && (
        <ZoneModal
          zone={zoneModal}
          onClose={() => setZoneModal(false)}
          onAdd={zones.add}
          onEdit={zones.edit}
        />
      )}

      {equipModal !== false && (
        <EquipmentModal
          equipment={equipModal}
          onClose={() => setEquipModal(false)}
          onAdd={equip.add}
          onEdit={equip.edit}
        />
      )}

      {ruleModal && (
        <ZoneRuleModal
          zones={zones.items}
          equipment={equip.items}
          onClose={() => setRuleModal(false)}
          onAdd={rules.add}
        />
      )}

      {permModal && (
        <ZonePermModal
          zones={zones.items}
          onClose={() => setPermModal(false)}
          onAdd={perms.add}
        />
      )}

    </div>
  )
}
