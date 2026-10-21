'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'

const MaterialIdentity = createContext<string | null>(null)
/** Only a nonsecret cache scope is exposed. HttpOnly credentials stay at the server boundary. */
export function MaterialIdentityProvider({ scope, children }: { scope: string; children: ReactNode }) { return <MaterialIdentity.Provider value={scope}>{children}</MaterialIdentity.Provider> }
export function useMaterialIdentity() {
  const scope = useContext(MaterialIdentity)
  const { data: session } = useSession()
  return scope ?? session?.user?.id ?? ''
}
