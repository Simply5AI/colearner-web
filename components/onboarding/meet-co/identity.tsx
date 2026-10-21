'use client'

import { createContext, useContext, type ReactNode } from 'react'

export interface MeetCoIdentity { scope: string; learnerName: string | null; kind: 'child' | 'account' }
const Identity = createContext<MeetCoIdentity>({ scope: 'anonymous', learnerName: null, kind: 'account' })
/** Only a nonsecret cache scope and a first name reach the browser. Credentials stay in HttpOnly cookies. */
export function MeetCoIdentityProvider({ value, children }: { value: MeetCoIdentity; children: ReactNode }) { return <Identity.Provider value={value}>{children}</Identity.Provider> }
export const useMeetCoIdentity = () => useContext(Identity)
