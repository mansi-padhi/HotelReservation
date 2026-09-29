'use client'

export default function PrintButton() {
  return <button onClick={() => window.print()} className="rounded-full bg-ink-900 px-4 py-2 text-white print:hidden">Download PDF</button>
}
