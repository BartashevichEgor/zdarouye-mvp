import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import { notoSansRegularBase64 } from '@/utils/pdf/noto-sans-regular'

export type ReportTask = {
  id: string
  metric_type: 'blood_pressure' | 'pulse' | 'temperature' | 'glucose' | 'medication'
}

export type ReportMeasurement = {
  task_id: string
  date: string
  val1: number | null
  val2: number | null
  is_completed: boolean
}

const metricLabels = {
  blood_pressure: 'Давление',
  pulse: 'Пульс',
  temperature: 'Температура',
  glucose: 'Глюкоза',
  medication: 'Лекарства',
} as const

function displayDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU').format(new Date(`${date}T00:00:00`))
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00`)
  result.setDate(result.getDate() + days)
  const month = String(result.getMonth() + 1).padStart(2, '0')
  const day = String(result.getDate()).padStart(2, '0')
  return `${result.getFullYear()}-${month}-${day}`
}

export function downloadDiaryReport({
  patientName,
  patientDob,
  clinicName,
  startsOn,
  durationDays,
  tasks,
  measurements,
}: {
  patientName: string
  patientDob: string
  clinicName: string
  startsOn: string
  durationDays: number
  tasks: ReportTask[]
  measurements: ReportMeasurement[]
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  if (!notoSansRegularBase64) {
    throw new Error('Noto Sans Cyrillic font is not configured')
  }

  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegularBase64)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.setFont('NotoSans', 'normal')

  const activeMetrics = tasks.map((task) => task.metric_type)
  const taskByMetric = new Map(tasks.map((task) => [task.metric_type, task]))
  const measurementByTaskAndDate = new Map(measurements.map((measurement) => [`${measurement.task_id}:${measurement.date}`, measurement]))
  const head = ['Дата', ...activeMetrics.map((metric) => metricLabels[metric])]

  const body = Array.from({ length: durationDays }, (_, dayIndex) => {
    const date = addDays(startsOn, dayIndex)
    const values = activeMetrics.map((metric) => {
      const task = taskByMetric.get(metric)
      const measurement = task ? measurementByTaskAndDate.get(`${task.id}:${date}`) : undefined
      if (!measurement || !measurement.is_completed) return '—'
      if (metric === 'blood_pressure') return `${measurement.val1 ?? '—'} / ${measurement.val2 ?? '—'}`
      if (metric === 'medication') return 'Да'
      return measurement.val1?.toString() ?? '—'
    })
    return [displayDate(date), ...values]
  })

  doc.setProperties({ title: 'Дневник наблюдений (14 дней)', subject: `Пациент: ${patientName}` })
  doc.setFontSize(18)
  doc.text('Дневник наблюдений (14 дней)', 14, 18)
  doc.setFontSize(11)
  doc.text(`Пациент: ${patientName}`, 14, 28)
  doc.text(`Дата рождения: ${displayDate(patientDob)}`, 14, 34)
  doc.text(`Клиника: ${clinicName}`, 14, 40)

  autoTable(doc, {
    head: [head],
    body,
    startY: 47,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [1, 93, 248], textColor: 255 },
    alternateRowStyles: { fillColor: [238, 245, 255] },
    margin: { left: 14, right: 14 },
  })

  const safeName = patientName.trim().replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'patient'
  doc.save(`zdarouye-diary-${safeName}.pdf`)
}
