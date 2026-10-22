'use client'

import { signIn, signUp } from '@/app/actions'
import { PasswordField, Submit } from '@/components/auth-bits'

export function AuthForm({ mode, error, msg }: { mode: 'signin' | 'signup'; error?: string; msg?: string }) {
  const up = mode === 'signup'
  return <section className="auth-panel" aria-labelledby="auth-title">
    <div className="auth-panel-inner">
      <h1 id="auth-title">{up ? 'Create account' : 'Sign in'}</h1>
      <p className="auth-panel-sub">{up ? 'Students, faculty members and external visitors register here.' : 'Use the email and password on your SPCC account.'}</p>
      {error && <p className="auth-note auth-error" role="alert">{error}</p>}
      {msg && <p className="auth-note" role="status">{msg}</p>}

      {up ? <form action={signUp}>
        <fieldset className="field-set">
          <legend className="field-legend">Your details</legend>
          <div className="field-pair">
            <div>
              <label className="field-label" htmlFor="signup-last">Last name</label>
              <input id="signup-last" name="last_name" required maxLength={60} autoComplete="family-name" className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="signup-first">First name</label>
              <input id="signup-first" name="first_name" required maxLength={60} autoComplete="given-name" className="field-input" />
            </div>
          </div>
          <label className="field-label" htmlFor="signup-middle">Middle name<span className="field-label-note">Optional</span></label>
          <input id="signup-middle" name="middle_name" maxLength={60} autoComplete="additional-name" className="field-input" />
          <label className="field-label" htmlFor="signup-type">Signing up as</label>
          <select id="signup-type" name="type" className="field-input" required defaultValue="student">
            <option value="student">Student</option>
            <option value="faculty">Faculty member</option>
            <option value="visitor">External visitor</option>
          </select>
        </fieldset>
        <fieldset className="field-set">
          <legend className="field-legend">Account access</legend>
          <label className="field-label" htmlFor="signup-email">Email</label>
          <input id="signup-email" name="email" type="email" required autoComplete="email" className="field-input" />
          <PasswordField id="signup-password" autoComplete="new-password" minLength={8} />
          <label className="auth-consent">
            <input type="checkbox" name="consent" required />
            <span>I agree that SPCC collects my name, email and appointment details to schedule visits (Data Privacy Act of 2012, RA 10173).</span>
          </label>
          <Submit label="Create account" pendingLabel="Creating account..." />
        </fieldset>
      </form> : <form action={signIn}>
        <label className="field-label" htmlFor="signin-email">Email</label>
        <input id="signin-email" name="email" type="email" required autoComplete="email" className="field-input" />
        <PasswordField id="signin-password" autoComplete="current-password" />
        <Submit label="Sign in" pendingLabel="Signing in..." />
      </form>}

      <p className="auth-switch">{up ? <>Already registered? <a href="/login">Sign in</a>.</> : <>No account yet? <a href="/signup">Create one</a>.</>}</p>
    </div>
  </section>
}
