import { redirect } from 'next/navigation'
import { AuthBrand } from '@/components/auth-bits'
import { AuthForm } from '@/components/auth-form'
import { supabase } from '@/lib/supabase/server'

export default async function Signup({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (user) redirect('/')
  const { error, msg } = await searchParams

  return (
    <main className="auth-page" id="content">
      <div className="auth-shell">
        <AuthBrand />
        <AuthForm mode="signup" error={error} msg={msg} />
      </div>
    </main>
  )
}
