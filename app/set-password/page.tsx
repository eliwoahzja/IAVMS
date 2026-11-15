import { redirect } from 'next/navigation'
import { setPassword } from '@/app/actions'
import { AuthBrand } from '@/components/auth-bits'
import { supabase } from '@/lib/supabase/server'

export default async function SetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?error=Open+the+activation+link+from+your+email')
  const { error } = await searchParams
  return <main className="auth-page"><div className="auth-shell"><AuthBrand />
    <div className="auth-reset-card"><h1>Set your password</h1><p>Create a password for your approved SPCC Pass account.</p>
      {error && <p className="auth-note auth-error" role="alert">{error}</p>}
      <form action={setPassword}>
        <label className="field-label" htmlFor="new-password">New password</label>
        <input className="field-input" id="new-password" type="password" name="password" required minLength={12} maxLength={128} autoComplete="new-password" />
        <label className="field-label" htmlFor="confirm-password">Confirm password</label>
        <input className="field-input" id="confirm-password" type="password" name="confirmation" required minLength={12} maxLength={128} autoComplete="new-password" />
        <button className="primary-button auth-submit">Save password</button>
      </form>
    </div>
  </div></main>
}
