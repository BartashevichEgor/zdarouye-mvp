import Image from 'next/image'
import type { ReactNode } from 'react'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-mobile flex-col overflow-hidden bg-canvas px-page pb-8 pt-12">
      <div className="pointer-events-none absolute -left-28 top-28 h-72 w-72 rounded-full bg-brand-soft/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-8 h-64 w-64 rounded-full bg-mint-soft/80 blur-3xl" />
      <header className="relative flex flex-col items-center text-center">
        <Image src="/brand-heart.png" alt="Логотип Здароўе" width={96} height={96} priority />
        <p className="mt-2 bg-logo bg-clip-text font-logo text-[42px] leading-none text-transparent">Здароўе</p>
        <p className="mt-3 max-w-[260px] text-sm leading-5 text-muted">Не держите здоровье всей семьи в своей голове</p>
      </header>
      <section className="relative my-auto w-full">{children}</section>
    </main>
  )
}
