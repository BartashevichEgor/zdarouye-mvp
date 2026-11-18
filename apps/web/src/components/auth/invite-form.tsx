'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, UsersRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { AuthCard, FormError, PrimaryButton } from '@/components/auth/auth-ui'
import { createClient } from '@/utils/supabase/client'
import { inviteSchema } from '@/utils/validators/auth'

type InviteValues = z.infer<typeof inviteSchema>

export function InviteForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string>()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { code: '' },
  })

  const onSubmit = async ({ code }: InviteValues) => {
    setFormError(undefined)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setFormError('Сначала войдите или зарегистрируйтесь, затем мы привяжем аккаунт к семейному профилю.')
        return
      }
      const { error } = await supabase.rpc('redeem_profile_invite', { p_code: code })
      if (error) {
        setFormError('Код недействителен, истёк или уже использован.')
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch {
      setFormError('Не удалось проверить код. Попробуйте ещё раз.')
    }
  }

  return (
    <AuthCard>
      <div className="mb-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><UsersRound aria-hidden /></span>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Код семьи</h1>
        <p className="mt-2 text-sm text-muted">Введите 6-значный код от администратора семьи</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="block">
          <span className="sr-only">6-значный код семьи</span>
          <input
            {...register('code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 6) }}
            className="h-16 w-full rounded-card border border-line bg-surface text-center text-3xl font-semibold tracking-[0.45em] text-ink outline-none placeholder:tracking-normal placeholder:text-muted focus:border-brand"
            placeholder="000000"
            aria-invalid={Boolean(errors.code)}
          />
          {errors.code ? <span className="mt-1.5 block text-sm text-status-danger">{errors.code.message}</span> : null}
        </label>
        <FormError message={formError} />
        <PrimaryButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Проверяем…' : 'Присоединиться к семье'}</PrimaryButton>
      </form>
      <Link href="/login" className="mt-5 flex items-center justify-center gap-2 text-sm text-brand underline-offset-4 hover:underline">
        <ArrowLeft size={16} aria-hidden /> Вернуться ко входу
      </Link>
      <Link href="/register?invite=1" className="mt-3 flex items-center justify-center text-sm text-muted underline-offset-4 hover:text-brand hover:underline">
        Нет аккаунта? Зарегистрироваться по приглашению
      </Link>
    </AuthCard>
  )
}
