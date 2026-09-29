import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07090d', 900: '#0d1117', 850: '#11161e', 800: '#161b22', 700: '#1f2630', 600: '#2a3340', 500: '#3b4656' },
        brand: { 50: '#ecfdf3', 100: '#d1fadf', 200: '#a6f4c5', 300: '#6ce9a6', 400: '#3ed160', 500: '#22b84c', 600: '#16963c', 700: '#157534', 800: '#155d2e', 900: '#134d28' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(62,209,96,.25), 0 8px 30px -8px rgba(62,209,96,.35)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
      },
      animation: { 'fade-up': 'fade-up .35s ease-out both', 'pulse-dot': 'pulseDot 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
}
export default config
