'use client'

import { useState } from 'react'
import { ArrowRight, CalendarCheck2, ShieldCheck } from 'lucide-react'
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
          <h1>Welcome back</h1>
          <p className="auth-panel-sub">Sign in to book an office visit.</p>
          {!up && notice.error && <p className="auth-note auth-error" role="alert">{notice.error}</p>}
          {!up && notice.msg && <p className="auth-note" role="status">{notice.msg}</p>}
          <form action={signIn}>
            <label className="modal-label" htmlFor="signin-email">Email</label>
            <input id="signin-email" name="email" type="email" required autoComplete="email" className="modal-input" />
            <PasswordField id="signin-password" autoComplete="current-password" />
            <Submit label="Sign in" pendingLabel="Signing in..." />
          </form>
        </div>
      </section>

      <section className="auth-panel auth-panel-signup" inert={!up} aria-label="Create account">
        <div className="auth-panel-inner">
          <h1>Create account</h1>
          <p className="auth-panel-sub">Students, faculty and external visitors use the same form.</p>
          {up && notice.error && <p className="auth-note auth-error" role="alert">{notice.error}</p>}
          {up && notice.msg && <p className="auth-note" role="status">{notice.msg}</p>}
          <form action={signUp}>
            <div className="auth-names">
              <div>
                <label className="modal-label" htmlFor="signup-last">Last name</label>
                <input id="signup-last" name="last_name" required autoComplete="family-name" className="modal-input" />
              </div>
              <div>
                <label className="modal-label" htmlFor="signup-first">First name</label>
                <input id="signup-first" name="first_name" required autoComplete="given-name" className="modal-input" />
              </div>
            </div>
            <div className="auth-names">
              <div>
                <label className="modal-label" htmlFor="signup-middle">Middle name</label>
                <input id="signup-middle" name="middle_name" autoComplete="additional-name" placeholder="Optional" className="modal-input" />
              </div>
              <div>
                <label className="modal-label" htmlFor="signup-type">I am a</label>
                <select id="signup-type" name="type" className="modal-input">
                  <option value="student">Student</option>
                  <option value="faculty">Faculty member</option>
                  <option value="visitor">External visitor</option>
                </select>
              </div>
            </div>
            <label className="modal-label" htmlFor="signup-email">Email</label>
            <input id="signup-email" name="email" type="email" required autoComplete="email" className="modal-input" />
            <PasswordField id="signup-password" autoComplete="new-password" minLength={8} />
            <p className="auth-hint">At least 8 characters.</p>
            <label className="auth-consent">
              <input type="checkbox" name="consent" required />
              <span>I agree that SPCC collects my name, email and appointment details to schedule visits (Data Privacy Act of 2012, RA 10173).</span>
            </label>
            <Submit label="Create account" pendingLabel="Creating account..." />
          </form>
        </div>
      </section>

      <div className="auth-overlay">
        <div className="auth-overlay-track">
          <div className="auth-overlay-panel auth-overlay-new" inert={up}>
            <p className="auth-overlay-kicker">New here</p>
            <h2>Create your appointment account</h2>
            <p>Pick an office, pick a slot, state the purpose. The office approves it.</p>
            <ul className="auth-points">
              <li><CalendarCheck2 /> Offices set the slots they take, Monday to Friday.</li>
              <li><ShieldCheck /> Visitor records log arrivals and departures.</li>
            </ul>
            <button type="button" className="auth-ghost" onClick={() => go('signup')}>
              Create an account <ArrowRight />
            </button>
          </div>
          <div className="auth-overlay-panel auth-overlay-back" inert={!up}>
            <p className="auth-overlay-kicker">Already registered</p>
            <h2>Sign in and pick up where you left</h2>
            <p>Your requests, approvals and visitor logs are waiting for you.</p>
            <button type="button" className="auth-ghost" onClick={() => go('signin')}>
              Sign in <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
