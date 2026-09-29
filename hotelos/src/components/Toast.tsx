'use client'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type Kind = 'success' | 'error' | 'info'
interface T { id: number; kind: Kind; title: string; body?: string }

const Ctx = createContext<(kind: Kind, title: string, body?: string) => void>(() => undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<T[]>([])
  const push = useCallback((kind: Kind, title: string, body?: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, title, body }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4500)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info
          return (
            <div key={t.id} className={cn('pointer-events-auto flex animate-fade-up gap-3 rounded-xl border bg-ink-800/95 p-3.5 text-sm shadow-2xl backdrop-blur', t.kind === 'success' ? 'border-brand-400/30' : t.kind === 'error' ? 'border-red-400/30' : 'border-sky-400/30')}>
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.kind === 'success' ? 'text-brand-400' : t.kind === 'error' ? 'text-red-400' : 'text-sky-400')} />
              <div className="min-w-0">
                <div className="font-medium text-white">{t.title}</div>
                {t.body && <div className="mt-0.5 break-words text-slate-400">{t.body}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const push = useContext(Ctx)
  return useMemo(
    () => ({
      success: (title: string, body?: string) => push('success', title, body),
      error: (title: string, body?: string) => push('error', title, body),
      info: (title: string, body?: string) => push('info', title, body),
    }),
    [push],
  )
}
