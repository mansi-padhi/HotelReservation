import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import { ToastProvider } from '@/components/Toast'
import './globals.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['opsz'] })

export const metadata: Metadata = {
  title: { default: 'Hotelator OS', template: '%s · Hotelator OS' },
  description: 'Hotel management with WhatsApp, Gmail, Slack, Sheets and Calendar automations built in — powered by viaSocket.',
  icons: { icon: '/brand/mark.png' },
}

export const viewport: Viewport = { themeColor: '#0d1117', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
