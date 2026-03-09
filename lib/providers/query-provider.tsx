'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { ApiError } from '@/lib/api/client'

let signingOut = false

function handleGlobal401(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && !signingOut) {
    signingOut = true
    signOut({ redirectTo: '/login' })
  }
}

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status === 401) return false
              return failureCount < 2
            },
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status === 401) return false
              return failureCount < 1
            },
          },
        },
      })
  )

  queryClient.getQueryCache().config.onError = handleGlobal401
  queryClient.getMutationCache().config.onError = handleGlobal401

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  )
}
