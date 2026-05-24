'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Trash2 } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

import {
  getAdminUserSessions,
  revokeAdminUserSession,
  type AdminUserSession,
} from '@/lib/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface SessionsTabProps {
  userId: string
  authHeaders: Record<string, string>
}

export function SessionsTab({ userId, authHeaders }: SessionsTabProps) {
  const [sessions, setSessions] = useState<AdminUserSession[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAdminUserSessions(authHeaders, userId)
      setSessions(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [authHeaders, userId])

  useEffect(() => {
    void load()
  }, [load])

  const revoke = async (tokenId: string) => {
    setBusy(tokenId)
    try {
      await revokeAdminUserSession(authHeaders, userId, tokenId)
      toast.success('Session revoked')
      setSessions((prev) => prev?.filter((s) => s.tokenId !== tokenId) ?? null)
    } catch (err) {
      toast.error('Failed to revoke session', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm text-muted-foreground">
            Active refresh tokens (Redis-backed)
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        {loading && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading sessions…
          </div>
        )}
        {error && (
          <div className="px-4 py-6 text-center text-sm text-destructive">{error}</div>
        )}
        {!loading && !error && sessions && (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Token ID</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No active sessions
                  </td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.tokenId} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.tokenId.slice(0, 10)}…{s.tokenId.slice(-6)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.expiresAt ? (
                      <span title={s.expiresAt}>
                        {format(new Date(s.expiresAt), 'PP p')} (
                        {formatDistanceToNow(new Date(s.expiresAt), { addSuffix: true })})
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.isExpired ? (
                      <Badge variant="outline">expired</Badge>
                    ) : (
                      <Badge variant="secondary">active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke(s.tokenId)}
                      disabled={busy === s.tokenId}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
