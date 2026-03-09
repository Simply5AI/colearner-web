import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'

/** Get authorization headers for server-side API calls. Redirects to signout route if unauthenticated. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await auth()
  if (!session?.accessToken) {
    redirect('/api/auth/force-signout')
  }
  return {
    Authorization: `Bearer ${session.accessToken}`,
  }
}
