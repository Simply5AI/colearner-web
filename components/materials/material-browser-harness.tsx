'use client'

import { SessionContext } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { MaterialImport } from './material-import'
import { MaterialLibrary } from './material-library'
import { MaterialReader } from './material-reader'
import { MaterialSnap } from './material-snap'

/** Requests require Playwright's explicitly labelled synthetic HTTP fixtures. */
export function MaterialBrowserHarness() {
  const session = { expires: '2030-01-01T00:00:00.000Z', accessToken: 'b06-browser-fixture-session', user: { id: 'b06-browser-learner', email: 'fixture@example.invalid', name: 'B06 browser fixture', onboardingCompleted: true } }
  const params = useSearchParams()
  const view = params.get('screen')
  return <SessionContext.Provider value={{ data: session, status: 'authenticated', update: async () => session }}><div className="min-h-screen bg-background text-foreground"><p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B06 development UI qualification · synthetic HTTP fixtures only · no real AI or product records</p>{view === 'import' ? <MaterialImport /> : view === 'snap' ? <MaterialSnap /> : view === 'reader' ? <MaterialReader id="material-a" /> : <MaterialLibrary />}</div></SessionContext.Provider>
}

