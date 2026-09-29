'use client'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SignOut() {
  const router = useRouter()
  return (
    <button onClick={async () => { await fetch('/api/account/logout', { method: 'POST' }); router.replace('/'); router.refresh() }} className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 text-sm hover:bg-white">
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  )
}
