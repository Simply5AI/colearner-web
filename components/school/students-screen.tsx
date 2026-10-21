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
  type Enrollment,
  type SchoolClass,
  type Paged,
  type ImportPreview,
  type CursorList,
  type SchoolMember,
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
import { InvitationComposer } from './staff-screen'
import { GuardianLinks } from './guardian-links'

export function StudentsScreen({ schoolId }: { schoolId: string }) {
  const search = useSearchParams()
  const [classId, setClassId] = useState(search.get('classId') ?? '')
  const [page, setPage] = useState(1)
  const [classPage, setClassPage] = useState(() => {
    const requested = Number(search.get('classPage'))
    return Number.isInteger(requested) && requested >= 1 && requested <= 100000
      ? requested
      : 1
  })
  const [memberCursor, setMemberCursor] = useState('')
  const [memberHistory, setMemberHistory] = useState<string[]>([])
  const [student, setStudent] = useState({
    externalId: '',
    displayName: '',
    membershipId: '',
  })
  const [csv, setCsv] = useState('')
  const [fileError, setFileError] = useState('')
  const [preview, setPreview] = useState<{
    result: ImportPreview
    csv: string
    key: string
  }>()
  const [commitResult, setCommitResult] = useState<{ count: number }>()
  const [targets, setTargets] = useState<Record<string, string>>({})
  const classes = useSchoolData<Paged<SchoolClass>>(
    schoolId,
    `/classes?page=${classPage}&pageSize=100`,
  )
  const members = useSchoolData<CursorList<SchoolMember>>(
    schoolId,
    `/memberships${memberCursor ? `?cursor=${encodeURIComponent(memberCursor)}` : ''}`,
  )
  const currentClass =
    classId || classes.data?.items.find((item) => !item.archivedAt)?.id || ''
  const roster = useSchoolData<Paged<Enrollment>>(
    schoolId,
    `/classes/${encodeURIComponent(currentClass)}/roster?page=${page}&pageSize=100`,
    !!currentClass,
  )
  const action = useSchoolAction(schoolId)
  const importAction = useSchoolAction(schoolId)
  const changeCsv = (value: string) => {
    setCsv(value)
    setPreview(undefined)
    setCommitResult(undefined)
    setFileError('')
  }
  async function readFile(file?: File) {
    if (!file) return
    setPreview(undefined)
    setCommitResult(undefined)
    setFileError('')
    if (file.size > 128 * 1024) {
      setFileError('Choose a CSV file no larger than 128 KB.')
      return
    }
    try {
      changeCsv(await file.text())
    } catch {
      setFileError(
        'This file could not be read. Paste the CSV or try another file.',
      )
    }
  }
  return (
    <div className="space-y-8">
      <SchoolHeading
        title="Students & guardian links"
        description="Create school roster records or link an existing active student membership. Unclaimed records never create accounts, credentials or guardian access."
      />
      <Card className="space-y-5">
        <h2 className="text-xl font-bold">Class roster</h2>
        <QueryState
          pending={classes.isPending}
          error={classes.error}
          retry={() => void classes.refetch()}
        >
          <Select
            label="Roster class"
            value={currentClass}
            onChange={(event) => {
              setClassId(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Choose a class</option>
            {classes.data?.items.map((item) => (
              <option key={item.id} value={item.id}>
                {classLabel(item)}
              </option>
            ))}
          </Select>
          {classes.data && (
            <Pagination
              page={classPage}
              total={classes.data.total}
              onChange={setClassPage}
            />
          )}
        </QueryState>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            action.mutate(
              {
                suffix: `/classes/${encodeURIComponent(currentClass)}/roster`,
                body: {
                  externalId: student.externalId,
                  displayName: student.displayName,
                  ...(student.membershipId
                    ? { membershipId: student.membershipId }
                    : {}),
                },
              },
              {
                onSuccess: () =>
                  setStudent({
                    externalId: '',
                    displayName: '',
                    membershipId: '',
                  }),
              },
            )
          }}
        >
          <Input
            label="School student reference"
            value={student.externalId}
            maxLength={80}
            required
            onChange={(event) =>
              setStudent((old) => ({ ...old, externalId: event.target.value }))
            }
            hint="Use the stable reference from your school roster, not a login credential."
          />
          <Input
            label="Student display name"
            value={student.displayName}
            maxLength={120}
            required
            onChange={(event) =>
              setStudent((old) => ({ ...old, displayName: event.target.value }))
            }
          />
          <div className="space-y-3">
            <QueryState
              pending={members.isPending}
              error={members.error}
              retry={() => void members.refetch()}
            >
              <Select
                label="Existing student membership (optional)"
                value={student.membershipId}
                onChange={(event) =>
                  setStudent((old) => ({
                    ...old,
                    membershipId: event.target.value,
                  }))
                }
              >
                <option value="">Unclaimed school record</option>
                {members.data?.items
                  .filter(
                    (item) =>
                      item.role === 'STUDENT' && item.status === 'ACTIVE',
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name || item.email} · {item.email}
                    </option>
                  ))}
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  disabled={!memberHistory.length}
                  onClick={() => {
                    setMemberCursor(
                      memberHistory[memberHistory.length - 1] ?? '',
                    )
                    setMemberHistory((old) => old.slice(0, -1))
                  }}
                >
                  Previous student memberships
                </Button>
                <Button
                  variant="ghost"
                  disabled={!members.data?.nextCursor}
                  onClick={() => {
                    setMemberHistory((old) => [...old, memberCursor])
                    setMemberCursor(members.data?.nextCursor ?? '')
                  }}
                >
                  Next student memberships
                </Button>
              </div>
            </QueryState>
            <p className="text-sm text-muted-foreground">
              Leave unclaimed unless you are explicitly linking an existing
              active student membership. The server verifies the link.
            </p>
            {student.membershipId && (
              <Input
                label="Selected student membership ID for CSV"
                value={student.membershipId}
                readOnly
              />
            )}
          </div>
          <Button
            type="submit"
            className="self-end"
            loading={action.isPending}
            disabled={!currentClass}
          >
            Add student record
          </Button>
        </form>
        {currentClass ? (
          <QueryState
            pending={roster.isPending}
            error={roster.error}
            retry={() => void roster.refetch()}
          >
            {roster.data?.items.length === 0 && (
              <EmptyState
                band="adults"
                title="This roster is empty"
                description="Add a student record or review a CSV import below."
              />
            )}
            <div className="space-y-4">
              {roster.data?.items.map((item) => (
                <div key={item.id} className="space-y-4 rounded-2xl border p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="break-words font-bold">
                        {item.studentRecord.displayName}
                      </h3>
                      <p className="break-words text-sm text-muted-foreground">
                        School reference: {item.studentRecord.externalId}
                      </p>
                    </div>
                    <span className="ds-pill">
                      {item.status === 'ARCHIVED'
                        ? 'Archived'
                        : item.identityStatus === 'UNCLAIMED'
                          ? 'Unclaimed identity'
                          : 'Linked student membership'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    School membership does not itself grant guardian or chat access.
                  </p>
                  <GuardianLinks schoolId={schoolId} studentRecordId={item.studentRecord.id} studentName={item.studentRecord.displayName} />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      loading={action.isPending}
                      onClick={() =>
                        action.mutate({
                          suffix: `/classes/${encodeURIComponent(currentClass)}/roster/${encodeURIComponent(item.id)}`,
                          method: 'PATCH',
                          body: { archived: item.status !== 'ARCHIVED' },
                        })
                      }
                    >
                      {item.status === 'ARCHIVED'
                        ? 'Restore roster entry'
                        : 'Archive roster entry'}
                    </Button>
                    {item.status === 'ACTIVE' && (
                      <form
                        className="flex min-w-0 flex-wrap items-end gap-3"
                        onSubmit={(event) => {
                          event.preventDefault()
                          action.mutate({
                            suffix: `/classes/${encodeURIComponent(currentClass)}/roster/${encodeURIComponent(item.id)}/transfer`,
                            body: { targetClassId: targets[item.id] },
                          })
                        }}
                      >
                        <Select
                          label={`Transfer ${item.studentRecord.displayName} to class`}
                          value={targets[item.id] ?? ''}
                          onChange={(event) =>
                            setTargets((old) => ({
                              ...old,
                              [item.id]: event.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Choose target class</option>
                          {classes.data?.items
                            .filter(
                              (entry) =>
                                !entry.archivedAt && entry.id !== currentClass,
                            )
                            .map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {classLabel(entry)}
                              </option>
                            ))}
                        </Select>
                        <Button
                          variant="secondary"
                          type="submit"
                          disabled={!targets[item.id]}
                          loading={action.isPending}
                        >
                          Transfer in this school
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {roster.data && (
              <Pagination
                page={page}
                total={roster.data.total}
                onChange={setPage}
              />
            )}
          </QueryState>
        ) : (
          <p>Create a class before adding a roster.</p>
        )}
        <ActionFeedback
          pending={action.isPending}
          error={action.error}
          success={action.isSuccess}
        />
      </Card>
      <Card className="space-y-5">
        <h2 className="text-xl font-bold">Review a CSV roster import</h2>
        <p className="text-sm text-muted-foreground">
          Exact header:{' '}
          <code className="break-all">
            externalId,displayName,classId,membershipId
          </code>
          . Use class IDs from this school and leave membershipId blank for
          unclaimed records. Up to 500 rows / 128 KB. Quoted names can contain
          commas.
        </p>
        <Input
          label="Selected class ID for CSV"
          value={currentClass}
          readOnly
          hint="Use this identifier in the classId CSV column, or select another class above."
        />
        <Input
          label="CSV file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void readFile(event.target.files?.[0])}
          disabled={importAction.isPending}
        />
        <label className="block space-y-2">
          <span className="font-semibold">CSV content</span>
          <textarea
            className="ds-input min-h-44 w-full font-mono text-sm"
            value={csv}
            onChange={(event) => changeCsv(event.target.value)}
            disabled={importAction.isPending}
            spellCheck={false}
          />
        </label>
        {fileError && <p role="alert">{fileError}</p>}
        <Button
          variant="secondary"
          loading={importAction.isPending}
          disabled={!csv.trim()}
          onClick={() => {
            const snapshot = csv
            importAction.mutate(
              { suffix: '/roster-imports/preview', body: { csv: snapshot } },
              {
                onSuccess: (result) => {
                  setPreview({
                    result: result as ImportPreview,
                    csv: snapshot,
                    key: crypto.randomUUID(),
                  })
                  setCommitResult(undefined)
                },
              },
            )
          }}
        >
          Preview import
        </Button>
        {preview && (
          <div className="space-y-4">
            <p role="status">
              {preview.result.totalRows} rows reviewed ·{' '}
              {preview.result.rows.length} valid rows ·{' '}
              {preview.result.errors.length} errors
            </p>
            {preview.result.errors.length > 0 && (
              <ul aria-label="CSV import errors" className="space-y-2">
                {preview.result.errors.map((error, index) => (
                  <li
                    key={`${error.row}-${error.code}-${index}`}
                    className="break-words rounded-xl border border-destructive/30 p-3"
                  >
                    Row {error.row}: {error.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {preview.result.rows.map((row) => (
                <p key={row.row} className="break-words rounded-xl border p-3">
                  Row {row.row} · {row.displayName} · {row.externalId} ·{' '}
                  {row.membershipId
                    ? 'Existing membership link'
                    : 'Unclaimed school record'}
                </p>
              ))}
            </div>
            <Button
              loading={importAction.isPending}
              disabled={
                !preview.result.valid || preview.csv !== csv || !!commitResult
              }
              onClick={() =>
                importAction.mutate(
                  {
                    suffix: '/roster-imports/commit',
                    body: { csv: preview.csv, idempotencyKey: preview.key },
                  },
                  {
                    onSuccess: (result) =>
                      setCommitResult(result as { count: number }),
                  },
                )
              }
            >
              Commit reviewed import
            </Button>
            <p className="text-sm text-muted-foreground">
              The server revalidates the complete import before saving. Failed
              retries retain the same operation ID.
            </p>
          </div>
        )}
        <ActionFeedback
          pending={importAction.isPending}
          error={importAction.error}
        />
        {commitResult && (
          <p role="status">
            Imported {commitResult.count} roster entries. No global identities
            were deleted or guardian relationships approved.
          </p>
        )}
      </Card>
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">
          Membership and guardian invitations
        </h2>
        <p className="text-muted-foreground">
          A student or parent invitation activates school membership after
          verified-email acceptance. It does not claim a roster record, verify a
          guardian relationship or link siblings. Use the per-child verified guardian invitation above for those checks.
        </p>
        <InvitationComposer schoolId={schoolId} roles={['STUDENT', 'PARENT']} />
      </Card>
    </div>
  )
}
