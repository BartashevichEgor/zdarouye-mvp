'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Check,
  Copy,
  Plus,
  Share2,
  UserPlus,
  X,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/client'
import { DiaryDashboard } from '@/components/diary/diary-dashboard'

type Profile = {
  id: string
  auth_user_id: string | null
  family_group_id: string
  name: string
  dob: string
  sex: string | null
  role: 'admin' | 'member'
  is_child: boolean
  created_at: string
}

const localProfileSchema = z.object({
  name: z.string().trim().min(2, 'Введите имя минимум из 2 символов.').max(120, 'Имя слишком длинное.'),
  dob: z.string().min(1, 'Укажите дату рождения.'),
  sex: z.enum(['female', 'male', 'not_specified']),
})

type LocalProfileValues = z.infer<typeof localProfileSchema>

function isChild(dob: string) {
  const [year, month, day] = dob.split('-').map(Number)
  const birthDate = new Date(year, month - 1, day)
  const today = new Date()
  const cutoff = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate())
  return birthDate > cutoff
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'П'
}

function displaySex(sex: string | null) {
  if (sex === 'female') return 'Женский'
  if (sex === 'male') return 'Мужской'
  return 'Не указан'
}

export function FamilyDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>()
  const [currentUserId, setCurrentUserId] = useState<string>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState<string>()
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)
  const [copied, setCopied] = useState(false)

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0],
    [profiles, selectedProfileId],
  )
  const adminProfile = useMemo(
    () => profiles.find((profile) => profile.role === 'admin'),
    [profiles],
  )
  const isAdmin = Boolean(adminProfile?.auth_user_id && adminProfile.auth_user_id === currentUserId)

  const loadFamily = async () => {
    setIsLoading(true)
    setError(undefined)
    try {
      const supabase = createClient()
      const [{ data: authData, error: authError }, { data, error: profilesError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('profiles')
          .select('id, auth_user_id, family_group_id, name, dob, sex, role, is_child, created_at')
          .order('role', { ascending: true })
          .order('created_at', { ascending: true }),
      ])

      if (authError || !authData.user) {
        setError('Войдите в аккаунт, чтобы увидеть семью.')
        return
      }
      if (profilesError) throw profilesError

      const nextProfiles = (data ?? []) as Profile[]
      setCurrentUserId(authData.user.id)
      setProfiles(nextProfiles)
      setSelectedProfileId((current) => current && nextProfiles.some((profile) => profile.id === current)
        ? current
        : nextProfiles[0]?.id)
    } catch {
      setError('Не удалось загрузить профили семьи. Попробуйте обновить страницу.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadFamily()
  }, [])

  const createInvite = async () => {
    if (!selectedProfile) return
    setIsCreatingInvite(true)
    setError(undefined)
    try {
      const supabase = createClient()
      const { data, error: inviteError } = await supabase.rpc('create_profile_invite', {
        p_profile_id: selectedProfile.id,
      })
      if (inviteError || !data) throw inviteError ?? new Error('Invite code was not returned')
      setInviteCode(data as string)
      setCopied(false)
    } catch {
      setError('Не удалось создать код. Убедитесь, что вы администратор семьи.')
    } finally {
      setIsCreatingInvite(false)
    }
  }

  const copyCode = async () => {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      toast.success('Код скопирован!')
    } catch {
      setError('Не удалось скопировать код. Скопируйте его вручную.')
      toast.error('Не удалось скопировать код')
    }
  }

  if (isLoading) {
    return <main className="mx-auto min-h-dvh w-full max-w-mobile bg-canvas px-page pt-8"><DashboardSkeleton /></main>
  }

  if (error && profiles.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-mobile items-center bg-canvas px-page">
        <section className="w-full rounded-card border border-line bg-surface p-6 text-center shadow-card">
          <p className="text-sm text-status-danger">{error}</p>
          <button type="button" onClick={() => void loadFamily()} className="mt-4 rounded-pill bg-brand px-5 py-3 text-sm font-medium text-white">Повторить</button>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-mobile bg-canvas pb-10">
      <header className="bg-surface px-page pb-5 pt-6">
        <p className="font-logo text-3xl text-brand">Здароўе</p>
        <h1 className="mt-5 text-xl font-semibold text-ink">Моя семья</h1>
        <p className="mt-1 text-sm text-muted">Выберите профиль для управления наблюдениями</p>

        <div className="-mx-page mt-5 flex gap-3 overflow-x-auto px-page pb-1 [scrollbar-width:none]">
          {profiles.map((profile) => {
            const isSelected = profile.id === selectedProfile?.id
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => { setSelectedProfileId(profile.id); setInviteCode(undefined) }}
                className={`flex min-w-20 flex-col items-center gap-2 rounded-card px-2 py-1 text-center transition ${isSelected ? 'text-brand' : 'text-muted'}`}
                aria-pressed={isSelected}
              >
                <span className={`flex size-12 items-center justify-center rounded-full text-sm font-semibold ${isSelected ? 'bg-brand text-white shadow-cta' : 'bg-brand-soft text-brand'}`}>
                  {getInitials(profile.name)}
                </span>
                <span className="max-w-20 truncate text-xs font-medium">{profile.name}</span>
              </button>
            )
          })}
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="flex min-w-20 flex-col items-center gap-2 rounded-card px-2 py-1 text-muted transition hover:text-brand"
            >
              <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-brand bg-surface text-brand"><Plus size={22} /></span>
              <span className="text-xs font-medium">Добавить</span>
            </button>
          ) : null}
        </div>
      </header>

      <div className="space-y-4 px-page pt-5">
        {error ? <p role="alert" className="rounded-control bg-status-danger-soft px-3 py-2 text-sm text-status-danger">{error}</p> : null}
        {selectedProfile ? (
          <section className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{selectedProfile.role === 'admin' ? 'Владелец семьи' : 'Член семьи'}</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">{selectedProfile.name}</h2>
              </div>
              <span className={`rounded-pill px-3 py-1.5 text-xs font-medium ${selectedProfile.auth_user_id ? 'bg-status-success-soft text-status-success' : 'bg-brand-soft text-brand'}`}>
                {selectedProfile.auth_user_id ? 'Доступ подключён' : 'Локальный профиль'}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div><dt className="text-muted">Дата рождения</dt><dd className="mt-1 font-medium text-ink">{new Intl.DateTimeFormat('ru-RU').format(new Date(`${selectedProfile.dob}T00:00:00`))}</dd></div>
              <div><dt className="text-muted">Пол</dt><dd className="mt-1 font-medium text-ink">{displaySex(selectedProfile.sex)}</dd></div>
            </dl>

            {selectedProfile.is_child ? <p className="mt-4 rounded-control bg-surface-blue px-3 py-2 text-sm text-brand">Режим ребёнка: можно отмечать выполнение, но нельзя менять задачи.</p> : null}

            {isAdmin && selectedProfile.role !== 'admin' && !selectedProfile.auth_user_id ? (
              <button
                type="button"
                onClick={() => void createInvite()}
                disabled={isCreatingInvite}
                className="mt-5 flex h-touch w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 text-base font-medium text-white shadow-cta disabled:opacity-60"
              >
                <Share2 size={18} /> {isCreatingInvite ? 'Создаём код…' : 'Поделиться доступом'}
              </button>
            ) : null}
          </section>
        ) : null}

        {selectedProfile ? <DiaryDashboard
          profile={selectedProfile}
          currentUserId={currentUserId}
          canManage={isAdmin || (selectedProfile.auth_user_id === currentUserId && !selectedProfile.is_child)}
        /> : null}
      </div>

      {isAddOpen && adminProfile ? <AddRelativeModal familyGroupId={adminProfile.family_group_id} onClose={() => setIsAddOpen(false)} onCreated={(profile) => {
        setProfiles((current) => [...current, profile])
        setSelectedProfileId(profile.id)
        setInviteCode(undefined)
        setIsAddOpen(false)
      }} /> : null}

      {inviteCode && selectedProfile ? <InviteCodeModal name={selectedProfile.name} code={inviteCode} copied={copied} onCopy={() => void copyCode()} onClose={() => setInviteCode(undefined)} /> : null}
    </main>
  )
}

