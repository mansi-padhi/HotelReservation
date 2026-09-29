'use client'
import { ArrowLeft, ArrowRight, BedDouble, Camera, Check, CreditCard, FileUp, Loader2, MessageCircle, PenLine, RotateCcw, ShieldCheck, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import Webcam from 'react-webcam'
import { api } from '@/lib/client-api'
import { cn, inr, prettyDate } from '@/lib/utils'

interface Res { code: string; check_in: string; check_out: string; nights: number; adults: number; children: number; room_type: string; room_number: string; rate: number; room_total: number; tax: number; grand_total: number; deposit_paid: number; balance_due: number; special_requests: string }
interface GuestIn { name: string; email: string; phone: string; date_of_birth: string; nationality: string; address: string; has_id: boolean; has_photo: boolean; has_signature: boolean }

const STEPS = ['Booking', 'Details', 'ID', 'Photo', 'Sign', 'Payment', 'Done']

/** Shrinks camera/photo uploads so they travel fast on mobile data. */
async function toDataUrl(file: File | Blob, max = 1400): Promise<string> {
  if (file.type === 'application/pdf') return new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = err; r.readAsDataURL(file) })
  const img = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

export default function CheckinWizard({ token, hotel, res, guest }: { token: string; hotel: { name: string; address: string; phone: string }; res: Res; guest: GuestIn }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [balance, setBalance] = useState(res.balance_due)
  const [result, setResult] = useState<{ room_number: string; status: string } | null>(null)

  useEffect(() => { if (window.location.hash === '#payment') setStep(5) }, [])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setError('') }, [step])

  async function run(fn: () => Promise<unknown>, next = true) {
    setBusy(true)
    setError('')
    try {
      await fn()
      if (next) setStep((s) => s + 1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const upload = (kind: 'id' | 'photo' | 'signature', dataUrl: string, extra: Record<string, string> = {}) => api(`/api/checkin/${token}/upload`, { body: { kind, dataUrl, ...extra } })

  useEffect(() => {
    if (step !== 6 || result) return
    run(async () => setResult(await api(`/api/checkin/${token}/complete`, { method: 'POST' })), false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-5 flex items-center justify-between gap-1 px-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition', i < step ? 'bg-brand-500 text-white' : i === step ? 'bg-ink-900 text-white ring-4 ring-ink-900/10' : 'bg-stone-200 text-stone-500')}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</div>
            <span className={cn('hidden text-[10px] font-medium sm:block', i === step ? 'text-ink-900' : 'text-stone-400')}>{s}</span>
          </div>
        ))}
      </div>

      <div className="animate-fade-up rounded-3xl bg-white p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,.3)] sm:p-8" key={step}>
        {step === 0 && (
          <>
            <p className="text-sm text-stone-500">Hi {guest.name.split(' ')[0]} 👋</p>
            <h1 className="mt-1 font-display text-3xl leading-tight">Check in online — skip the front desk</h1>
            <p className="mt-2 text-sm text-stone-600">Takes about 2 minutes. Have your ID ready.</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200">
              <div className="flex items-center gap-3 bg-stone-50 px-4 py-3"><BedDouble className="h-5 w-5 text-brand-600" /><div><div className="font-medium">{hotel.name}</div><div className="text-xs text-stone-500">{hotel.address}</div></div></div>
              <dl className="divide-y divide-stone-100 text-sm">
                {[['Booking', res.code], ['Check-in', `${prettyDate(res.check_in, { weekday: 'short', day: 'numeric', month: 'short' })} · from 14:00`], ['Check-out', `${prettyDate(res.check_out, { weekday: 'short', day: 'numeric', month: 'short' })} · by 11:00`], ['Room', `${res.room_type} · ${res.nights} night${res.nights > 1 ? 's' : ''}`], ['Guests', `${res.adults} adult${res.adults > 1 ? 's' : ''}${res.children ? ` · ${res.children} child` : ''}`], ['Total', inr(res.grand_total)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-2.5"><dt className="text-stone-500">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
              </dl>
            </div>
            <Primary onClick={() => setStep(1)}>Start check-in <ArrowRight className="h-4 w-4" /></Primary>
          </>
        )}

        {step === 1 && <DetailsStep guest={guest} busy={busy} onSubmit={(d) => run(() => api(`/api/checkin/${token}/details`, { method: 'PATCH', body: d }))} />}
        {step === 2 && <IdStep has={guest.has_id} busy={busy} onSkip={() => setStep(3)} onSubmit={(dataUrl, id_type, id_number) => run(() => upload('id', dataUrl, { id_type, id_number }))} onError={setError} />}
        {step === 3 && <PhotoStep has={guest.has_photo} busy={busy} onSkip={() => setStep(4)} onSubmit={(dataUrl) => run(() => upload('photo', dataUrl))} onError={setError} />}
        {step === 4 && <SignStep busy={busy} onSubmit={(dataUrl) => run(() => upload('signature', dataUrl))} />}
        {step === 5 && <PayStep res={res} balance={balance} busy={busy} onPaid={(outcome) => run(async () => {
          try {
            const r = await api<{ balance_due: number }>(`/api/checkin/${token}/pay`, { body: { outcome } })
            setBalance(r.balance_due)
          } catch (e: any) {
            if (e.status === 402) throw new Error('Payment was declined. We’ve sent a retry link to your WhatsApp — or try again here.')
            throw e
          }
        })} onLater={() => setStep(6)} />}
        {step === 6 && (
          <div className="py-4 text-center">
            {!result ? (
              <div className="flex flex-col items-center gap-3 py-10 text-stone-500"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /> Finishing your check-in…</div>
            ) : (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 ring-8 ring-brand-50/60"><Check className="h-10 w-10 text-brand-600" /></div>
                <h1 className="mt-5 font-display text-3xl">You’re checked in!</h1>
                <p className="mt-2 text-stone-600">{result.status === 'checked_in' ? 'Your room is ready — head straight up.' : `We’ll have your key ready on ${prettyDate(res.check_in, { weekday: 'long', day: 'numeric', month: 'short' })}.`}</p>
                <div className="mx-auto mt-6 w-44 rounded-2xl bg-ink-900 p-5 text-white">
                  <div className="text-[11px] uppercase tracking-[.2em] text-brand-300">Your room</div>
                  <div className="mt-1 font-display text-5xl">{result.room_number}</div>
                  <div className="mt-1 text-xs text-white/60">{res.room_type}</div>
                </div>
                <div className="mt-6 rounded-2xl bg-[#25D366]/10 p-4 text-sm text-stone-700"><MessageCircle className="mx-auto mb-1.5 h-5 w-5 text-[#1da851]" />Need towels, food or a fix during your stay? <b>Just WhatsApp us</b> — we reply in seconds.</div>
              </>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
        {step > 0 && step < 6 && <button onClick={() => setStep((s) => s - 1)} className="mt-5 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Back</button>}
      </div>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-stone-500"><ShieldCheck className="h-3.5 w-3.5" /> Your documents are only visible to {hotel.name} staff.</p>
    </div>
  )
}

function Primary({ children, disabled, busy, onClick, type = 'button' }: { children: React.ReactNode; disabled?: boolean; busy?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return <button type={type} onClick={onClick} disabled={disabled || busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink-900 py-4 font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>
}

function StepHead({ icon: Icon, title, body }: { icon: typeof Camera; title: string; body: string }) {
  return <div className="mb-5"><Icon className="h-6 w-6 text-brand-600" /><h2 className="mt-3 font-display text-2xl">{title}</h2><p className="mt-1 text-sm text-stone-600">{body}</p></div>
}

function DetailsStep({ guest, busy, onSubmit }: { guest: GuestIn; busy: boolean; onSubmit: (d: Record<string, string>) => void }) {
  const [d, setD] = useState({ name: guest.name, email: guest.email, phone: guest.phone, date_of_birth: guest.date_of_birth, nationality: guest.nationality || 'Indian', address: guest.address })
  const [err, setErr] = useState<Record<string, string>>({})
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (d.name.trim().length < 2) errs.name = 'Enter your full name'
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) errs.email = 'Enter a valid email'
    if (d.phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter a valid phone number'
    setErr(errs)
    if (!Object.keys(errs).length) onSubmit(d)
  }
  const F = (k: keyof typeof d, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block"><span className="mb-1 block text-xs font-medium text-stone-500">{label}</span><input className={cn('light-input', err[k] && 'border-red-400')} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} {...props} />{err[k] && <span className="mt-1 block text-xs text-red-600">{err[k]}</span>}</label>
  )
  return (
    <form onSubmit={submit}>
      <StepHead icon={PenLine} title="Your details" body="As they appear on your ID." />
      <div className="space-y-3">
        {F('name', 'Full name')}
        <div className="grid gap-3 sm:grid-cols-2">{F('phone', 'Phone (WhatsApp)', { inputMode: 'tel' })}{F('email', 'Email', { type: 'email' })}</div>
        <div className="grid gap-3 sm:grid-cols-2">{F('date_of_birth', 'Date of birth', { type: 'date' })}{F('nationality', 'Nationality')}</div>
        {F('address', 'Home address')}
      </div>
      <Primary type="submit" busy={busy}>Continue <ArrowRight className="h-4 w-4" /></Primary>
    </form>
  )
}

function IdStep({ has, busy, onSubmit, onSkip, onError }: { has: boolean; busy: boolean; onSubmit: (dataUrl: string, type: string, num: string) => void; onSkip: () => void; onError: (m: string) => void }) {
  const [type, setType] = useState('aadhaar')
  const [num, setNum] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  async function pick(file?: File) {
    if (!file) return
    if (file.size > 8_000_000) return onError('That file is over 8 MB — try a photo instead.')
    try { setPreview(await toDataUrl(file)) } catch { onError('Could not read that file. Try a JPG or PNG.') }
  }
  return (
    <div>
      <StepHead icon={FileUp} title="Verify your ID" body="Required by Indian law for every guest. A clear photo of the front is enough." />
      <div className="grid grid-cols-3 gap-2">
        {[['aadhaar', 'Aadhaar'], ['passport', 'Passport'], ['driving_licence', 'Driving licence']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setType(v)} className={cn('rounded-xl border px-2 py-2.5 text-sm transition', type === v ? 'border-ink-900 bg-ink-900 text-white' : 'border-stone-200 hover:border-stone-400')}>{l}</button>
        ))}
      </div>
      <input className="light-input mt-3" placeholder="ID number (optional)" value={num} onChange={(e) => setNum(e.target.value)} />
      <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center transition hover:border-brand-500">
        {preview ? (preview.startsWith('data:application/pdf') ? <div className="py-6 text-sm font-medium">PDF selected ✓</div> : <img src={preview} alt="ID preview" className="max-h-48 rounded-lg" />) : <><Upload className="h-7 w-7 text-stone-400" /><span className="mt-2 text-sm font-medium">Tap to photograph or upload</span><span className="text-xs text-stone-500">JPG, PNG or PDF</span></>}
        <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      <Primary disabled={!preview} busy={busy} onClick={() => preview && onSubmit(preview, type, num)}>Upload & continue <ArrowRight className="h-4 w-4" /></Primary>
      {has && <button onClick={onSkip} className="mt-3 w-full text-sm text-stone-500 hover:text-ink-900">Already uploaded — skip</button>}
    </div>
  )
}

function PhotoStep({ has, busy, onSubmit, onSkip, onError }: { has: boolean; busy: boolean; onSubmit: (dataUrl: string) => void; onSkip: () => void; onError: (m: string) => void }) {
  const cam = useRef<Webcam>(null)
  const [shot, setShot] = useState<string | null>(null)
  const [camOk, setCamOk] = useState(true)
  return (
    <div>
      <StepHead icon={Camera} title="A quick selfie" body="So our team can welcome you by name." />
      <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl bg-stone-900">
        {shot ? <img src={shot} alt="Your photo" className="h-full w-full object-cover" /> : camOk ? (
          <Webcam ref={cam} audio={false} mirrored screenshotFormat="image/jpeg" screenshotQuality={0.85} videoConstraints={{ facingMode: 'user', width: 720, height: 720 }} onUserMediaError={() => setCamOk(false)} className="h-full w-full object-cover" />
        ) : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">Camera unavailable — upload a photo below instead.</div>}
      </div>
      <div className="mt-4 flex justify-center gap-2">
        {shot ? <button onClick={() => setShot(null)} className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 text-sm"><RotateCcw className="h-4 w-4" /> Retake</button>
          : camOk && <button onClick={() => { const s = cam.current?.getScreenshot(); if (s) setShot(s); else onError('Camera not ready yet — try again.') }} className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white"><Camera className="h-4 w-4" /> Take photo</button>}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 text-sm"><Upload className="h-4 w-4" /> Upload<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setShot(await toDataUrl(f, 900)) }} /></label>
      </div>
      <Primary disabled={!shot} busy={busy} onClick={() => shot && onSubmit(shot)}>Use this photo <ArrowRight className="h-4 w-4" /></Primary>
      {has && <button onClick={onSkip} className="mt-3 w-full text-sm text-stone-500 hover:text-ink-900">Already added — skip</button>}
    </div>
  )
}

function SignStep({ busy, onSubmit }: { busy: boolean; onSubmit: (dataUrl: string) => void }) {
  const sig = useRef<SignatureCanvas>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [empty, setEmpty] = useState(true)
  const [agree, setAgree] = useState(false)
  const [w, setW] = useState(400)
  useEffect(() => { if (wrap.current) setW(Math.min(400, wrap.current.clientWidth)) }, [])
  return (
    <div>
      <StepHead icon={PenLine} title="Sign the registration card" body="Draw your signature with your finger or mouse." />
      <div ref={wrap} className="relative overflow-hidden rounded-2xl border border-stone-300 bg-white">
        <SignatureCanvas ref={sig} penColor="#0d1117" onEnd={() => setEmpty(sig.current?.isEmpty() ?? true)} canvasProps={{ width: w, height: 200, className: 'mx-auto block touch-none' }} />
        <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-stone-300" />
        {empty && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-stone-400">Sign here</div>}
        <button onClick={() => { sig.current?.clear(); setEmpty(true) }} className="absolute right-2 top-2 rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100">Clear</button>
      </div>
      <label className="mt-4 flex gap-3 text-sm text-stone-600">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
        I confirm all provided information is correct and agree to the hotel’s terms and house rules.
      </label>
      <Primary disabled={empty || !agree} busy={busy} onClick={() => { if (sig.current && !sig.current.isEmpty()) onSubmit(sig.current.getCanvas().toDataURL('image/png')) }}>Sign & continue <ArrowRight className="h-4 w-4" /></Primary>
    </div>
  )
}

function PayStep({ res, balance, busy, onPaid, onLater }: { res: Res; balance: number; busy: boolean; onPaid: (o: 'success' | 'failed') => void; onLater: () => void }) {
  const [sheet, setSheet] = useState(false)
  return (
    <div id="payment">
      <StepHead icon={CreditCard} title="Payment" body={balance > 0 ? 'Settle now to walk straight to your room — or pay at checkout.' : 'You’re all paid up.'} />
      <div className="rounded-2xl bg-stone-50 p-4 text-sm">
        <div className="flex justify-between py-1"><span className="text-stone-600">Room · {res.nights} × {inr(res.rate)}</span><span>{inr(res.room_total)}</span></div>
        <div className="flex justify-between py-1"><span className="text-stone-600">GST</span><span>{inr(res.tax)}</span></div>
        <div className="flex justify-between py-1"><span className="text-stone-600">Paid</span><span>−{inr(res.grand_total - balance)}</span></div>
        <div className="mt-2 flex justify-between border-t border-stone-200 pt-2 text-base font-semibold"><span>Balance due</span><span>{inr(balance)}</span></div>
      </div>
      {balance > 0 ? (
        <>
          {!sheet ? <Primary onClick={() => setSheet(true)}>Pay {inr(balance)} <ArrowRight className="h-4 w-4" /></Primary> : (
            <div className="mt-5 animate-fade-up rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between text-sm"><span className="font-medium">Demo payment gateway</span><span className="text-xs text-stone-500">UPI · Card · Netbanking</span></div>
              <p className="mt-1 text-xs text-stone-500">Swap for Razorpay in production. Try a decline to see the recovery automation.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button disabled={busy} onClick={() => onPaid('success')} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Pay now</button>
                <button disabled={busy} onClick={() => onPaid('failed')} className="rounded-xl border border-stone-300 py-3 text-sm disabled:opacity-60">Simulate decline</button>
              </div>
            </div>
          )}
          <button onClick={onLater} className="mt-3 w-full text-sm text-stone-500 hover:text-ink-900">Pay the remaining at checkout</button>
        </>
      ) : <Primary onClick={onLater}>Finish check-in <Check className="h-4 w-4" /></Primary>}
    </div>
  )
}
