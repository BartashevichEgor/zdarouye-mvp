import { RegisterForm } from '@/components/auth/register-form'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams
  return <RegisterForm isInvitee={invite === '1'} />
}
