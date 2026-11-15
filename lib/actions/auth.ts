import { redirect } from 'next/navigation'
import { admin } from '@/lib/supabase/admin'
import { supabase } from '@/lib/supabase/server'

const back = (path: '/login' | '/signup' | '/set-password', kind: 'error' | 'msg', text: string): never =>
  redirect(path + '?' + kind + '=' + encodeURIComponent(text))

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254

export async function signIn(fd: FormData) {
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const password = String(fd.get('password') ?? '')
  if (!validEmail(email) || !password) back('/login', 'error', 'Enter your email and password.')
  const sb = await supabase()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) back('/login', 'error', 'Wrong email or password. Check both and try again.')
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    const { data: profile } = await sb.from('profiles').select('authorized').eq('id', user.id).maybeSingle()
    if (!profile?.authorized) {
      await sb.auth.signOut()
      back('/login', 'error', 'Your account is awaiting school administrator approval.')
    }
  }
  redirect('/')
}

export async function signUp(fd: FormData) {
  if (String(fd.get('website') ?? '').trim()) back('/login', 'msg', 'Request received. Check your email after administrator review.')
  if (fd.get('consent') !== 'on') back('/signup', 'error', 'Accept the privacy notice to request access.')
  const type = String(fd.get('type') ?? '')
  if (!['student','faculty','visitor'].includes(type)) back('/signup', 'error', 'Choose a valid account type.')
  const last = String(fd.get('last_name') ?? '').trim()
  const first = String(fd.get('first_name') ?? '').trim()
  const middle = String(fd.get('middle_name') ?? '').trim().replace(/\.$/, '')
  if (!last || !first || last.length > 60 || first.length > 60 || middle.length > 60) back('/signup', 'error', 'Enter valid first and last names.')
  const middleInitial = middle.length > 1 ? middle[0] + '.' : middle
  const full_name = last + ', ' + first + (middleInitial ? ' ' + middleInitial : '')
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  if (!validEmail(email)) back('/signup', 'error', 'Enter a valid email address.')
  const schoolId = String(fd.get('school_id') ?? '').trim()
  if (type !== 'visitor' && (schoolId.length < 2 || schoolId.length > 60)) back('/signup', 'error', 'Provide your student or faculty ID for verification.')
  if (type === 'visitor' && schoolId.length > 60) back('/signup', 'error', 'Keep the reference under 60 characters.')
  const { error } = await admin().from('account_requests').insert({
    email,
    full_name,
    requested_role: type,
    school_id: type === 'visitor' ? null : schoolId,
  })
  if (error && error.code !== '23505') {
    console.error('Account request failed:', error.code)
    back('/signup', 'error', 'Your request could not be submitted. Try again later.')
  }
  back('/login', 'msg', 'Your request has been submitted. An administrator will review your details before sending an activation email.')
}

export async function googleSignIn() {
  const base = process.env.APP_URL?.trim()
  if (!base) back('/login', 'error', 'Google login needs APP_URL configured on the server.')
  let url: URL
  try { url = new URL(base) } catch { back('/login', 'error', 'Invalid APP_URL configuration.') }
  const sb = await supabase()
  const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: url.origin + '/auth/callback' } })
  if (error || !data.url) back('/login', 'error', 'Google login is not available. Contact the administrator.')
  redirect(data.url)
}

export async function setPassword(fd: FormData) {
  const password = String(fd.get('password') ?? '')
  const confirmation = String(fd.get('confirmation') ?? '')
  if (password.length < 12 || password.length > 128) back('/set-password', 'error', 'Use a password with 12 to 128 characters.')
  if (password !== confirmation) back('/set-password', 'error', 'Passwords do not match.')
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) back('/login', 'error', 'Open the activation link from your email.')
  const { data: profile } = await sb.from('profiles').select('authorized').eq('id', user.id).maybeSingle()
  if (!profile?.authorized) back('/set-password', 'error', 'Your account needs administrator approval.')
  const { error } = await sb.auth.updateUser({ password })
  if (error) back('/set-password', 'error', 'Unable to save the new password. Try again.')
  await sb.auth.signOut()
  back('/login', 'msg', 'Password saved. Sign in with your email and new password.')
}

export async function signOut() {
  const sb = await supabase()
  await sb.auth.signOut()
  redirect('/login')
}
