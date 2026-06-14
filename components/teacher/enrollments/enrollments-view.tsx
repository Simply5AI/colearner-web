'use client'

import { useState } from 'react'
import { Copy, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createInviteCodeClient, revokeInviteCodeClient } from '@/lib/api/teacher-enrollments-client'
import type { TeacherEnrollment, TeacherInviteCode } from '@/lib/types/teacher'

interface EnrollmentsViewProps {
  planId: string
  initialEnrollments: TeacherEnrollment[]
  initialInviteCodes: TeacherInviteCode[]
}

export function EnrollmentsView({
  planId,
  initialEnrollments,
  initialInviteCodes,
}: EnrollmentsViewProps) {
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const [inviteCodes, setInviteCodes] = useState(initialInviteCodes)
  const [maxUses, setMaxUses] = useState('25')
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreateCode() {
    setIsCreating(true)
    try {
      const invite = await createInviteCodeClient(planId, {
        maxUses: Number(maxUses) || 10,
        expiresAt: null,
      })
      setInviteCodes((current) => [invite, ...current])
      toast.success('Invite code created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create code')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleRevoke(inviteId: string) {
    try {
      await revokeInviteCodeClient(planId, inviteId)
      setInviteCodes((current) => current.filter((code) => code.id !== inviteId))
      toast.success('Invite code revoked')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke code')
    }
  }

  function copyShareLink(code: string) {
    const link = `${window.location.origin}/enroll?code=${encodeURIComponent(code)}`
    void navigator.clipboard.writeText(link)
    toast.success('Share link copied')
  }

  return (
    <Tabs defaultValue="enrollments">
      <TabsList>
        <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
        <TabsTrigger value="invites">Invite codes</TabsTrigger>
      </TabsList>

      <TabsContent value="enrollments" className="space-y-4 pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Enrolled students
            </CardTitle>
            <CardDescription>{enrollments.length} active enrollments</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No enrollments yet. Create an invite code to get started.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Last score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="px-4 py-3">
                          <p className="font-medium">{entry.studentName}</p>
                          <p className="text-xs text-muted-foreground">{entry.studentEmail}</p>
                        </td>
                        <td className="px-4 py-3 capitalize">{entry.source}</td>
                        <td className="px-4 py-3">{entry.progressPercent}%</td>
                        <td className="px-4 py-3">{entry.lastExamScore ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="invites" className="space-y-4 pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create invite code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="max-uses">Max uses</Label>
              <Input
                id="max-uses"
                type="number"
                min={1}
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                className="w-32"
              />
            </div>
            <Button onClick={() => void handleCreateCode()} disabled={isCreating}>
              <Plus className="h-4 w-4" />
              {isCreating ? 'Creating...' : 'New code'}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          {inviteCodes.map((invite) => (
            <Card key={invite.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-lg font-semibold">{invite.code}</p>
                  <Button size="sm" variant="outline" onClick={() => copyShareLink(invite.code)}>
                    <Copy className="h-3.5 w-3.5" />
                    Share
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {invite.usedCount}/{invite.maxUses} used
                </p>
                <Button size="sm" variant="ghost" onClick={() => void handleRevoke(invite.id)}>
                  Revoke
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  )
}