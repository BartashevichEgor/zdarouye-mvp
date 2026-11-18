import type { ComponentProps, ReactNode } from 'react'

export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-line bg-surface p-5 shadow-card">{children}</div>
}

export function Field({ label, error, ...props }: { label: string; error?: string } & ComponentProps<'input'>) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      <input
        {...props}
        className="h-touch w-full rounded-control border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-muted focus:border-brand"
        aria-invalid={Boolean(error)}
      />
      {error ? <span className="mt-1.5 block text-sm text-status-danger">{error}</span> : null}
    </label>
  )
}

export function PrimaryButton({ children, ...props }: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className="flex h-touch w-full items-center justify-center rounded-pill bg-brand px-4 text-base font-medium text-white shadow-cta transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return <p role="alert" className="rounded-control bg-status-danger-soft px-3 py-2 text-sm text-status-danger">{message}</p>
}
