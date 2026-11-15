import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions'
import { AuthBrand } from '@/components/auth-bits'
import { supabase } from '@/lib/supabase/server'

export default async function AccessPending() {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await sb.from('profiles').select('authorized').eq('id', user.id).maybeSingle()
  if (profile?.authorized) redirect('/')
  return <main className="auth-page"><div className="auth-shell"><AuthBrand />
    <div className="auth-reset-card">
      <h1>Account approval required</h1>
      <p>Your sign-in was verified, but your SPCC Pass access must be approved by a school administrator. An email account alone does not prove school enrollment.</p>
      <p>If you have not submitted an access request yet, contact your administrator to review your account.</p>
      <form action={signOut}><button className="primary-button auth-submit">Sign out</button></form>
    </div>
  </div></main>
}
