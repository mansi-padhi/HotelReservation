'use client'
import { Bot, FlaskConical, MessageCircle, Radio, Send } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useToast } from '@/components/Toast'
import { AppIcon, Badge, Button, Card, EmptyState, PageHeader, Select } from '@/components/ui'
import { api } from '@/lib/client-api'
import type { GuestRequest } from '@/lib/types'
import { cn, initials, last10, timeAgo } from '@/lib/utils'
import { APPS } from '@/lib/viasocket/apps'

const QUICK = ['Can I get two extra towels please?', 'The AC is not cooling at all', 'What time is breakfast?', 'Can I order dinner to my room?', 'Is late checkout possible?']
const CAT_COLOR: Record<string, string> = { housekeeping: 'amber', maintenance: 'red', room_service: 'violet', info: 'blue', other: 'gray', unknown_guest: 'gray' }

export default function InboxView({ messages, inHouse, subscribed }: { messages: GuestRequest[]; inHouse: Array<{ phone: string; name: string; room: string }>; subscribed: 'active' | 'paused' | null }) {
  const router = useRouter()
  const toast = useToast()
  const threads = useMemo(() => {
    const m = new Map<string, GuestRequest[]>()
    for (const msg of [...messages].reverse()) m.set(last10(msg.from), [...(m.get(last10(msg.from)) ?? []), msg])
    return Array.from(m.entries()).map(([k, list]) => ({ key: k, list, last: list[list.length - 1]! })).sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1))
  }, [messages])
  const [active, setActive] = useState<string | null>(threads[0]?.key ?? null)
  const [from, setFrom] = useState(inHouse[0]?.phone ?? '')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const thread = threads.find((t) => t.key === active)

  async function simulate(message: string) {
    if (!from || !message.trim()) return
    setSending(true)
    try {
      const r = await api<{ category: string; reply: string }>('/api/webhooks/whatsapp/simulate', { body: { from, message } })
      toast.success(`Routed as ${r.category.replace('_', ' ')}`, r.reply)
      setText('')
      setActive(last10(from))
      router.refresh()
    } catch (e: any) {
      toast.error('Simulation failed', e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader title="Guest inbox" subtitle="WhatsApp messages from in-house guests. The bot sorts each one: housekeeping and maintenance become tasks, questions get answered, and everything is logged."
        actions={<span className={cn('chip py-1.5', subscribed === 'active' ? 'border-brand-400/30 text-brand-300' : '')}><Radio className="h-3.5 w-3.5" />{subscribed === 'active' ? 'Live: viaSocket trigger subscribed' : subscribed === 'paused' ? 'Trigger paused' : <Link href="/automations/settings">Not subscribed — set up WhatsApp →</Link>}</span>} />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.06] px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Conversations</div>
          {threads.length === 0 ? <EmptyState icon={MessageCircle} title="No messages yet" /> : threads.map((t) => (
            <button key={t.key} onClick={() => setActive(t.key)} className={cn('flex w-full items-center gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition', active === t.key ? 'bg-brand-400/[0.07]' : 'hover:bg-white/[0.02]')}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-xs font-semibold text-[#25D366]">{initials(t.last.guest_name ?? '?')}</span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2"><span className="truncate text-sm text-slate-100">{t.last.guest_name ?? t.last.from}</span><span className="shrink-0 text-[10px] text-slate-500">{timeAgo(t.last.created_at)}</span></div>
                <div className="truncate text-xs text-slate-500">{t.last.message}</div>
              </div>
            </button>
          ))}
        </Card>

        <div className="space-y-5">
          <Card className="flex min-h-[380px] flex-col overflow-hidden p-0">
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3">
              <AppIcon src={APPS.whatsapp.icon} name="WhatsApp" size={26} />
              <div className="text-sm font-medium text-white">{thread?.last.guest_name ?? 'Select a conversation'}</div>
              {thread && <span className="text-xs text-slate-500">{thread.last.from}</span>}
            </div>
            <div className="flex-1 space-y-4 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,.035)_1px,transparent_0)] bg-[length:18px_18px] p-5">
              {thread?.list.map((m) => (
                <div key={m.id} className="space-y-2">
                  <div className="flex">
                    <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-ink-700 px-3.5 py-2 text-sm text-slate-100">
                      {m.message}
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400"><Badge color={CAT_COLOR[m.category]}>{m.category.replace('_', ' ')}</Badge>{m.simulated && <span className="flex items-center gap-0.5"><FlaskConical className="h-3 w-3" />simulated</span>}{timeAgo(m.created_at)}</div>
                    </div>
                  </div>
                  {m.response && (
                    <div className="flex justify-end">
                      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-[#005c4b] px-3.5 py-2 text-sm text-white">
                        {m.response}
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-emerald-100/60"><Bot className="h-3 w-3" /> auto-reply</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white"><FlaskConical className="h-4 w-4 text-brand-400" /> Simulate a guest message</div>
            <p className="mb-3 text-xs text-slate-400">Runs the exact routing the viaSocket handler triggers. If WhatsApp is connected the auto-reply is really sent to that guest’s number.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select className="sm:w-60" value={from} onChange={(e) => setFrom(e.target.value)}>
                {inHouse.map((g) => <option key={g.phone} value={g.phone}>{g.name} · Room {g.room}</option>)}
                <option value="+91 90000 12345">Unknown number</option>
              </Select>
              <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); simulate(text) }}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type as the guest…" className="input" />
                <Button type="submit" loading={sending} disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
              </form>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">{QUICK.map((q) => <button key={q} disabled={sending} onClick={() => simulate(q)} className="chip hover:border-brand-400/30 hover:text-white">{q}</button>)}</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
