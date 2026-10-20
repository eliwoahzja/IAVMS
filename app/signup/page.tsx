import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signUp } from '@/app/actions'
import { AuthBrand, PasswordField, Submit } from '@/components/auth-bits'
import { supabase } from '@/lib/supabase/server'

export default async function Signup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (user) redirect('/')
  const { error } = await searchParams

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <AuthBrand />
        <section className="auth-card">
          <h1>Create account</h1>
          {error && <p className="auth-note auth-error" role="alert">{error}</p>}
          <form action={signUp}>
            <div className="auth-names">
              <div>
                <label className="modal-label" htmlFor="last">Last name</label>
                <input id="last" name="last_name" required autoComplete="family-name" className="modal-input" />
              </div>
              <div>
                <label className="modal-label" htmlFor="first">First name</label>
                <input id="first" name="first_name" required autoComplete="given-name" className="modal-input" />
              </div>
            </div>
            <label className="modal-label" htmlFor="middle">Middle name or initial <span className="auth-optional">(optional)</span></label>
            <input id="middle" name="middle_name" autoComplete="additional-name" className="modal-input" />
            <label className="modal-label" htmlFor="type">I am a</label>
            <select id="type" name="type" className="modal-input">
              <option value="student">Student</option>
              <option value="faculty">Faculty member</option>
              <option value="visitor">External visitor</option>
            </select>
            <label className="modal-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="modal-input" />
            <PasswordField id="password" autoComplete="new-password" minLength={8} />
            <p className="auth-hint">At least 8 characters.</p>
            <label className="auth-consent">
              <input type="checkbox" name="consent" required />
              <span>I agree that SPCC collects my name, email and appointment details to schedule visits (Data Privacy Act of 2012, RA 10173).</span>
            </label>
            <Submit label="Create account" pendingLabel="Creating account..." />
          </form>
          <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
        </section>
      </div>
    </main>
  )
}
