'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, ClipboardList, Download, ExternalLink, Plus, Send, X } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/utils/supabase/client'

export type DiaryProfile = {
  id: string
  auth_user_id: string | null
  is_child: boolean
  name: string
  dob: string
}

type Clinic = { id: string; name: string; city: string | null; address: string | null; booking_url: string }
type Diary = { id: string; starts_on: string; duration_days: number; clinic_id: string; status: 'active' | 'completed' | 'cancelled' }
type Task = { id: string; title: string; type: 'metric' | 'medication'; metric_type: MetricType }
type Measurement = { id: string; task_id: string; date: string; val1: number | null; val2: number | null; is_completed: boolean }
type MetricType = 'blood_pressure' | 'pulse' | 'temperature' | 'glucose' | 'medication'

const metricOptions: Array<{ value: MetricType; label: string; description: string }> = [
  { value: 'blood_pressure', label: 'Артериальное давление', description: 'Систолическое и диастолическое' },
  { value: 'pulse', label: 'Пульс', description: 'Ударов в минуту' },
  { value: 'temperature', label: 'Температура', description: 'В градусах °C' },
  { value: 'glucose', label: 'Глюкоза', description: 'Уровень глюкозы' },
  { value: 'medication', label: 'Приём лекарств', description: 'Отметка о приёме' },
]

const minskDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Minsk',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const today = () => {
  const parts = Object.fromEntries(
    minskDateFormatter
      .formatToParts(new Date())
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  )

  return `${parts.year}-${parts.month}-${parts.day}`
}

