import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const requestSchema = z.object({ diaryId: z.string().uuid() })

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Сервер не настроен для отправки заявок.' }, { status: 500 })
  }
  if (!token) return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Некорректный дневник.' }, { status: 400 })

  const authClient = createClient(url, anonKey)
  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user) return NextResponse.json({ error: 'Сессия истекла. Войдите снова.' }, { status: 401 })

  const service = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: diary, error: diaryError } = await service
    .from('diaries')
    .select('id, profile_id, clinic_id, status')
    .eq('id', parsed.data.diaryId)
    .maybeSingle()
  if (diaryError || !diary) return NextResponse.json({ error: 'Дневник не найден.' }, { status: 404 })
  if (diary.status !== 'completed') return NextResponse.json({ error: 'Сначала завершите дневник и скачайте отчёт.' }, { status: 409 })

  const [{ data: profile, error: profileError }, { data: clinic, error: clinicError }] = await Promise.all([
    service.from('profiles').select('id, name, auth_user_id, family_group_id, is_child').eq('id', diary.profile_id).maybeSingle(),
    service.from('clinics').select('id, name, booking_url').eq('id', diary.clinic_id).maybeSingle(),
  ])
  if (profileError || !profile || clinicError || !clinic) return NextResponse.json({ error: 'Не удалось подготовить заявку.' }, { status: 500 })

  const { data: actor } = await service
    .from('profiles')
    .select('role')
    .eq('family_group_id', profile.family_group_id)
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()
  const canManage = actor?.role === 'admin' || (profile.auth_user_id === userData.user.id && !profile.is_child)
  if (!canManage) return NextResponse.json({ error: 'Недостаточно прав для отправки заявки.' }, { status: 403 })

  const { data: existingLead } = await service
    .from('clinic_leads')
    .select('id, status')
    .eq('diary_id', diary.id)
    .maybeSingle()

  if (existingLead?.status === 'sent') {
    return NextResponse.json({ status: 'sent', bookingUrl: clinic.booking_url, clinicName: clinic.name })
  }

  const { data: lead, error: leadError } = existingLead
    ? await service.from('clinic_leads').update({ status: 'pending', requested_by: userData.user.id }).eq('id', existingLead.id).select('id').single()
    : await service.from('clinic_leads').insert({
      diary_id: diary.id,
      profile_id: profile.id,
      clinic_id: clinic.id,
      requested_by: userData.user.id,
      status: 'pending',
    }).select('id').single()

  if (leadError || !lead) return NextResponse.json({ error: 'Не удалось создать заявку.' }, { status: 500 })

  if (!webhookUrl) {
    await service.from('clinic_leads').update({ status: 'failed' }).eq('id', lead.id)
    return NextResponse.json({ error: 'Webhook клиники не настроен.', bookingUrl: clinic.booking_url }, { status: 503 })
  }

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lead_id: lead.id,
        profile_name: profile.name,
        clinic_name: clinic.name,
        diary_id: diary.id,
      }),
      signal: AbortSignal.timeout(12_000),
    })

    if (!webhookResponse.ok) {
      await service.from('clinic_leads').update({ status: 'failed', provider_response_code: webhookResponse.status }).eq('id', lead.id)
      return NextResponse.json({ error: 'Клиника пока не приняла заявку.', bookingUrl: clinic.booking_url }, { status: 502 })
    }

    const { error: sentUpdateError } = await service
      .from('clinic_leads')
      .update({
        status: 'sent',
        provider_response_code: webhookResponse.status,
        sent_at: new Date().toISOString(),
      })
      .eq('id', lead.id)

    if (sentUpdateError) {
      return NextResponse.json({
        error: 'Заявка принята клиникой, но её статус не удалось сохранить. Обратитесь в поддержку.',
        bookingUrl: clinic.booking_url,
      }, { status: 502 })
    }

    return NextResponse.json({ status: 'sent', bookingUrl: clinic.booking_url, clinicName: clinic.name })
  } catch {
    await service.from('clinic_leads').update({ status: 'failed' }).eq('id', lead.id)
    return NextResponse.json({ error: 'Не удалось связаться с клиникой.', bookingUrl: clinic.booking_url }, { status: 502 })
  }
}
