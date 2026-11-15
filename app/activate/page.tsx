import { redirect } from 'next/navigation'
import { AuthBrand } from '@/components/auth-bits'
import { AuthSlider } from '@/components/auth-slider'
import { supabase } from '@/lib/supabase/server'

export default async function Activate({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (user) redirect('/')
  const { error, msg } = await searchParams
  return <main className="auth-page"><div className="auth-shell">
    <AuthBrand />
    <AuthSlider initialMode="activate" error={error} msg={msg} />
  </div></main>
}