function diaryDay(startsOn: string, durationDays: number) {
  const start = new Date(`${startsOn}T00:00:00`)
  const now = new Date(`${today()}T00:00:00`)
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1
  return Math.max(1, Math.min(durationDays, elapsed))
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00`)
  result.setDate(result.getDate() + days)
  const month = String(result.getMonth() + 1).padStart(2, '0')
  const day = String(result.getDate()).padStart(2, '0')
  return `${result.getFullYear()}-${month}-${day}`
}

export function DiaryDashboard({ profile, currentUserId, canManage }: { profile: DiaryProfile; currentUserId?: string; canManage: boolean }) {
  const [diary, setDiary] = useState<Diary>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [measurements, setMeasurements] = useState<Record<string, Measurement>>({})
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [completion, setCompletion] = useState<{ diaryId: string; clinicName: string; bookingUrl: string }>()

  const loadDiary = async () => {
    setLoading(true)
    setError(undefined)
    try {
      const supabase = createClient()
      const [{ data: clinicsData, error: clinicsError }, { data: diaryData, error: diaryError }] = await Promise.all([
        supabase.from('clinics').select('id, name, city, address, booking_url').order('name'),
        supabase
          .from('diaries')
          .select('id, starts_on, duration_days, clinic_id, status')
          .eq('profile_id', profile.id)
          .eq('status', 'active')
          .maybeSingle(),
      ])
      if (clinicsError) throw clinicsError
      if (diaryError) throw diaryError

      setClinics((clinicsData ?? []) as Clinic[])
      const activeDiary = diaryData as Diary | null
      setDiary(activeDiary ?? undefined)

      if (!activeDiary) {
        const { data: completedData, error: completedError } = await supabase
          .from('diaries')
          .select('id, clinic_id, pdf_generated_at')
          .eq('profile_id', profile.id)
          .eq('status', 'completed')
          .not('pdf_generated_at', 'is', null)
          .order('pdf_generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (completedError) throw completedError

        if (completedData) {
          const completedClinic = (clinicsData ?? []).find((clinic) => clinic.id === completedData.clinic_id) as Clinic | undefined
          setCompletion({
            diaryId: completedData.id,
            clinicName: completedClinic?.name ?? 'выбранную клинику',
            bookingUrl: completedClinic?.booking_url ?? '',
          })
        } else {
          setCompletion(undefined)
        }
        setTasks([])
        setMeasurements({})
        return
      }

      setCompletion(undefined)

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, type, metric_type')
        .eq('diary_id', activeDiary.id)
        .eq('status', 'active')
        .order('created_at')
      if (tasksError) throw tasksError

      const nextTasks = (tasksData ?? []) as Task[]
      setTasks(nextTasks)
      if (nextTasks.length === 0) {
        setMeasurements({})
        return
      }

      const { data: measurementsData, error: measurementsError } = await supabase
        .from('measurements')
        .select('id, task_id, date, val1, val2, is_completed')
        .in('task_id', nextTasks.map((task) => task.id))
        .eq('date', today())
      if (measurementsError) throw measurementsError

      const nextMeasurements = Object.fromEntries(
        ((measurementsData ?? []) as Measurement[]).map((measurement) => [measurement.task_id, measurement]),
      )
      setMeasurements(nextMeasurements)
    } catch {
      setError('Не удалось загрузить дневник. Попробуйте обновить страницу.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCompletion(undefined)
    void loadDiary()
  }, [profile.id])

  const activeDay = diary ? diaryDay(diary.starts_on, diary.duration_days) : 0
  const completedCount = tasks.filter((task) => measurements[task.id]?.is_completed).length
  const isChildExecutor = profile.is_child && profile.auth_user_id === currentUserId
  const canFinish = canManage && diary !== undefined && activeDay >= diary.duration_days

  const finishAndDownload = async () => {
    if (!diary) return
    const clinic = clinics.find((item) => item.id === diary.clinic_id)
    if (!clinic) {
      setError('Не удалось найти выбранную клинику для отчёта.')
      return
    }
    setIsFinalizing(true)
    setError(undefined)
    try {
      const supabase = createClient()
      const { data: historyData, error: historyError } = await supabase
        .from('measurements')
        .select('task_id, date, val1, val2, is_completed')
        .in('task_id', tasks.map((task) => task.id))
        .gte('date', diary.starts_on)
        .lte('date', addDays(diary.starts_on, diary.duration_days - 1))
      if (historyError) throw historyError

      const { downloadDiaryReport } = await import('@/utils/pdf/generate-diary-report')
      downloadDiaryReport({
        patientName: profile.name,
        patientDob: profile.dob,
        clinicName: clinic.name,
        startsOn: diary.starts_on,
        durationDays: diary.duration_days,
        tasks,
        measurements: (historyData ?? []) as Measurement[],
      })

      const { error: completeError } = await supabase
        .from('diaries')
        .update({ status: 'completed', pdf_generated_at: new Date().toISOString() })
        .eq('id', diary.id)
      if (completeError) throw completeError

      setCompletion({ diaryId: diary.id, clinicName: clinic.name, bookingUrl: clinic.booking_url })
      setDiary(undefined)
    } catch {
      setError('Не удалось завершить дневник. Попробуйте скачать отчёт ещё раз.')
    } finally {
      setIsFinalizing(false)
    }
  }

  if (loading) {
    return <section className="h-44 animate-pulse rounded-card bg-surface" aria-label="Загрузка дневника" />
  }

  if (!diary) {
    if (completion) return <ReportReadyCard completion={completion} canSendLead={canManage} />
    if (!canManage) {
      return <section className="rounded-card border border-line bg-surface p-5 shadow-card"><h2 className="font-semibold text-ink">14-дневное наблюдение</h2><p className="mt-2 text-sm leading-5 text-muted">Создать дневник может владелец семьи или взрослый участник профиля.</p></section>
    }
    return (
      <section className="overflow-hidden rounded-card border border-brand-muted bg-surface shadow-card">
        <div className="bg-brand-subtle p-5">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface text-brand shadow-card"><ClipboardList size={21} /></span>
          <h2 className="mt-4 text-xl font-semibold text-ink">Начать 14-дневное наблюдение</h2>
          <p className="mt-2 text-sm leading-5 text-muted">Выберите клинику и показатели — ежедневные задачи появятся сразу.</p>
        </div>
        <button type="button" onClick={() => setIsCreateOpen(true)} className="flex h-touch w-full items-center justify-center gap-2 bg-brand px-4 font-medium text-white"><Plus size={18} />Начать наблюдение</button>
        {isCreateOpen ? <CreateDiaryModal clinics={clinics} profileId={profile.id} onClose={() => setIsCreateOpen(false)} onCreated={() => { setIsCreateOpen(false); void loadDiary() }} /> : null}
      </section>
    )
  }

  return (
    <section aria-labelledby="today-tasks-title">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-medium text-brand">День {activeDay} из {diary.duration_days}</p><h2 id="today-tasks-title" className="mt-1 text-xl font-semibold text-ink">Задачи на сегодня</h2></div>
          <span className="rounded-pill bg-status-success-soft px-3 py-1.5 text-xs font-medium text-status-success">{completedCount}/{tasks.length}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-soft" aria-label={`Прогресс: день ${activeDay} из ${diary.duration_days}`}><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(activeDay / diary.duration_days) * 100}%` }} /></div>
      </div>

      {error ? <p role="alert" className="mt-4 rounded-control bg-status-danger-soft px-3 py-2 text-sm text-status-danger">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {tasks.map((task) => <TaskCard key={task.id} task={task} measurement={measurements[task.id]} canManage={canManage} isChildExecutor={isChildExecutor} onSaved={(measurement) => setMeasurements((current) => ({ ...current, [task.id]: measurement }))} />)}
      </div>
      {canFinish ? <section className="mt-4 overflow-hidden rounded-card border border-brand-muted bg-surface shadow-card"><div className="bg-brand-subtle p-5"><h2 className="text-lg font-semibold text-ink">Наблюдение можно завершить</h2><p className="mt-1 text-sm leading-5 text-muted">Скачаем сводный PDF-отчёт за 14 дней и подготовим запись в клинику.</p></div><button type="button" onClick={() => void finishAndDownload()} disabled={isFinalizing} className="flex h-touch w-full items-center justify-center gap-2 bg-brand px-4 font-medium text-white disabled:opacity-60"><Download size={18} />{isFinalizing ? 'Готовим отчёт…' : 'Завершить наблюдение и скачать PDF-отчёт'}</button></section> : null}
    </section>
  )
}

