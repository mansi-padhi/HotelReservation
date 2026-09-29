'use client'
import { CheckCircle2, CircleDashed, Info, Send, Unplug } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { AppIcon, Badge, Button, Card, Field, Input, Modal, Select } from '@/components/ui'
import { api } from '@/lib/client-api'
import type { AppKey } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'
import { APPS, type PickerDef } from '@/lib/viasocket/apps'
import type { PublicIntegrations } from '@/lib/viasocket/view'
import { ConnectAppButton } from './ConnectAppButton'
import { OptionPicker } from './OptionPicker'
import { SheetsColumns, type SheetColumn } from './SheetsColumns'
import { WhatsAppInbound } from './WhatsAppInbound'

function existingFor(p: PickerDef, config: Record<string, unknown>) {
  const out: Record<string, unknown> = JSON.parse(JSON.stringify(p.existingBase ?? {}))
  for (const dep of p.dependsOn ?? []) out[dep] = config[dep]
  return out
}

export function AppCard({ app, integrations, onChange }: { app: AppKey; integrations: PublicIntegrations; onChange: (i: PublicIntegrations) => void }) {
  const def = APPS[app]
  const conn = integrations.apps[app]
  const toast = useToast()
  const [testOpen, setTestOpen] = useState(false)
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const cfg = conn.config as Record<string, any>

  async function saveConfig(patch: Record<string, unknown>) {
    try {
      const r = await api<{ integrations: PublicIntegrations }>('/api/viasocket/config', { body: { app, config: patch } })
      onChange(r.integrations)
    } catch (e: any) {
      toast.error('Could not save', e.message)
    }
  }

  function pick(p: PickerDef, value: unknown, label: string) {
    const patch: Record<string, unknown> = { [p.key]: value, [`${p.key}_label`]: label }
    // Clear everything that depends on this field.
    for (const other of def.pickers) if (other.dependsOn?.includes(p.key)) Object.assign(patch, { [other.key]: null, [`${other.key}_label`]: null })
    if (app === 'sheets') Object.assign(patch, { columns: p.key === 'grid_Id' || p.key === 'spreadsheet_Id' ? [] : cfg.columns, column_selected: [] })
    saveConfig(patch)
  }

  async function test() {
    setBusy('test')
    try {
      await api('/api/viasocket/test', { body: { app, to: to || undefined } })
      toast.success(`Sent through ${def.name}`, 'Check the app — and the Logs tab for the exact payload.')
      setTestOpen(false)
    } catch (e: any) {
      toast.error(`${def.name} test didn’t go through`, e.message)
    } finally {
      setBusy(null)
    }
  }

  async function disconnect() {
    setBusy('disconnect')
    try {
      const r = await api<{ integrations: PublicIntegrations; warnings: string[] }>('/api/viasocket/disconnect', { body: { app } })
      onChange(r.integrations)
      toast.success(`${def.name} disconnected`, r.warnings.length ? r.warnings.join(' · ') : undefined)
    } catch (e: any) {
      toast.error('Disconnect failed', e.message)
    } finally {
      setBusy(null)
    }
  }

  const state = !conn.connected ? 'off' : conn.ready ? 'ready' : 'setup'

  return (
    <Card className={cn('flex flex-col overflow-hidden transition', state === 'ready' && 'ring-1 ring-brand-400/20')}>
      <div className="relative p-5">
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${def.accent}, transparent)` }} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <AppIcon src={def.icon} name={def.name} size={44} className="rounded-xl p-2" />
            <div>
              <div className="font-semibold text-white">{def.name}</div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-500">service {def.serviceId}</div>
            </div>
          </div>
          {state === 'ready' && <Badge color="green"><CheckCircle2 className="h-3 w-3" /> Ready</Badge>}
          {state === 'setup' && <Badge color="amber"><CircleDashed className="h-3 w-3" /> Finish setup</Badge>}
          {state === 'off' && <Badge>Not connected</Badge>}
        </div>
        <p className="mt-4 text-sm text-slate-400">{def.blurb}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{def.uses.map((u) => <span key={u} className="chip">{u}</span>)}</div>
      </div>

      <div className="mt-auto border-t border-white/[0.06] bg-black/10 p-5">
        {!conn.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <ConnectAppButton app={app} onConnected={onChange} disabled={!integrations.configured} />
            {!integrations.configured && <span className="text-xs text-amber-300/80">Add the embed secret first</span>}
          </div>
        ) : (
          <div className="space-y-4">
            {def.pickers.map((p) => {
              const blocked = (p.dependsOn ?? []).some((d) => !cfg[d])
              return (
                <Field key={p.key} label={`${p.label}${p.optional ? ' (optional)' : ''}`} hint={p.help}>
                  <OptionPicker app={app} versionId={p.versionId} fieldKey={p.fieldKey} existingFields={existingFor(p, cfg)} value={cfg[p.key]} valueLabel={cfg[`${p.key}_label`]}
                    searchable={p.searchable} disabled={blocked} placeholder={blocked ? `Choose ${def.pickers.find((x) => x.key === p.dependsOn?.[0])?.label.toLowerCase()} first` : 'Choose from your account…'}
                    onChange={(v, l) => pick(p, v, l)} />
                </Field>
              )
            })}
            {def.staticFields?.map((f) => (
              <Field key={f.key} label={f.label}>
                <Select value={cfg[f.key] ?? f.default} onChange={(e) => saveConfig({ [f.key]: e.target.value })}>
                  {f.options.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
                </Select>
              </Field>
            ))}
            {app === 'sheets' && cfg.spreadsheet_Id && cfg.grid_Id && (
              <SheetsColumns key={`${cfg.spreadsheet_Id}:${cfg.grid_Id}`} spreadsheetId={cfg.spreadsheet_Id} gridId={cfg.grid_Id} initial={{ column_selected: cfg.column_selected, columns: cfg.columns as SheetColumn[] }} onSave={(c) => saveConfig(c)} />
            )}
            {app === 'whatsapp' && <WhatsAppInbound integrations={integrations} onChange={onChange} />}
            {def.note && <p className="flex gap-2 text-xs text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{def.note}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" variant="secondary" disabled={!conn.ready} onClick={() => (app === 'whatsapp' || app === 'gmail' ? setTestOpen(true) : test())} loading={busy === 'test' && !testOpen}><Send className="h-3.5 w-3.5" /> Send test</Button>
              <Button size="sm" variant="ghost" onClick={disconnect} loading={busy === 'disconnect'}><Unplug className="h-3.5 w-3.5" /> Disconnect</Button>
              {conn.connected_at && <span className="ml-auto text-xs text-slate-500">connected {timeAgo(conn.connected_at)}</span>}
            </div>
          </div>
        )}
      </div>

      <Modal open={testOpen} onClose={() => setTestOpen(false)} title={`Test ${def.name}`} subtitle={app === 'whatsapp' ? 'Meta only delivers free-text to numbers that messaged your business in the last 24 hours.' : 'Leave empty to send to the hotel’s own address.'}>
        <Field label={app === 'whatsapp' ? 'WhatsApp number' : 'Email address'}>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder={app === 'whatsapp' ? '+91 98xxx xxxxx' : 'you@example.com'} autoFocus />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setTestOpen(false)}>Cancel</Button>
          <Button onClick={test} loading={busy === 'test'}><Send className="h-4 w-4" /> Send</Button>
        </div>
      </Modal>
    </Card>
  )
}
