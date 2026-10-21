'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => undefined
const clientReady = () => true
const serverReady = () => false

/** Keep credential submission unavailable until React has attached its handlers. */
export function useClientReady() {
  return useSyncExternalStore(subscribe, clientReady, serverReady)
}
