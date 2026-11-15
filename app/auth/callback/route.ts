import { NextResponse, type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/login?error=Google+sign+in+failed', request.url))
  const sb = await supabase()
  const { error } = await sb.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/login?error=Google+sign+in+failed', request.url))
  return NextResponse.redirect(new URL('/', request.url))
}
