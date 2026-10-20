import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Dashboard } from '@/components/dashboard'
import { DashboardSkeleton } from '@/components/dashboard-skeleton'
import { rows } from '@/lib/db'
import { supabase } from '@/lib/supabase/server'
import type { Appt, Avail, Dept, MailRow, Profile, Visitor } from '@/lib/types'

export default async function Page() {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single()
  if (!data) redirect('/login')
  const profile = data as Profile

  return <Suspense fallback={<DashboardSkeleton profile={profile} />}>
    <Workspace profile={profile} />
  </Suspense>
}

async function Workspace({ profile }: { profile: Profile }) {
  const sb = await supabase()
  const staff = profile.role === 'admin' || profile.role === 'approver'
  const isAdmin = profile.role === 'admin'

  const [appts, visitors, avail, users, emails, departments] = await Promise.all([
    rows<Appt>(sb.from('appointments').select('*').order('date').order('time')),
    staff ? rows<Visitor>(sb.from('visitors').select('*').order('created_at', { ascending: false })) : Promise.resolve([] as Visitor[]),
    staff ? rows<Avail>(sb.from('availability').select('*')) : Promise.resolve([] as Avail[]),
    isAdmin ? rows<Profile>(sb.from('profiles').select('*').order('created_at')) : Promise.resolve([] as Profile[]),
    isAdmin ? rows<MailRow>(sb.from('email_log').select('*').order('created_at', { ascending: false }).limit(50)) : Promise.resolve([] as MailRow[]),
    rows<Dept>(sb.from('departments').select('*').order('name')),
  ])
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  return <Dashboard profile={profile} appts={appts} visitors={visitors} avail={avail} users={users} emails={emails} departments={departments} today={today} />
}
