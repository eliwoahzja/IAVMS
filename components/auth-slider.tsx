'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { signIn, signUp } from '@/app/actions'
import { PasswordField, Submit } from '@/components/auth-bits'

export type AuthMode = 'signin' | 'signup'

const URL_FOR: Record<AuthMode, string> = { signin: '/login', signup: '/signup' }

export function AuthSlider({ initialMode, error, msg }: {
  initialMode: AuthMode
  error?: string
  msg?: string
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [notice, setNotice] = useState<{ error?: string; msg?: string }>({ error, msg })
  const up = mode === 'signup'

  function go(next: AuthMode) {
    if (next === mode) return
    setMode(next)
    setNotice({})
    try {
      window.history.replaceState(null, '', URL_FOR[next])
    } catch {}
  }

  return (
    <div className="auth-slider" data-mode={mode}>
      <div className="auth-mode-toggle" role="group" aria-label="Sign in or create an account">
        <button type="button" className="auth-mode-tab" aria-pressed={!up} onClick={() => go('signin')}>Sign in</button>
        <button type="button" className="auth-mode-tab" aria-pressed={up} onClick={() => go('signup')}>Create account</button>
      </div>

      <section className="auth-panel auth-panel-signin" inert={up} aria-label="Sign in">
        <div className="auth-panel-inner">
          <h1>Sign in to IAVMS</h1>
          <p className="auth-panel-sub">Access your appointments, review requests or update office schedules.</p>
          {!up && notice.error && <p className="auth-note auth-error" role="alert">{notice.error}</p>}
          {!up && notice.msg && <p className="auth-note" role="status">{notice.msg}</p>}
          <form action={signIn}>
            <label className="field-label" htmlFor="signin-email">Email</label>
            <input id="signin-email" name="email" type="email" required autoComplete="email" className="field-input" />
            <PasswordField id="signin-password" autoComplete="current-password" />
            <Submit label="Sign in" pendingLabel="Signing in..." />
          </form>
        </div>
      </section>

      <section className="auth-panel auth-panel-signup" inert={!up} aria-label="Create account">
        <div className="auth-panel-inner">
          <h1>Create account</h1>
          <p className="auth-panel-sub">For SPCC students, faculty and external visitors requesting an appointment.</p>
          {up && notice.error && <p className="auth-note auth-error" role="alert">{notice.error}</p>}
          {up && notice.msg && <p className="auth-note" role="status">{notice.msg}</p>}
          <form action={signUp}>
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
          </form>
        </div>
      </section>

      <div className="auth-overlay">
        <div className="auth-overlay-art" aria-hidden="true">
          <span className="auth-art-grid" />
          <span className="auth-art-glow" />
          <span className="auth-art-seal" />
        </div>
        <div className="auth-overlay-track">
          <div className="auth-overlay-panel auth-overlay-new" inert={up}>
            <p className="auth-overlay-kicker">Appointment requests</p>
            <h2>Arrange your visit to an SPCC office</h2>
            <p>Choose an office and available time. The assigned staff member reviews your request before it is confirmed.</p>
            <button type="button" className="auth-ghost" onClick={() => go('signup')}>
              Create an account <ArrowRight />
            </button>
          </div>
          <div className="auth-overlay-panel auth-overlay-back" inert={!up}>
            <p className="auth-overlay-kicker">Existing account</p>
            <h2>Check your appointments and requests</h2>
            <p>Requesters track decisions. Department staff manage approvals and visit records.</p>
            <button type="button" className="auth-ghost" onClick={() => go('signin')}>
              Sign in <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
