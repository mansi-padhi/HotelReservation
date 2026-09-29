import { cn } from '@/lib/utils'

/** Hotelator's location-pin mark, redrawn as SVG from the original logo. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" className={cn('h-7 w-auto', className)} aria-hidden>
      <path d="M16 0C7.2 0 0 7 0 15.7 0 27 16 40 16 40s16-13 16-24.3C32 7 24.8 0 16 0Z" fill="#3ED160" />
      <circle cx="16" cy="15.5" r="10" fill="#0d1117" opacity=".18" />
      <path d="m16 8.2 2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6L16 8.2Z" fill="#fff" />
    </svg>
  )
}

export function Logo({ className, light, suffix = 'OS' }: { className?: string; light?: boolean; suffix?: string | null }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className={cn('text-lg font-semibold tracking-tight', light ? 'text-ink-900' : 'text-white')}>
        Hotelator
        {suffix && <span className="ml-1 rounded-md bg-brand-400/15 px-1.5 py-0.5 align-middle text-[10px] font-bold tracking-widest text-brand-400">{suffix}</span>}
      </span>
    </span>
  )
}
