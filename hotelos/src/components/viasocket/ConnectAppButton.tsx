'use client'
import { Plug } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui'
import { api } from '@/lib/client-api'
import type { AppKey } from '@/lib/types'
import { APPS } from '@/lib/viasocket/apps'
import type { PublicIntegrations } from '@/lib/viasocket/view'

const SCRIPT_ID = 'viasocket-connect-script'
const SCRIPT_SRC = 'https://embed.viasocket.com/prod-connectcomponent.js'

declare global {
  interface Window {
    openViasocketConnection?: (embedToken: string, serviceId: string) => void
  }
}

function loadConnectScript(): Promise<void> {
  if (window.openViasocketConnection) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (!s) {
      s = document.createElement('script')
      s.id = SCRIPT_ID
      s.src = SCRIPT_SRC
      s.async = true
      document.body.appendChild(s)
    }
    const started = Date.now()
    const wait = () => {
      if (window.openViasocketConnection) return resolve()
      if (Date.now() - started > 10000) return reject(new Error('Could not load the viaSocket connect component'))
      setTimeout(wait, 100)
    }
    wait()
  })
}

/**
 * Opens the app's own consent screen via viaSocket. The popup posts
 * `viasocket_connection_success` with the auth_id; we hand it to our backend, which
 * enables the app and keeps the script_id server-side.
 */
export function ConnectAppButton({ app, label, variant = 'primary', onConnected, disabled }: { app: AppKey; label?: string; variant?: 'primary' | 'secondary' | 'outline'; onConnected: (i: PublicIntegrations) => void; disabled?: boolean }) {
  const def = APPS[app]
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const listener = useRef<((e: MessageEvent) => void) | null>(null)

  useEffect(() => () => { if (listener.current) window.removeEventListener('message', listener.current) }, [])

  async function connect() {
    setLoading(true)
    try {
      const [{ token }] = await Promise.all([api<{ token: string }>('/api/viasocket/token', { method: 'POST' }), loadConnectScript()])
      if (listener.current) window.removeEventListener('message', listener.current)
      const handler = async (event: MessageEvent) => {
        const data = event.data
        if (!data?.type?.startsWith?.('viasocket_connection_')) return
        if (data.serviceId && data.serviceId !== def.serviceId) return
        window.removeEventListener('message', handler)
        listener.current = null
        if (data.type === 'viasocket_connection_success') {
          try {
            const res = await api<{ integrations: PublicIntegrations }>('/api/viasocket/connect', { body: { app, auth_id: data.data?.id } })
            toast.success(`${def.name} connected`, 'Now pick where Hotelator should send things.')
            onConnected(res.integrations)
          } catch (e: any) {
            toast.error(`Couldn't enable ${def.name}`, e.message)
          }
        } else if (data.type === 'viasocket_connection_error') {
          toast.error(`${def.name} connection failed`, data.error?.message)
        }
        setLoading(false)
      }
      listener.current = handler
      window.addEventListener('message', handler)
      window.openViasocketConnection!(token, def.serviceId)
      // If the popup is closed without a message, don't leave the button spinning forever.
      setTimeout(() => setLoading(false), 90_000)
    } catch (e: any) {
      toast.error(`Can't connect ${def.name}`, e.message)
      setLoading(false)
    }
  }

  return (
    <Button variant={variant} onClick={connect} loading={loading} disabled={disabled}>
      {!loading && <Plug className="h-4 w-4" />}
      {loading ? 'Waiting for sign-in…' : label ?? `Connect ${def.name}`}
    </Button>
  )
}
