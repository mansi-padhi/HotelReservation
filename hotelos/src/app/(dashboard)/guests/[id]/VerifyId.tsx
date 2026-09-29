'use client'
import { ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui'
import { api } from '@/lib/client-api'

export default function VerifyId({ id, verified, hasDoc }: { id: string; verified: boolean; hasDoc: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (verified) return <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-400/10 p-3 text-sm text-brand-300"><ShieldCheck className="h-4 w-4" /> ID verified</div>
  return (
    <Button className="mt-4 w-full" variant="secondary" disabled={!hasDoc} loading={busy} onClick={async () => {
      setBusy(true)
      try {
        await api(`/api/guests/${id}`, { method: 'PATCH', body: { id_verified: true } })
        toast.success('ID marked as verified')
        router.refresh()
      } catch (e: any) {
        toast.error('Failed', e.message)
      } finally {
        setBusy(false)
      }
    }}><ShieldCheck className="h-4 w-4" /> Mark ID verified</Button>
  )
}
