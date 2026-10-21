import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { familyRequest, FamilyError } from '@/lib/api/family'
import { FAMILY_DEVICE_COOKIE, FAMILY_CHILD_COOKIE, familyCookieOptions, isAdultSessionCookie } from '@/lib/auth/family-cookies'
import {callBackend} from '@/lib/api/admin-bff'
import {ADMIN_SESSION_COOKIE,ADMIN_PREAUTH_COOKIE} from '@/lib/admin/session-cookie'

export interface FamilyAccessRouteContext { params: Promise<{ operation: string[] }> }
export async function familyAccessRoute(request: NextRequest, context: FamilyAccessRouteContext) {
  const { operation } = await context.params
  const path = operation.join('/')
  const method = request.method
  if (method !== 'GET' && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ message: 'Same-origin request required.' }, { status: 403 })
  let backendPath: string
  let token: string | undefined
  let body: unknown
  if (method === 'POST') {
    if (Number(request.headers.get('content-length') ?? 0) > 4096) return NextResponse.json({ message: 'Request too large.' }, { status: 413 })
    try { body = await request.json() } catch { return NextResponse.json({ message: 'Invalid request.' }, { status: 400 }) }
    if (JSON.stringify(body).length > 4096) return NextResponse.json({ message: 'Request too large.' }, { status: 413 })
  }
  if (path === 'device' && method === 'POST') { token = (await auth())?.accessToken; backendPath = '/family/devices' }
  else if (path === 'profiles' && method === 'GET') { token = request.cookies.get(FAMILY_DEVICE_COOKIE)?.value; backendPath = '/family/device/profiles' }
  else if (/^profiles\/[0-9a-f-]{36}\/unlock$/i.test(path) && method === 'POST') { token = request.cookies.get(FAMILY_DEVICE_COOKIE)?.value; backendPath = `/family/device/${path}` }
  else if (path === 'device' && method === 'DELETE') { token = request.cookies.get(FAMILY_DEVICE_COOKIE)?.value; backendPath = '/family/device' }
  else if (path === 'child' && (method === 'GET' || method === 'DELETE')) { token = request.cookies.get(FAMILY_CHILD_COOKIE)?.value; backendPath = '/family/child' }
  else return NextResponse.json({ message: 'Not found.' }, { status: 404 })
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 })
  try {
    if (path==='device'&&method==='POST'||path.endsWith('/unlock')) {
      const adminSid=request.cookies.get(ADMIN_SESSION_COOKIE)?.value
      if(adminSid){
        const logout=await callBackend('/api/admin/auth/logout',{method:'POST',cookie:`${ADMIN_SESSION_COOKIE}=${adminSid}`,cache:'no-store',signal:AbortSignal.timeout(10000)})
        if(!logout.ok&&logout.status!==401)throw new FamilyError(503,'The adult administrator session could not be closed. Please try again before handing over this device.')
      }
      if(path.endsWith('/unlock')&&request.cookies.getAll().some(cookie=>isAdultSessionCookie(cookie.name))){
        const adult=await auth()
        if(adult?.accessToken){try{await familyRequest(adult.accessToken,'/auth/logout','POST')}catch(error){if(!(error instanceof FamilyError&&error.status===401))throw error}}
      }
    }
    const result = await familyRequest<Record<string, unknown>>(token, backendPath, method as 'GET' | 'POST' | 'DELETE', body)
    const response = NextResponse.json(path === 'device' && method === 'POST' ? { enrolled: true } : path.endsWith('/unlock') ? { profileId: result.profileId, schoolId: result.schoolId } : result)
    response.headers.set('Cache-Control', 'no-store')
    if (path === 'device' && method === 'POST') {
      if (typeof result.deviceToken !== 'string' || typeof result.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.expiresAt))) return NextResponse.json({ message: 'Invalid session response.' }, { status: 502 })
      response.cookies.set(FAMILY_DEVICE_COOKIE, result.deviceToken, familyCookieOptions(result.expiresAt))
      response.cookies.delete(FAMILY_CHILD_COOKIE)
      // The backend has already revoked this adult sid. Remove every Auth.js chunk.
      for (const cookie of request.cookies.getAll()) if (isAdultSessionCookie(cookie.name)) response.cookies.delete(cookie.name)
      response.cookies.delete('colearner-school-membership')
      response.cookies.delete(ADMIN_SESSION_COOKIE)
      response.cookies.delete(ADMIN_PREAUTH_COOKIE)
    }
    if (path.endsWith('/unlock')) {
      if (typeof result.childToken !== 'string' || typeof result.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.expiresAt))) return NextResponse.json({ message: 'Invalid session response.' }, { status: 502 })
      response.cookies.set(FAMILY_CHILD_COOKIE, result.childToken, familyCookieOptions(result.expiresAt))
      for (const cookie of request.cookies.getAll()) if (isAdultSessionCookie(cookie.name)) response.cookies.delete(cookie.name)
      response.cookies.delete('colearner-school-membership')
      response.cookies.delete(ADMIN_SESSION_COOKIE)
      response.cookies.delete(ADMIN_PREAUTH_COOKIE)
    }
    if (method === 'DELETE') { response.cookies.delete(FAMILY_CHILD_COOKIE); if (path === 'device') response.cookies.delete(FAMILY_DEVICE_COOKIE) }
    return response
  } catch (error) {
    const response = NextResponse.json({ message: error instanceof FamilyError ? error.message : 'Family services are unavailable.', ...(error instanceof FamilyError && error.code ? { code: error.code } : {}) }, { status: error instanceof FamilyError ? error.status : 503 })
    if (method === 'DELETE') { response.cookies.delete(FAMILY_CHILD_COOKIE); if (path === 'device') response.cookies.delete(FAMILY_DEVICE_COOKIE) }
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
}
