'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { signIn, requestActivation } from '@/app/actions'
import { PasswordField, Submit } from '@/components/auth-bits'

export type AuthMode = 'signin' | 'activate'

const URL_FOR: Record<AuthMode, string> = { signin: '/login', activate: '/activate' }

export function AuthSlider({ initialMode, error, msg }: {
  initialMode: AuthMode
  error?: string
  msg?: string
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [notice, setNotice] = useState<{ error?: string; msg?: string }>({ error, msg })
  const up = mode === 'activate'

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
      <div className="auth-mode-toggle" role="group" aria-label="Sign in or activate an account">
        <button type="button" className="auth-mode-tab" aria-pressed={!up} onClick={() => go('signin')}>Sign in</button>
        <button type="button" className="auth-mode-tab" aria-pressed={up} onClick={() => go('activate')}>Activate account</button>
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
          <div className="auth-activate-link">
            <span>First time using SPCC Pass?</span>
            <button type="button" className="auth-activate-button" onClick={() => go('activate')}>Activate your account <ArrowRight size={17} /></button>
          </div>
        </div>
      </section>

      <section className="auth-panel auth-panel-activate" inert={!up} aria-label="Activate account">
        <div className="auth-panel-inner">
          <h1>Activate your account</h1>
          <p className="auth-panel-sub">Verify your identity with SPCC. Once approved, you'll receive a secure email to set your password.</p>
          {up && notice.error && <p className="auth-note auth-error" role="alert">{notice.error}</p>}
          {up && notice.msg && <p className="auth-note" role="status">{notice.msg}</p>}
          <form action={requestActivation}>
            <input className="auth-honeypot" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <fieldset className="field-set">
              <legend className="field-legend">Identity details</legend>
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
              <label className="field-label" htmlFor="signup-type">Account type</label>
              <select id="signup-type" name="type" className="field-input" required defaultValue="student">
                <option value="student">Student</option>
                <option value="faculty">Faculty member</option>
                <option value="visitor">External visitor</option>
              </select>
            </fieldset>
            <fieldset className="field-set">
              <legend className="field-legend">Account verification</legend>
              <label className="field-label" htmlFor="signup-email">Email address</label>
              <input id="signup-email" name="email" type="email" required autoComplete="email" className="field-input" placeholder="Personal or SPCC email" />
              <label className="field-label" htmlFor="signup-confirm-email">Confirm email address</label>
              <input id="signup-confirm-email" name="confirm_email" type="email" required autoComplete="email" className="field-input" placeholder="Enter your email again" />
              <label className="field-label" htmlFor="signup-school-id">School ID <span className="field-label-note">Required for students and faculty</span></label>
              <input id="signup-school-id" name="school_id" type="text" maxLength={60} className="field-input" placeholder="Student number, LRN or faculty ID" />
              <p className="auth-field-hint">Visitors may leave the school ID blank. Administrators verify submitted details before approval.</p>
              <label className="auth-consent">
                <input type="checkbox" name="consent" required />
                <span>I agree to the collection of my name, email, account type and school ID for identity verification and appointment access under RA 10173.</span>
              </label>
              <Submit label="Request activation" pendingLabel="Submitting activation..." />
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
            <button type="button" className="auth-ghost" onClick={() => go('activate')}>
              Activate account <ArrowRight />
            </button>
          </div>
          <div className="auth-overlay-panel auth-overlay-back" inert={!up}>
            <p className="auth-overlay-kicker">Identity verification</p>
            <h2>Activate your SPCC Pass access</h2>
            <p>Submit your details for school verification. After approval, follow your activation email to set a password and sign in.</p>
            <button type="button" className="auth-ghost" onClick={() => go('signin')}>
              Back to sign in <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