function AddRelativeModal({ familyGroupId, onClose, onCreated }: { familyGroupId: string; onClose: () => void; onCreated: (profile: Profile) => void }) {
  const [formError, setFormError] = useState<string>()
  const { register, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm<LocalProfileValues>({
    resolver: zodResolver(localProfileSchema),
    defaultValues: { name: '', dob: '', sex: 'not_specified' },
  })
  const dob = watch('dob')
  const child = dob ? isChild(dob) : false

  const onSubmit = async (values: LocalProfileValues) => {
    setFormError(undefined)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          family_group_id: familyGroupId,
          name: values.name.trim(),
          dob: values.dob,
          sex: values.sex === 'not_specified' ? null : values.sex,
          role: 'member',
          is_child: isChild(values.dob),
        })
        .select('id, auth_user_id, family_group_id, name, dob, sex, role, is_child, created_at')
        .single()

      if (error || !data) throw error ?? new Error('Profile was not returned')
      onCreated(data as Profile)
    } catch {
      setFormError('Не удалось добавить профиль. Попробуйте ещё раз.')
    }
  }

  return (
    <Modal title="Добавить родственника" onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Имя</span><input {...register('name')} autoComplete="name" placeholder="Например, Анна" className="h-touch w-full rounded-control border border-line px-3 outline-none placeholder:text-muted focus:border-brand" />{errors.name ? <span className="mt-1.5 block text-sm text-status-danger">{errors.name.message}</span> : null}</label>
        <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Дата рождения</span><input {...register('dob')} type="date" className="h-touch w-full rounded-control border border-line px-3 outline-none focus:border-brand" />{errors.dob ? <span className="mt-1.5 block text-sm text-status-danger">{errors.dob.message}</span> : null}{child ? <span className="mt-1.5 block text-sm text-muted">Профиль ребенка будет работать в режиме только для чтения.</span> : null}</label>
        <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Пол</span><select {...register('sex')} className="h-touch w-full rounded-control border border-line bg-surface px-3 outline-none focus:border-brand"><option value="not_specified">Не указывать</option><option value="female">Женский</option><option value="male">Мужской</option></select></label>
        {formError ? <p role="alert" className="rounded-control bg-status-danger-soft px-3 py-2 text-sm text-status-danger">{formError}</p> : null}
        <button type="submit" disabled={isSubmitting} className="flex h-touch w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 font-medium text-white shadow-cta disabled:opacity-60"><UserPlus size={18} />{isSubmitting ? 'Добавляем…' : 'Добавить профиль'}</button>
      </form>
    </Modal>
  )
}

