'use client'
import { Loader2, X } from 'lucide-react'
import { forwardRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brand-400 text-ink-950 hover:bg-brand-300 shadow-glow',
  secondary: 'bg-white/[0.07] text-white hover:bg-white/[0.12] border border-white/10',
  outline: 'border border-white/15 text-slate-200 hover:bg-white/[0.06]',
  ghost: 'text-slate-300 hover:bg-white/[0.06] hover:text-white',
  danger: 'bg-red-500/10 text-red-300 border border-red-500/25 hover:bg-red-500/20',
}

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }>(
  function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
          size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-10 px-4 text-sm',
          BTN[variant],
          className,
        )}
        {...rest}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  },
)

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...rest}>{children}</div>
}

const BADGE: Record<string, string> = {
  green: 'bg-brand-400/12 text-brand-300 ring-brand-400/25',
  blue: 'bg-sky-400/12 text-sky-300 ring-sky-400/25',
  amber: 'bg-amber-400/12 text-amber-300 ring-amber-400/25',
  red: 'bg-red-400/12 text-red-300 ring-red-400/25',
  gray: 'bg-white/[0.06] text-slate-300 ring-white/10',
  violet: 'bg-violet-400/12 text-violet-300 ring-violet-400/25',
  orange: 'bg-orange-400/12 text-orange-300 ring-orange-400/25',
}
export function Badge({ color = 'gray', className, children }: { color?: keyof typeof BADGE | string; className?: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', BADGE[color] ?? BADGE.gray, className)}>{children}</span>
}

export const STATUS_COLOR: Record<string, string> = {
  confirmed: 'blue', checked_in: 'green', checked_out: 'gray', cancelled: 'red', no_show: 'red',
  available: 'green', occupied: 'blue', dirty: 'amber', maintenance: 'red',
  pending: 'amber', in_progress: 'blue', completed: 'green', skipped: 'gray',
  open: 'amber', resolved: 'green', closed: 'gray',
  success: 'green', failed: 'red',
  urgent: 'red', high: 'orange', normal: 'blue', low: 'gray',
}
export function StatusBadge({ status }: { status: string }) {
  return <Badge color={STATUS_COLOR[status] ?? 'gray'}>{status.replace(/_/g, ' ')}</Badge>
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('input', className)} {...rest} />
})
export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('input appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%2394a3b8%27 stroke-width=%272%27><path d=%27M2 4l4 4 4-4%27/></svg>")] bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9', className)} {...rest}>{children}</select>
}
export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('input min-h-[84px] resize-y', className)} {...rest} />
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50', checked ? 'bg-brand-400' : 'bg-white/15')}>
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  )
}

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

export function Modal({ open, onClose, title, subtitle, children, wide }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  useEsc(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn('card max-h-[92vh] w-full animate-fade-up overflow-y-auto bg-ink-850 p-6', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode }) {
  useEsc(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-xl animate-[fade-up_.25s_ease-out] flex-col border-l border-white/10 bg-ink-850 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1.5 text-xs font-semibold uppercase tracking-[.16em] text-brand-400">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10"><Icon className="h-6 w-6 text-slate-400" /></div>
      <div className="font-medium text-white">{title}</div>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-white/[0.07] bg-ink-900 p-1">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cn('rounded-lg px-3 py-1.5 text-sm transition', value === t.value ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}>
          {t.label}
          {t.count !== undefined && <span className={cn('ml-1.5 rounded-md px-1.5 text-[11px]', value === t.value ? 'bg-brand-400/20 text-brand-300' : 'bg-white/5 text-slate-500')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function AppIcon({ src, name, size = 28, className }: { src: string; name: string; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-black/5', className)} style={{ width: size, height: size }}>
      <img src={src} alt={name} className="h-full w-full object-contain" />
    </span>
  )
}
