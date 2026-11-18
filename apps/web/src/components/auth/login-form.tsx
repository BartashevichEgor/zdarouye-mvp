'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, UsersRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { AuthCard, Field, FormError, PrimaryButton } from '@/components/auth/auth-ui'
import { createClient } from '@/utils/supabase/client'
import { loginSchema } from '@/utils/validators/auth'

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string>()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginValues) => {
    setFormError(undefined)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword(values)
      if (error) {
        setFormError('Не удалось войти. Проверьте e-mail и пароль.')
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch {
      setFormError('Не удалось подключиться к сервису. Попробуйте ещё раз.')
    }
  }

  return (
    <AuthCard>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-ink">С возвращением</h1>
        <p className="mt-2 text-sm text-muted">Войдите в семейный профиль</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="E-mail" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <Field label="Пароль" type="password" autoComplete="current-password" placeholder="Введите пароль" error={errors.password?.message} {...register('password')} />
        <FormError message={formError} />
        <PrimaryButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Входим…' : 'Войти'}</PrimaryButton>
      </form>
      <Link href="/invite" className="mt-4 flex h-touch items-center justify-center gap-2 rounded-pill bg-brand-soft px-4 text-sm font-medium text-brand">
        <UsersRound size={18} aria-hidden /> Войти по коду семьи
      </Link>
      <Link href="/register" className="mt-5 flex items-center justify-center gap-2 text-sm text-brand underline-offset-4 hover:underline">
        <KeyRound size={16} aria-hidden /> Нет аккаунта? Зарегистрироваться
      </Link>
    </AuthCard>
  )
}
