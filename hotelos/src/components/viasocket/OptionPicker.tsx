'use client'
import { Check, ChevronDown, Loader2, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/client-api'
import type { AppKey } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface Opt { label: string; value: unknown }

/**
 * A dropdown filled by viaSocket list-options with the hotel's real data
 * (their WhatsApp numbers, Slack channels, spreadsheets, calendars). Shows label, stores value verbatim.
 */
export function OptionPicker({ app, versionId, fieldKey, existingFields, value, valueLabel, onChange, disabled, searchable, placeholder = 'Choose…' }: {
  app: AppKey
  versionId: string
  fieldKey: string
  existingFields: Record<string, unknown>
  value: unknown
  valueLabel?: string
  onChange: (value: unknown, label: string) => void
  disabled?: boolean
  searchable?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<Opt[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const depKey = JSON.stringify(existingFields)

  const load = useCallback(async (searchText?: string) => {
    setLoading(true)
    setError('')
    try {
      const { options } = await api<{ options: Opt[] }>('/api/viasocket/options', { body: { app, versionId, fieldKey, existingFields: JSON.parse(depKey), searchText } })
      setOptions(options)
    } catch (e: any) {
      setError(e.message)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [app, versionId, fieldKey, depKey])

  useEffect(() => { setOptions(null) }, [depKey])
  useEffect(() => { if (open && options === null && !loading) load() }, [open, options, loading, load])

  // Searchable fields send what the user typed as existingFields._searchText (debounced).
  useEffect(() => {
    if (!open || !searchable) return
    const t = setTimeout(() => load(q || undefined), 350)
    return () => clearTimeout(t)
  }, [q, open, searchable, load])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const shown = (options ?? []).filter((o) => searchable || !q || o.label.toLowerCase().includes(q.toLowerCase()))
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

  return (
    <div ref={box} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className={cn('input flex items-center justify-between gap-2 text-left', !value && 'text-slate-500')}>
        <span className="truncate">{value ? valueLabel || String(value) : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchable ? 'Search your account…' : 'Filter…'} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            <button type="button" onClick={() => load(q || undefined)} className="text-slate-500 hover:text-white" title="Refresh from viaSocket"><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /></button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {loading && options === null && <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading from your account…</div>}
            {error && <div className="px-3 py-3 text-sm text-red-300">{error}</div>}
            {!loading && !error && options && shown.length === 0 && <div className="px-3 py-3 text-sm text-slate-500">Nothing found.</div>}
            {shown.map((o, i) => (
              <button type="button" key={`${o.label}-${i}`} onClick={() => { onChange(o.value, o.label); setOpen(false); setQ('') }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.06]">
                <span className="truncate">{o.label}</span>
                {same(o.value, value) && <Check className="h-4 w-4 text-brand-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export async function fetchOptions(app: AppKey, versionId: string, fieldKey: string, existingFields: Record<string, unknown>) {
  const { options } = await api<{ options: Opt[] }>('/api/viasocket/options', { body: { app, versionId, fieldKey, existingFields } })
  return options
}
