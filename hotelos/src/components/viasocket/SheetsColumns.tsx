'use client'
import { AlertTriangle, ArrowRight, Columns3, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { Button, Select } from '@/components/ui'
import { SHEET_FIELDS, SHEETS_COLUMNS } from '@/lib/viasocket/apps'
import { fetchOptions } from './OptionPicker'

export interface SheetColumn { value: string; label: string; field: string }

export const validColumns = (cols?: SheetColumn[]) => Array.isArray(cols) && cols.length > 0 && cols.every((c) => c.value && c.value !== 'undefined')

function guessField(label: string, i: number): string {
  const l = label.toLowerCase()
  const rules: Array<[RegExp, string]> = [
    [/event|type|action/, 'event'], [/code|booking|reserv|\bid\b/, 'reservation_code'], [/phone|mobile|whats/, 'guest_phone'], [/mail/, 'guest_email'],
    [/guest|name/, 'guest_name'], [/room.*type|category/, 'room_type'], [/room/, 'room'], [/check.?in|arriv/, 'check_in'],
    [/check.?out|depart/, 'check_out'], [/night/, 'nights'], [/paid|deposit/, 'paid'], [/amount|total|revenue|price/, 'amount'],
    [/status/, 'status'], [/source|channel/, 'source'], [/time|date|created|when/, 'timestamp'],
  ]
  return rules.find(([re]) => re.test(l))?.[1] ?? SHEET_FIELDS[i]?.value ?? ''
}

/**
 * "Add New Row to Sheet" needs column_selected (options: the header cells) and then column_name,
 * a *fields generator*: it returns one field definition per column, `{ key, label, type }`.
 * Each `key` is used verbatim as a key of column_name in inputData.
 */
export function SheetsColumns({ spreadsheetId, gridId, initial, onSave }: {
  spreadsheetId: string
  gridId: string
  initial?: { column_selected?: unknown[]; columns?: SheetColumn[] }
  onSave: (cfg: { column_selected: unknown[]; columns: SheetColumn[] }) => Promise<void>
}) {
  const toast = useToast()
  const stale = Boolean(initial?.columns?.length) && !validColumns(initial?.columns)
  const [selected, setSelected] = useState<unknown[]>(stale ? [] : initial?.column_selected ?? [])
  const [columns, setColumns] = useState<SheetColumn[]>(stale ? [] : initial?.columns ?? [])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const base = { spreadsheet_Id: spreadsheetId, grid_Id: gridId, column_key: true }
      const sel = await fetchOptions('sheets', SHEETS_COLUMNS.versionId, SHEETS_COLUMNS.selectedKey, base)
      if (!sel.length) throw new Error('No header row found. Type column names in row 1 of the sheet (e.g. Event, Guest, Check-in) and try again.')
      const values = sel.map((o) => o.value)
      const fields = (await fetchOptions('sheets', SHEETS_COLUMNS.versionId, SHEETS_COLUMNS.namesKey, { ...base, column_selected: values })) as Array<{ key?: string; value?: unknown; label: string }>
      const next = fields
        .map((f, i) => {
          const key = String(f.key ?? f.value ?? '')
          return { value: key, label: f.label || key, field: columns.find((c) => c.value === key)?.field ?? guessField(f.label || key, i) }
        })
        .filter((c) => c.value && c.value !== 'undefined')
      if (!next.length) throw new Error('viaSocket returned no usable columns for this sheet.')
      setSelected(values)
      setColumns(next)
      setDirty(true)
    } catch (e: any) {
      toast.error('Could not read the sheet’s columns', e.message)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      await onSave({ column_selected: selected, columns })
      setDirty(false)
      toast.success('Column mapping saved', 'Use “Send test” to write a sample row.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-ink-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-white"><Columns3 className="h-4 w-4 shrink-0 text-brand-400" /> Column mapping</div>
          <p className="mt-0.5 text-xs text-slate-400">Read from row 1 of the sheet. Pick what goes into each column.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={load} loading={loading} className="shrink-0">{columns.length ? 'Reload' : 'Load columns'}</Button>
      </div>

      {stale && !columns.length && (
        <p className="mt-3 flex gap-2 rounded-lg bg-amber-400/10 p-2.5 text-xs text-amber-200"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> The saved mapping is outdated. Click <b>Load columns</b> and save again.</p>
      )}
      {loading && !columns.length && <div className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Reading header row…</div>}

      {columns.length > 0 && (
        <>
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1.3fr)] items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Sheet column</span><span /><span>Hotelator value</span>
            </div>
            {columns.map((c, i) => (
              <div key={c.value} className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1.3fr)] items-center gap-2">
                <span className="truncate rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-200" title={c.label}>{c.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                <Select className="py-2 text-sm" value={c.field} onChange={(e) => { setDirty(true); setColumns((cols) => cols.map((x, j) => (j === i ? { ...x, field: e.target.value } : x))) }}>
                  {SHEET_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
              </div>
            ))}
          </div>
          <Button size="sm" className="mt-4 w-full" onClick={save} loading={saving} disabled={!dirty}>{dirty ? 'Save mapping' : 'Mapping saved ✓'}</Button>
        </>
      )}
    </div>
  )
}
