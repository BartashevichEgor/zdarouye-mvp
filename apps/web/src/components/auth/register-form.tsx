'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { AuthCard, Field, FormError, PrimaryButton } from '@/components/auth/auth-ui'
import { createClient } from '@/utils/supabase/client'
import { inviteeRegisterSchema, registerSchema } from '@/utils/validators/auth'

type RegisterValues = z.infer<typeof inviteeRegisterSchema>

export function RegisterForm({ isInvitee = false }: { isInvitee?: boolean }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string>()
  const [confirmationMessage, setConfirmationMessage] = useState<string>()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(isInvitee ? inviteeRegisterSchema : registerSchema),
    defaultValues: { name: '', email: '', password: '', dob: '' },
  })

  const onSubmit = async (values: RegisterValues) => {
    setFormError(undefined)
    setConfirmationMessage(undefined)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            name: values.name.trim(),
            dob: values.dob,
            ...(isInvitee ? {} : { onboarding: 'family_owner' }),
          },
        },
      })
      if (error) {
        setFormError(error.message)
        return
      }
      // on_auth_user_created creates a family only for a standalone family owner.
      if (data.session) {
        router.replace(isInvitee ? '/invite' : '/dashboard')
        router.refresh()
        return
      }
      setConfirmationMessage(
        isInvitee
          ? 'Проверьте e-mail и подтвердите регистрацию. Затем войдите и введите код семьи.'
          : 'Проверьте e-mail и подтвердите регистрацию. Семейный профиль будет создан автоматически.',
      )
    } catch {
      setFormError('Не удалось создать аккаунт. Попробуйте ещё раз.')
    }
  }

  return (
    <AuthCard>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-ink">Создать аккаунт</h1>
        <p className="mt-2 text-sm text-muted">{isInvitee ? 'Создайте аккаунт для входа в профиль родственника' : 'Создайте семейный профиль Здароўе'}</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Имя" autoComplete="name" placeholder="Как к вам обращаться" error={errors.name?.message} {...register('name')} />
        <Field label="E-mail" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <Field label="Пароль" type="password" autoComplete="new-password" placeholder="Минимум 8 символов" error={errors.password?.message} {...register('password')} />
        <Field label="Дата рождения" type="date" autoComplete="bday" error={errors.dob?.message} {...register('dob')} />
        {isInvitee ? <p className="-mt-2 text-xs text-muted">Режим доступа определит профиль, созданный администратором семьи.</p> : null}
        <FormError message={formError} />
        {confirmationMessage ? <p className="rounded-control bg-status-success-soft px-3 py-2 text-sm text-status-success">{confirmationMessage}</p> : null}
        <PrimaryButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Создаём…' : 'Зарегистрироваться'}</PrimaryButton>
      </form>
      <Link href="/login" className="mt-5 flex items-center justify-center gap-2 text-sm text-brand underline-offset-4 hover:underline">
        <ArrowLeft size={16} aria-hidden /> Уже есть аккаунт? Войти
      </Link>
    </AuthCard>
  )
}
