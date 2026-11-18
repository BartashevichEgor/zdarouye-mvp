import type { Metadata, Viewport } from 'next'
import { Inter, Pacifico } from 'next/font/google'
import { Toaster } from 'sonner'

import './globals.css'

const inter = Inter({ subsets: ['cyrillic', 'latin'], variable: '--font-inter' })
const pacifico = Pacifico({ weight: '400', subsets: ['cyrillic', 'latin'], variable: '--font-pacifico' })

export const metadata: Metadata = {
  title: 'Здароўе',
  description: 'Семейный медицинский трекер',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#015DF8',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${inter.variable} ${pacifico.variable}`}>
      <body>
        {children}
        <Toaster
          position="top-center"
          closeButton
          richColors
          toastOptions={{
            className: 'rounded-card border border-line bg-surface text-ink shadow-floating',
          }}
        />
      </body>
    </html>
  )
}
