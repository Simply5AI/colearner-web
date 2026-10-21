'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Card,
  Input,
  Select,
  Button,
  EmptyState,
} from '@/components/design-system'
import {
  type Invitation,
  type IssuedSchoolInvitation,
  type SchoolMember,
  type SchoolClass,
  type TeachingAssignment,
  type Paged,
  type CursorList,
  classLabel,
} from '@/lib/api/school'
import {
  SchoolHeading,
  QueryState,
  ActionFeedback,
  Pagination,
  useSchoolData,
  useSchoolAction,
} from './school-common'

export function InvitationComposer({
  schoolId,
  roles = ['TEACHER'],
}: {
  schoolId: string
  roles?: Array<'TEACHER' | 'STUDENT' | 'PARENT'>
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(roles[0])
  const [created, setCreated] = useState<IssuedSchoolInvitation>()
  const action = useSchoolAction(schoolId)
  return (
    <div className="space-y-4">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          action.mutate(
            { suffix: '/invitations', body: { email, role } },
            {
              onSuccess: (result) => {
                setCreated(result as IssuedSchoolInvitation)
                setEmail('')
              },
            },
          )
        }}
      >
        <Input
          label="Invitation email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="off"
          maxLength={254}
        />
        <Select
          label="School membership role"
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
        >
          {roles.map((item) => (
            <option key={item} value={item}>
              {item === 'TEACHER'
                ? 'School teacher'
                : item === 'STUDENT'
                  ? 'School student'
                  : 'Parent / guardian'}
            </option>
          ))}
        </Select>
        <Button type="submit" loading={action.isPending}>
          Create bound invitation
        </Button>
      </form>
      <ActionFeedback pending={action.isPending} error={action.error} />
      {created && (
        <div role="status" className="space-y-3 rounded-xl border p-4">
          <p>
            Invitation created for {created.email}. Share the code through your
            school’s approved channel; it is displayed once.
          </p>
          {created.token && (
            <label className="block space-y-2">
              <span className="font-semibold">Invitation code</span>
              <textarea
                readOnly
                className="ds-input min-h-24 w-full break-all font-mono text-sm"
                value={created.token}
              />
            </label>
          )}
          <p className="text-sm text-muted-foreground">
            Expires: {new Date(created.expiresAt).toLocaleString()}. Accept at
            /invite with this verified email.
          </p>
          <Button variant="ghost" onClick={() => setCreated(undefined)}>
            Hide invitation code
          </Button>
        </div>
      )}
    </div>
  )
}
export function StaffScreen({ schoolId }: { schoolId: string }) {
  const search = useSearchParams()
  const [cursor, setCursor] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [classId, setClassId] = useState(search.get('classId') ?? '')
  const [teacherId, setTeacherId] = useState('')
  const [subject, setSubject] = useState('')
  const [page, setPage] = useState(1)
  const [classPage, setClassPage] = useState(() => {
    const requested = Number(search.get('classPage'))
    return Number.isInteger(requested) && requested >= 1 && requested <= 100000
      ? requested
      : 1
  })
  const [inviteCursor, setInviteCursor] = useState('')
  const [inviteHistory, setInviteHistory] = useState<string[]>([])
  const members = useSchoolData<CursorList<SchoolMember>>(
    schoolId,
    `/memberships${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  )
  const invitations = useSchoolData<CursorList<Invitation>>(
    schoolId,
    `/invitations${inviteCursor ? `?cursor=${encodeURIComponent(inviteCursor)}` : ''}`,
  )
  const classes = useSchoolData<Paged<SchoolClass>>(
    schoolId,
    `/classes?page=${classPage}&pageSize=100`,
  )
  const assignments = useSchoolData<Paged<TeachingAssignment>>(
    schoolId,
    `/teaching-assignments?page=${page}&pageSize=100`,
  )
  const action = useSchoolAction(schoolId)
  const teachers =
    members.data?.items.filter(
      (item) => item.role === 'TEACHER' && item.status === 'ACTIVE',
    ) ?? []
  return (
    <div className="space-y-8">
      <SchoolHeading
        title="Teachers & staff"
        description="Invite school-managed teachers and assign their classes and subjects. School administrators cannot grant platform roles, invite independent tutors or approve guardian consent."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-5">
          <h2 className="text-xl font-bold">Invite a teacher</h2>
          <InvitationComposer schoolId={schoolId} />
        </Card>
        <Card className="space-y-5">
          <h2 className="text-xl font-bold">Invitation status</h2>
          <QueryState
            pending={invitations.isPending}
            error={invitations.error}
            retry={() => void invitations.refetch()}
          >
            {invitations.data?.items.length === 0 && (
              <p>No school invitations yet.</p>
            )}
            <ul className="space-y-3">
              {invitations.data?.items.map((item) => (
                <li key={item.id} className="space-y-2 rounded-xl border p-3">
                  <p className="break-words font-semibold">{item.email}</p>
                  <p className="text-sm">
                    {item.role} · {item.status}
                  </p>
                  {item.status === 'PENDING' && (
                    <Button
                      variant="ghost"
                      loading={action.isPending}
                      onClick={() =>
                        action.mutate({
                          suffix: `/invitations/${encodeURIComponent(item.id)}`,
                          method: 'DELETE',
                        })
                      }
                    >
                      Revoke invitation
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                disabled={inviteHistory.length === 0}
                onClick={() => {
                  setInviteCursor(inviteHistory[inviteHistory.length - 1] ?? '')
                  setInviteHistory((old) => old.slice(0, -1))
                }}
              >
                Previous invitations
              </Button>
              <Button
                variant="secondary"
                disabled={!invitations.data?.nextCursor}
                onClick={() => {
                  setInviteHistory((old) => [...old, inviteCursor])
                  setInviteCursor(invitations.data?.nextCursor ?? '')
                }}
              >
                Next invitations
              </Button>
            </div>
          </QueryState>
        </Card>
      </div>
      <Card className="space-y-5">
        <h2 className="text-xl font-bold">School memberships</h2>
        <QueryState
          pending={members.isPending}
          error={members.error}
          retry={() => void members.refetch()}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {members.data?.items.map((item) => (
              <div key={item.id} className="space-y-3 rounded-xl border p-4">
                <h3 className="break-words font-bold">
                  {item.name || item.email}
                </h3>
                <p className="break-words text-sm text-muted-foreground">
                  {item.email}
                </p>
                <span className="ds-pill">
                  {item.role} · {item.status}
                </span>
                {item.role !== 'SCHOOL_ADMIN' && (
                  <div className="flex flex-wrap gap-2">
                    {item.status !== 'ACTIVE' && (
                      <Button
                        variant="secondary"
                        loading={action.isPending}
                        onClick={() =>
                          action.mutate({
                            suffix: `/memberships/${encodeURIComponent(item.id)}`,
                            method: 'PATCH',
                            body: { status: 'ACTIVE' },
                          })
                        }
                      >
                        Reactivate membership
                      </Button>
                    )}
                    {item.status === 'ACTIVE' && (
                      <Button
                        variant="secondary"
                        loading={action.isPending}
                        onClick={() =>
                          action.mutate({
                            suffix: `/memberships/${encodeURIComponent(item.id)}`,
                            method: 'PATCH',
                            body: { status: 'SUSPENDED' },
                          })
                        }
                      >
                        Suspend membership
                      </Button>
                    )}
                    {item.status !== 'ARCHIVED' && (
                      <Button
                        variant="ghost"
                        loading={action.isPending}
                        onClick={() =>
                          action.mutate({
                            suffix: `/memberships/${encodeURIComponent(item.id)}`,
                            method: 'PATCH',
                            body: { status: 'ARCHIVED' },
                          })
                        }
                      >
                        Archive membership
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              disabled={history.length === 0}
              onClick={() => {
                setCursor(history[history.length - 1] ?? '')
                setHistory((old) => old.slice(0, -1))
              }}
            >
              Previous memberships
            </Button>
            <Button
              variant="secondary"
              disabled={!members.data?.nextCursor}
              onClick={() => {
                setHistory((old) => [...old, cursor])
                setCursor(members.data?.nextCursor ?? '')
              }}
            >
              Next memberships
            </Button>
          </div>
        </QueryState>
      </Card>
      <Card className="space-y-5">
        <h2 className="text-xl font-bold">Class and subject assignments</h2>
        <QueryState
          pending={classes.isPending}
          error={classes.error}
          retry={() => void classes.refetch()}
        >
          <form
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault()
              action.mutate(
                {
                  suffix: '/teaching-assignments',
                  body: { classId, membershipId: teacherId, subject },
                },
                { onSuccess: () => setSubject('') },
              )
            }}
          >
            <Select
              label="Assigned class"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              required
            >
              <option value="">Choose class</option>
              {classes.data?.items
                .filter((item) => !item.archivedAt)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {classLabel(item)}
                  </option>
                ))}
            </Select>
            <Select
              label="Active school teacher"
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
              required
            >
              <option value="">Choose teacher</option>
              {teachers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.email}
                </option>
              ))}
            </Select>
            <Input
              label="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              maxLength={80}
            />
            <Button
              type="submit"
              disabled={!classId || !teacherId}
              loading={action.isPending}
            >
              Assign teacher
            </Button>
          </form>
          {classes.data && (
            <Pagination
              page={classPage}
              total={classes.data.total}
              onChange={setClassPage}
            />
          )}
        </QueryState>
        <QueryState
          pending={assignments.isPending}
          error={assignments.error}
          retry={() => void assignments.refetch()}
        >
          {assignments.data?.items.length === 0 && (
            <EmptyState
              band="adults"
              title="No teaching assignments"
              description="Assign an active school teacher to a class and subject."
            />
          )}
          <ul className="space-y-3">
            {assignments.data?.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold">{item.subject}</p>
                  <p className="break-words text-sm text-muted-foreground">
                    {item.classroom
                      ? classLabel(item.classroom)
                      : 'Assigned school class'}{' '}
                    · {item.membership?.user.name || 'School teacher'}
                  </p>
                </div>
                {item.revokedAt ? (
                  <span className="ds-pill">Revoked</span>
                ) : (
                  <Button
                    variant="secondary"
                    loading={action.isPending}
                    onClick={() =>
                      action.mutate({
                        suffix: `/teaching-assignments/${encodeURIComponent(item.id)}`,
                        method: 'DELETE',
                      })
                    }
                  >
                    Revoke assignment
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {assignments.data && (
            <Pagination
              page={page}
              total={assignments.data.total}
              onChange={setPage}
            />
          )}
        </QueryState>
      </Card>
      <ActionFeedback
        pending={action.isPending}
        error={action.error}
        success={action.isSuccess}
      />
    </div>
  )
}
