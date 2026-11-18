import { z } from 'zod'

export function isAtLeast16(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const dob = new Date(year, month - 1, day)
  const today = new Date()
  const cutoff = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate())
  return dob <= cutoff
}

export const loginSchema = z.object({
  email: z.string().trim().email('Введите корректный e-mail.'),
  password: z.string().min(1, 'Введите пароль.'),
})

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Введите имя минимум из 2 символов.').max(120, 'Имя слишком длинное.'),
  email: z.string().trim().email('Введите корректный e-mail.'),
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов.').max(72, 'Пароль слишком длинный.'),
  dob: z.string().min(1, 'Укажите дату рождения.').refine(isAtLeast16, {
    message: 'Самостоятельная регистрация доступна только с 16 лет. Попросите родителей прислать вам код.',
  }),
})

// Invitees must not receive a new family group. The admin has already created
// their local profile, including the child/adult access mode.
export const inviteeRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Введите имя минимум из 2 символов.').max(120, 'Имя слишком длинное.'),
  email: z.string().trim().email('Введите корректный e-mail.'),
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов.').max(72, 'Пароль слишком длинный.'),
  dob: z.string().min(1, 'Укажите дату рождения.'),
})

export const inviteSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Введите 6 цифр кода.'),
})
