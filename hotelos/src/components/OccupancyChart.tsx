'use client'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface OccPoint { date: string; label: string; pct: number; occupied: number; total: number; today?: boolean }

function Tip({ active, payload }: { active?: boolean; payload?: Array<{ payload: OccPoint }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0]!.payload
  return (
    <div className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-400">{p.label}{p.today ? ' · today' : ''}</div>
      <div className="mt-0.5 font-semibold text-white">{p.pct}% occupied</div>
      <div className="text-slate-400">{p.occupied} of {p.total} rooms</div>
    </div>
  )
}

/** One series (occupancy %), so the title names it and no legend is needed. */
export function OccupancyChart({ data }: { data: OccPoint[] }) {
  const today = data.find((d) => d.today)?.label
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ed160" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#3ed160" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
          {today && <ReferenceLine x={today} stroke="rgba(255,255,255,.25)" strokeDasharray="3 3" label={{ value: 'Today', fill: '#8b949e', fontSize: 10, position: 'insideTopRight' }} />}
          <Tooltip content={<Tip />} cursor={{ stroke: 'rgba(255,255,255,.2)', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="pct" stroke="#3ed160" strokeWidth={2} fill="url(#occ)" dot={false} activeDot={{ r: 5, stroke: '#11161e', strokeWidth: 2, fill: '#3ed160' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
