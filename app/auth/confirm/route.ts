import { NextResponse, type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  if (!token_hash || (type !== 'invite' && type !== 'recovery')) {
    return NextResponse.redirect(new URL('/login?error=Invalid+activation+link', url.origin))
  }
  const sb = await supabase()
  const { error } = await sb.auth.verifyOtp({ token_hash, type })
  if (error) return NextResponse.redirect(new URL('/login?error=Activation+link+expired+or+invalid', url.origin))
  const response = NextResponse.redirect(new URL('/set-password', url.origin))
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
