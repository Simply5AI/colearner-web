import { NextResponse } from 'next/server'

/** Retired in B06: source reads require the current school/learner material boundary. */
export async function POST() {
  return NextResponse.json({ code: 'LEGACY_SOURCE_ROUTE_RETIRED', message: 'Use the material import flow. This source is available only after its processor and school permissions are qualified.', importPath: '/learn/import' }, { status: 410, headers: { 'Cache-Control': 'no-store' } })
}
