import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signIn } from '@/app/actions'
import { AuthBrand, PasswordField, Submit } from '@/components/auth-bits'
import { supabase } from '@/lib/supabase/server'

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (user) redirect('/')
  const { error, msg } = await searchParams

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <AuthBrand />
        <section className="auth-card">
          <h1>Sign in</h1>
          {error && <p className="auth-note auth-error" role="alert">{error}</p>}
          {msg && <p className="auth-note" role="status">{msg}</p>}
          <form action={signIn}>
            <label className="modal-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="modal-input" />
            <PasswordField id="password" autoComplete="current-password" />
            <Submit label="Sign in" pendingLabel="Signing in..." />
          </form>
          <p className="auth-switch">No account? <Link href="/signup">Create one</Link></p>
        </section>
      </div>
    </main>
  )
}
