import { redirect } from 'next/navigation'
import { isRequester } from '@/lib/constants'
import { supabase } from '@/lib/supabase/server'
import type { Role } from '@/lib/types'

const back = (path: '/login' | '/signup', kind: 'error' | 'msg', text: string) => redirect(`${path}?${kind}=${encodeURIComponent(text)}`)

export async function signIn(fd: FormData) {
  const sb = await supabase()
  const { error } = await sb.auth.signInWithPassword({ email: String(fd.get('email')), password: String(fd.get('password')) })
  if (error) back('/login', 'error', 'Wrong email or password. Check both and try again.')
  redirect('/')
}

export async function signUp(fd: FormData) {
  if (fd.get('consent') !== 'on') back('/signup', 'error', 'Tick the box to accept the privacy notice.')
  const type = String(fd.get('type'))
  if (!isRequester(type as Role)) back('/signup', 'error', 'Choose what describes you.')
  const last = String(fd.get('last_name')).trim()
  const first = String(fd.get('first_name')).trim()
  const middle = String(fd.get('middle_name') ?? '').trim().replace(/\.$/, '')
  if (!last || !first) back('/signup', 'error', 'Fill in your first and last name.')
  if (last.length > 60 || first.length > 60 || middle.length > 60) back('/signup', 'error', 'Keep each name under 60 characters.')
  const middleInitial = middle.length > 1 ? `${middle[0]}.` : middle
  const full_name = middleInitial ? `${last}, ${first} ${middleInitial}` : `${last}, ${first}`
  const sb = await supabase()
  const { data, error } = await sb.auth.signUp({
    email: String(fd.get('email')),
    password: String(fd.get('password')),
    options: { data: { full_name, type } },
  })
  if (error) back('/signup', 'error', /already (been )?registered/i.test(error.message) ? 'That email already has an account. Sign in instead.' : 'That account could not be created. Check the email and use at least 8 characters for the password.')
  if (!data.session) back('/login', 'msg', 'Check your email to confirm the account, then sign in.')
  redirect('/')
}

export async function signOut() {
  const sb = await supabase()
  await sb.auth.signOut()
  redirect('/login')
}