function ReportReadyCard({ completion, canSendLead }: { completion: { diaryId: string; clinicName: string; bookingUrl: string }; canSendLead: boolean }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string>()
  const [bookingUrl, setBookingUrl] = useState(completion.bookingUrl)

  const sendLead = async () => {
    setStatus('sending')
    setError(undefined)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Сессия истекла. Войдите снова.')

      const response = await fetch('/api/clinic-leads', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ diaryId: completion.diaryId }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; bookingUrl?: string }
      if (payload.bookingUrl) setBookingUrl(payload.bookingUrl)
      if (!response.ok) throw new Error(payload.error ?? 'Не удалось отправить заявку.')
      setStatus('sent')
      toast.success('Заявка отправлена в клинику')
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Не удалось отправить заявку.'
      setError(message)
      setStatus('idle')
      toast.error(message)
    }
  }

  return (
    <section className="overflow-hidden rounded-card border border-brand-muted bg-surface shadow-card">
      <div className="bg-brand-subtle p-5 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface text-status-success shadow-card"><Check size={24} /></span>
        <h2 className="mt-4 text-xl font-semibold text-ink">Ваш отчёт готов!</h2>
        <p className="mt-2 text-sm leading-5 text-muted">Вы можете показать его врачу на приёме.</p>
      </div>
      <div className="p-5">
        {status === 'sent' ? <p className="rounded-control bg-status-success-soft px-3 py-3 text-center text-sm text-status-success">Ваша заявка отправлена. Администратор клиники свяжется с вами.</p> : canSendLead ? <button type="button" onClick={() => void sendLead()} disabled={status === 'sending'} className="flex h-touch w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 font-medium text-white shadow-cta disabled:opacity-60"><Send size={18} />{status === 'sending' ? 'Отправляем заявку…' : `Записаться в клинику ${completion.clinicName}`}</button> : <p className="rounded-control bg-canvas px-3 py-3 text-center text-sm text-muted">Заявку в клинику может отправить владелец профиля или администратор семьи.</p>}
        {error ? <p role="alert" className="mt-3 rounded-control bg-status-danger-soft px-3 py-2 text-sm text-status-danger">{error}</p> : null}
        {bookingUrl ? <a href={bookingUrl} target="_blank" rel="noreferrer" className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-pill border border-brand bg-surface px-4 text-sm font-medium text-brand">Открыть онлайн-запись<ExternalLink size={16} /></a> : null}
      </div>
    </section>
  )
}