function InviteCodeModal({ name, code, copied, onCopy, onClose }: { name: string; code: string; copied: boolean; onCopy: () => void; onClose: () => void }) {
  return (
    <Modal title="Доступ для родственника" onClose={onClose}>
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><Share2 size={22} /></span>
        <p className="mt-4 text-sm text-muted">Код для профиля «{name}»</p>
        <p className="mt-2 rounded-card bg-surface-blue px-4 py-4 font-mono text-4xl font-semibold tracking-[0.2em] text-brand">{code}</p>
        <button type="button" onClick={onCopy} className="mt-4 flex h-touch w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 font-medium text-white shadow-cta">{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Скопировано' : 'Скопировать'}</button>
        <p className="mt-4 text-sm leading-5 text-muted">Отправьте этот код родственнику для входа.</p>
      </div>
    </Modal>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <section className="w-full max-w-mobile rounded-t-nav bg-surface p-5 shadow-floating sm:rounded-card">
        <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-ink">{title}</h2><button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full bg-canvas text-muted" aria-label="Закрыть"><X size={20} /></button></div>
        {children}
      </section>
    </div>
  )
}

function DashboardSkeleton() {
  return <div className="animate-pulse space-y-5"><div className="h-7 w-28 rounded bg-brand-soft" /><div className="flex gap-3"><div className="size-14 rounded-full bg-brand-soft" /><div className="size-14 rounded-full bg-brand-soft" /></div><div className="h-64 rounded-card bg-surface" /></div>
}
