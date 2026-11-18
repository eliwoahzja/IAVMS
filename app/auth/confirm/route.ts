import { NextResponse, type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/server'

const validType = (type: string | null): type is 'invite' | 'recovery' =>
  type === 'invite' || type === 'recovery'

const validToken = (token: string | null): token is string =>
  Boolean(token && token.length >= 16 && token.length <= 512 && /^[A-Za-z0-9_-]+$/.test(token))

const redirectToLogin = (url: URL) =>
  NextResponse.redirect(new URL('/login?error=Activation+link+expired+or+invalid', url.origin), 303)

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const token = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  if (!validType(type) || !validToken(token)) return redirectToLogin(url)

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confirm account access | SPCC Pass</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f4f6fc;color:#17233c;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.card{background:white;border:1px solid #e2e7f0;border-radius:18px;box-shadow:0 12px 32px rgba(22,33,70,.08);padding:34px 30px;width:100%;max-width:430px}.brand{font-size:12px;letter-spacing:.12em;color:#434f8c;font-weight:750;text-transform:uppercase}.bar{width:48px;height:4px;background:#d8ac36;border-radius:10px;margin:17px 0 22px}h1{font-size:25px;line-height:1.3;margin:0 0 12px;color:#121c4c}p{font-size:15px;line-height:1.65;margin:0 0 24px;color:#526078}button{width:100%;background:#121c62;border:0;border-radius:11px;padding:15px 20px;color:#fff;font-weight:700;font-size:15px;cursor:pointer}button:focus-visible{outline:3px solid #d8ac36;outline-offset:3px}.help{font-size:12px;line-height:1.5;margin:19px 0 0;text-align:center}
</style>
</head>
<body><main class="card">
<div class="brand">SPCC Pass</div><div class="bar"></div>
<h1>Confirm your account link</h1>
<p>To continue setting up your password, confirm that you want to open this one-time link.</p>
<form method="post" action="/auth/confirm">
<input type="hidden" name="type" value="${type}">
<input type="hidden" name="token_hash" value="${token}">
<button type="submit">Continue to set password</button>
</form>
<p class="help">If you did not request this account access, close this page.</p>
</main></body></html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  })
}

export async function POST(request: NextRequest) {
  let token: string | null = null
  let type: string | null = null
  try {
    const form = await request.formData()
    token = String(form.get('token_hash') ?? '')
    type = String(form.get('type') ?? '')
  } catch {
    return redirectToLogin(request.nextUrl)
  }
  if (!validType(type) || !validToken(token)) return redirectToLogin(request.nextUrl)

  const sb = await supabase()
  const { error } = await sb.auth.verifyOtp({ token_hash: token, type })
  if (error) return redirectToLogin(request.nextUrl)

  const response = NextResponse.redirect(new URL('/set-password', request.nextUrl.origin), 303)
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('Cache-Control', 'no-store')
  return response
}