function CreateDiaryModal({ clinics, profileId, onClose, onCreated }: { clinics: Clinic[]; profileId: string; onClose: () => void; onCreated: () => void }) {
  const [clinicId, setClinicId] = useState('')
  const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>([])
  const [error, setError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleMetric = (metric: MetricType) => setSelectedMetrics((current) => current.includes(metric) ? current.filter((item) => item !== metric) : [...current, metric])

  const submit = async () => {
    if (!clinicId) { setError('Выберите клинику.'); return }
    if (selectedMetrics.length === 0) { setError('Выберите хотя бы один показатель.'); return }
    setIsSubmitting(true)
    setError(undefined)
    try {
      const supabase = createClient()
      const { error: createError } = await supabase.rpc('create_diary_with_tasks', {
        p_profile_id: profileId,
        p_clinic_id: clinicId,
        p_metric_types: selectedMetrics,
      })
      if (createError) throw createError
      onCreated()
    } catch {
      setError('Не удалось создать дневник. Возможно, для этого профиля уже есть активное наблюдение.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal title="Новое наблюдение" onClose={onClose}>
      {clinics.length === 0 ? <div className="rounded-control bg-status-warning-soft px-3 py-3 text-sm text-status-warning">Пока нет доступных клиник. Добавьте клинику в таблицу <code>clinics</code> и попробуйте снова.</div> : <>
        <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Клиника</span><select value={clinicId} onChange={(event) => setClinicId(event.target.value)} className="h-touch w-full rounded-control border border-line bg-surface px-3 outline-none focus:border-brand"><option value="">Выберите клинику</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}{clinic.city ? ` — ${clinic.city}` : ''}</option>)}</select></label>
        <fieldset className="mt-5"><legend className="text-sm font-medium text-ink">Что отслеживать</legend><div className="mt-3 space-y-2">{metricOptions.map((metric) => { const checked = selectedMetrics.includes(metric.value); return <label key={metric.value} className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 transition ${checked ? 'border-brand bg-brand-soft' : 'border-line bg-surface'}`}><input type="checkbox" checked={checked} onChange={() => toggleMetric(metric.value)} className="size-4 accent-brand" /><span><span className="block text-sm font-medium text-ink">{metric.label}</span><span className="block text-xs text-muted">{metric.description}</span></span></label> })}</div></fieldset>
        {error ? <p role="alert" className="mt-4 rounded-control bg-status-danger-soft px-3 py-2 text-sm text-status-danger">{error}</p> : null}
        <button type="button" onClick={() => void submit()} disabled={isSubmitting} className="mt-5 flex h-touch w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 font-medium text-white shadow-cta disabled:opacity-60">{isSubmitting ? 'Создаём…' : 'Создать дневник'}<ChevronRight size={18} /></button>
      </>}
    </Modal>
  )
}

function TaskCard({ task, measurement, canManage, isChildExecutor, onSaved }: { task: Task; measurement?: Measurement; canManage: boolean; isChildExecutor: boolean; onSaved: (measurement: Measurement) => void }) {
  const [val1, setVal1] = useState(measurement?.val1?.toString() ?? '')
  const [val2, setVal2] = useState(measurement?.val2?.toString() ?? '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const completed = measurement?.is_completed ?? false
  const needsSecondValue = task.metric_type === 'blood_pressure'
  const hasValue = task.metric_type === 'medication' || val1.trim().length > 0
  const pressureWarning = task.metric_type === 'blood_pressure' && ((Number(val1) > 140) || (Number(val2) > 90))

  useEffect(() => {
    setVal1(measurement?.val1?.toString() ?? '')
    setVal2(measurement?.val2?.toString() ?? '')
  }, [measurement?.id, measurement?.val1, measurement?.val2])

  const save = async () => {
    if (!canManage) return
    if (!hasValue) { setError('Введите значение измерения.'); return }
    if (needsSecondValue && !val2.trim()) { setError('Введите нижнее давление.'); return }
    setSaving(true)
    setError(undefined)
    try {
      const supabase = createClient()
      const { data, error: saveError } = await supabase
        .from('measurements')
        .upsert({
          task_id: task.id,
          date: today(),
          metric_type: task.metric_type,
          val1: task.metric_type === 'medication' ? null : Number(val1),
          val2: needsSecondValue ? Number(val2) : null,
          is_completed: true,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'task_id,date' })
        .select('id, task_id, date, val1, val2, is_completed')
        .single()
      if (saveError || !data) throw saveError ?? new Error('Measurement was not returned')
      onSaved(data as Measurement)
      toast.success('Данные сохранены')
    } catch {
      setError('Не удалось сохранить измерение. Попробуйте ещё раз.')
      toast.error('Не удалось сохранить измерение')
    } finally {
      setSaving(false)
    }
  }

  const completeChildTask = async () => {
    if (!measurement) return
    setSaving(true)
    setError(undefined)
    try {
      const supabase = createClient()
      const { data, error: completeError } = await supabase.rpc('complete_own_measurement', { p_measurement_id: measurement.id })
      if (completeError || !data) throw completeError ?? new Error('Measurement was not returned')
      onSaved(data as Measurement)
      toast.success('Задача отмечена выполненной')
    } catch {
      setError('Не удалось отметить выполнение. Попробуйте ещё раз.')
      toast.error('Не удалось отметить выполнение')
    } finally {
      setSaving(false)
    }
  }

  if (completed) {
    return <article className="rounded-card border border-status-success bg-status-success-soft p-4"><div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-success text-white"><Check size={18} /></span><div><h3 className="font-semibold text-ink">{task.title}</h3><p className="mt-0.5 text-sm text-status-success">Выполнено сегодня</p></div></div></article>
  }

  const readOnly = !canManage
  return (
    <article className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h3 className="font-semibold text-ink">{task.title}</h3>
      {task.metric_type === 'medication' ? <p className="mt-1 text-sm text-muted">Подтвердите, что приняли лекарство.</p> : <div className="mt-3 grid grid-cols-2 gap-3"><MetricInput label={task.metric_type === 'blood_pressure' ? 'Верхнее' : task.metric_type === 'pulse' ? 'Ударов/мин' : task.metric_type === 'temperature' ? '°C' : 'Значение'} value={val1} onChange={setVal1} disabled={readOnly} danger={pressureWarning && Number(val1) > 140} />{needsSecondValue ? <MetricInput label="Нижнее" value={val2} onChange={setVal2} disabled={readOnly} danger={pressureWarning && Number(val2) > 90} /> : null}</div>}
      {pressureWarning ? <p className="mt-2 text-sm text-status-danger">Показатель выше базового порога. При плохом самочувствии обратитесь к врачу.</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-status-danger">{error}</p> : null}
      {canManage ? <button type="button" onClick={() => void save()} disabled={saving} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 text-sm font-medium text-white shadow-cta disabled:opacity-60">{saving ? 'Сохраняем…' : 'Сохранить'}</button> : isChildExecutor ? <button type="button" onClick={() => void completeChildTask()} disabled={saving || !measurement} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 text-sm font-medium text-white shadow-cta disabled:opacity-60"><Check size={17} />{saving ? 'Отмечаем…' : 'Выполнено'}</button> : <p className="mt-4 rounded-control bg-canvas px-3 py-2 text-sm text-muted">Данные доступны только для просмотра.</p>}
    </article>
  )
}

function MetricInput({ label, value, onChange, disabled, danger }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; danger: boolean }) {
  return <label><span className="mb-1.5 block text-xs text-muted">{label}</span><input type="number" inputMode="decimal" min="0" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={`h-touch w-full rounded-control border bg-surface px-3 text-base text-ink outline-none placeholder:text-muted focus:border-brand disabled:bg-canvas ${danger ? 'border-status-danger text-status-danger' : 'border-line'}`} placeholder="—" /></label>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end bg-ink/30 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={title}><section className="max-h-[90dvh] w-full max-w-mobile overflow-y-auto rounded-t-nav bg-surface p-5 shadow-floating sm:rounded-card"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-ink">{title}</h2><button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full bg-canvas text-muted" aria-label="Закрыть"><X size={20} /></button></div>{children}</section></div>
}
