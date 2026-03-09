import { NextResponse } from 'next/server'
import { signOut } from '@/lib/auth/config'

export async function GET() {
  await signOut({ redirect: false })
  return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL || 'http://localhost:3001'))
}
