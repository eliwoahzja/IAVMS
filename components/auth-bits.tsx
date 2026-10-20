'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff } from 'lucide-react'

export function AuthBrand() {
  return <div className="auth-brand">
    <img className="auth-seal" src="/seal.png" alt="" width={76} height={76} />
    <strong>SPCC Appointments</strong>
    <span>Systems Plus Computer College, Caloocan</span>
  </div>
}

export function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return <button className="primary-button auth-submit" disabled={pending} aria-busy={pending}>{pending && <i className="spin" aria-hidden="true" />}{pending ? pendingLabel : label}</button>
}

export function PasswordField({ id, autoComplete, minLength }: { id: string; autoComplete: string; minLength?: number }) {
  const [show, setShow] = useState(false)
  return <div className="field-row">
    <label className="field-label" htmlFor={id}>Password{minLength ? <span className="field-label-note">{minLength} characters minimum</span> : null}</label>
    <input id={id} name="password" type={show ? 'text' : 'password'} required minLength={minLength} autoComplete={autoComplete} className="field-input" />
    <button type="button" className="password-toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>{show ? <EyeOff /> : <Eye />}</button>
  </div>
}
