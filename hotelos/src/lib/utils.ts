import { clsx, type ClassValue } from 'clsx'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

export function uid(prefix = ''): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return prefix ? `${prefix}_${rnd.replace(/-/g, '').slice(0, 14)}` : rnd
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(date: string | Date, days: number): string {
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : new Date(date)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`).getTime()
  const b = new Date(`${checkOut}T12:00:00`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

export const today = () => isoDate()

export function inr(n: number | undefined | null): string {
  return `₹${Math.round(Number(n ?? 0)).toLocaleString('en-IN')}`
}

export function prettyDate(d?: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  if (!d) return '—'
  const date = d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d)
  return date.toLocaleDateString('en-IN', opts)
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  return `${days}d ago`
}

/** WhatsApp wants digits with country code and no "+": "+91 98765 43210" → "919876543210". */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

export function last10(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}
