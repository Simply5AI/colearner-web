'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

import {
  getAdminUserActivity,
  type AdminUserActivityEntry,
} from '@/lib/api/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ActivityTabProps {
  userId: string
  authHeaders: Record<string, string>
}

export function ActivityTab({ userId, authHeaders }: ActivityTabProps) {
  const [rows, setRows] = useState<AdminUserActivityEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAdminUserActivity(authHeaders, userId, 50)
      setRows(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [authHeaders, userId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm text-muted-foreground">
            Last 50 activity log entries
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        {loading && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading activity…
          </div>
        )}
        {error && (
          <div className="px-4 py-6 text-center text-sm text-destructive">{error}</div>
        )}
        {!loading && !error && rows && (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No activity recorded
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {format(new Date(row.createdAt), 'PP p')}
                  </td>
                  <td className="px-4 py-3 font-medium">{row.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.subject}
                    <span className="ml-1 font-mono text-xs opacity-60">
                      {row.subjectId.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.metadata ? (
                      <pre className="max-w-md overflow-x-auto rounded bg-muted px-2 py-1 text-xs">
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
