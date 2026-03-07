import { auth } from '@/lib/auth/config'

/** Get authorization headers for server-side API calls */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await auth()
  if (!session?.accessToken) {
    throw new Error('Not authenticated')
  }
  return {
    Authorization: `Bearer ${session.accessToken}`,
  }
}
