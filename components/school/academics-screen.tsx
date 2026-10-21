'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Card,
  Input,
  Select,
  Button,
  EmptyState,
} from '@/components/design-system'
import {
  type AcademicYear,
  type SchoolTerm,
  type SchoolClass,
  type Paged,
  type PromotionPreview,
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

export function AcademicsScreen({ schoolId }: { schoolId: string }) {
  const [yearId, setYearId] = useState('')
  const [page, setPage] = useState(1)
  const [yearPage, setYearPage] = useState(1)
  const [termPage, setTermPage] = useState(1)
  const [year, setYear] = useState({ name: '', startDate: '', endDate: '' })
  const [term, setTerm] = useState({ name: '', startDate: '', endDate: '' })
  const [structure, setStructure] = useState({
    board: 'CBSE',
    grade: '1',
    section: '',
  })
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [promotion, setPromotion] = useState<PromotionPreview>()
  const years = useSchoolData<Paged<AcademicYear>>(
    schoolId,
    `/academic-years?page=${yearPage}&pageSize=100`,
  )
  const selectedYear =
    yearId || years.data?.items.find((item) => !item.archivedAt)?.id || ''
  const selectedYearRecord = years.data?.items.find(
    (item) => item.id === selectedYear,
  )
  const terms = useSchoolData<Paged<SchoolTerm>>(
    schoolId,
    `/academic-years/${encodeURIComponent(selectedYear)}/terms?page=${termPage}&pageSize=100`,
    !!selectedYear,
  )
  const classes = useSchoolData<Paged<SchoolClass>>(
    schoolId,
    `/classes?page=${page}&pageSize=100`,
  )
  const action = useSchoolAction(schoolId)
  const preview = useSchoolAction(schoolId)
  const setYearField = (name: keyof typeof year, value: string) =>
    setYear((old) => ({ ...old, [name]: value }))
  const setTermField = (name: keyof typeof term, value: string) =>
    setTerm((old) => ({ ...old, [name]: value }))
  return (
    <div className="space-y-8">
      <SchoolHeading
        title="Build your school year"
        description="Set up CBSE or ICSE Classes 1–10, terms and sections. Academic structure belongs to this school; archiving preserves its records."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-5">
          <h2 className="text-xl font-bold">Academic years</h2>
          <QueryState
            pending={years.isPending}
            error={years.error}
            retry={() => void years.refetch()}
          >
            <Select
              label="Selected academic year"
              value={selectedYear}
              onChange={(event) => {
                setYearId(event.target.value)
                setTermPage(1)
              }}
            >
              <option value="">Select a year</option>
              {years.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.archivedAt ? ' (archived)' : ''}
                </option>
              ))}
            </Select>
            {years.data && (
              <Pagination
                page={yearPage}
                total={years.data.total}
                onChange={setYearPage}
              />
            )}
            {selectedYearRecord && (
              <Button
                variant="secondary"
                loading={action.isPending}
                onClick={() =>
                  action.mutate({
                    suffix: `/academic-years/${encodeURIComponent(selectedYear)}`,
                    method: 'PATCH',
                    body: { archived: !selectedYearRecord.archivedAt },
                  })
                }
              >
                {selectedYearRecord.archivedAt
                  ? 'Restore academic year'
                  : 'Archive academic year'}
              </Button>
            )}
            {years.data?.items.length === 0 && (
              <p>No school years yet. Create your first year below.</p>
            )}
          </QueryState>
          <form
            className="space-y-4 border-t pt-5"
            onSubmit={(event) => {
              event.preventDefault()
              action.mutate(
                { suffix: '/academic-years', body: year },
                {
                  onSuccess: () =>
                    setYear({ name: '', startDate: '', endDate: '' }),
                },
              )
            }}
          >
            <Input
              label="New academic year name"
              value={year.name}
              onChange={(event) => setYearField('name', event.target.value)}
              required
              maxLength={80}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Academic year start"
                type="date"
                value={year.startDate}
                onChange={(event) =>
                  setYearField('startDate', event.target.value)
                }
                required
              />
              <Input
                label="Academic year end"
                type="date"
                min={year.startDate}
                value={year.endDate}
                onChange={(event) =>
                  setYearField('endDate', event.target.value)
                }
                required
              />
            </div>
            <Button type="submit" loading={action.isPending}>
              Create academic year
            </Button>
          </form>
        </Card>
        <Card className="space-y-5">
          <h2 className="text-xl font-bold">Terms</h2>
          {selectedYear ? (
            <QueryState
              pending={terms.isPending}
              error={terms.error}
              retry={() => void terms.refetch()}
            >
              <ul className="space-y-2">
                {terms.data?.items.map((item) => (
                  <li key={item.id} className="rounded-xl border p-3">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.startDate.slice(0, 10)} –{' '}
                      {item.endDate.slice(0, 10)}
                    </p>
                  </li>
                ))}
              </ul>
              {terms.data?.items.length === 0 && <p>No terms in this year.</p>}
              {terms.data && (
                <Pagination
                  page={termPage}
                  total={terms.data.total}
                  onChange={setTermPage}
                />
              )}
            </QueryState>
          ) : (
            <p>Create an academic year before adding terms.</p>
          )}
          <form
            className="space-y-4 border-t pt-5"
            onSubmit={(event) => {
              event.preventDefault()
              action.mutate(
                {
                  suffix: `/academic-years/${encodeURIComponent(selectedYear)}/terms`,
                  body: term,
                },
                {
                  onSuccess: () =>
                    setTerm({ name: '', startDate: '', endDate: '' }),
                },
              )
            }}
          >
            <Input
              label="Term name"
              value={term.name}
              onChange={(event) => setTermField('name', event.target.value)}
              required
              maxLength={80}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Term start"
                type="date"
                value={term.startDate}
                onChange={(event) =>
                  setTermField('startDate', event.target.value)
                }
                required
              />
              <Input
                label="Term end"
                type="date"
                min={term.startDate}
                value={term.endDate}
                onChange={(event) =>
                  setTermField('endDate', event.target.value)
                }
                required
              />
            </div>
            <Button
              type="submit"
              loading={action.isPending}
              disabled={!selectedYear || !!selectedYearRecord?.archivedAt}
            >
              Add term
            </Button>
          </form>
        </Card>
      </div>
      <Card className="space-y-5">
        <h2 className="text-xl font-bold">Grades, sections and classes</h2>
        <form
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            action.mutate(
              {
                suffix: '/classes',
                body: {
                  academicYearId: selectedYear,
                  board: structure.board,
                  grade: Number(structure.grade),
                  section: structure.section,
                },
              },
              {
                onSuccess: () =>
                  setStructure((old) => ({ ...old, section: '' })),
              },
            )
          }}
        >
          <Select
            label="Curriculum board"
            value={structure.board}
            onChange={(event) =>
              setStructure((old) => ({ ...old, board: event.target.value }))
            }
          >
            <option>CBSE</option>
            <option>ICSE</option>
          </Select>
          <Select
            label="Grade"
            value={structure.grade}
            onChange={(event) =>
              setStructure((old) => ({ ...old, grade: event.target.value }))
            }
          >
            {Array.from({ length: 10 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                Class {index + 1}
              </option>
            ))}
          </Select>
          <Input
            label="Section"
            value={structure.section}
            onChange={(event) =>
              setStructure((old) => ({ ...old, section: event.target.value }))
            }
            required
            maxLength={30}
          />
          <Button
            type="submit"
            className="self-end"
            loading={action.isPending}
            disabled={!selectedYear || !!selectedYearRecord?.archivedAt}
          >
            Create class
          </Button>
        </form>
        <QueryState
          pending={classes.isPending}
          error={classes.error}
          retry={() => void classes.refetch()}
        >
          {classes.data?.items.length === 0 && (
            <EmptyState
              band="adults"
              title="No classes yet"
              description="Choose a year, board, grade and section to create a class."
            />
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {classes.data?.items.map((item) => (
              <div
                key={item.id}
                className="min-w-0 space-y-3 rounded-2xl border p-4"
              >
                <h3 className="break-words font-bold">{classLabel(item)}</h3>
                <p className="text-sm text-muted-foreground">
                  {years.data?.items.find(
                    (entry) => entry.id === item.academicYearId,
                  )?.name ?? 'Academic year'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="ds-button ds-button-secondary"
                    href={`/org/${encodeURIComponent(schoolId)}/students?classId=${encodeURIComponent(item.id)}&classPage=${page}`}
                  >
                    Class roster
                  </Link>
                  <Link
                    className="ds-button ds-button-ghost"
                    href={`/org/${encodeURIComponent(schoolId)}/staff?classId=${encodeURIComponent(item.id)}&classPage=${page}`}
                  >
                    Teaching assignments
                  </Link>
                  <Button
                    variant="ghost"
                    loading={action.isPending}
                    onClick={() =>
                      action.mutate({
                        suffix: `/classes/${encodeURIComponent(item.id)}`,
                        method: 'PATCH',
                        body: { archived: !item.archivedAt },
                      })
                    }
                  >
                    {item.archivedAt ? 'Restore class' : 'Archive class'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {classes.data && (
            <Pagination
              page={page}
              total={classes.data.total}
              onChange={setPage}
            />
          )}
        </QueryState>
      </Card>
      <Card className="space-y-5">
        <h2 className="text-xl font-bold">Promotion preview</h2>
        <p className="text-muted-foreground">
          Review the next class before changing rosters. This preview does not
          move students.
        </p>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            preview.mutate(
              {
                suffix: `/classes/${encodeURIComponent(sourceId)}/promotion-preview`,
                body: { targetClassId: targetId },
              },
              {
                onSuccess: (result) => setPromotion(result as PromotionPreview),
              },
            )
          }}
        >
          <Select
            label="Current class"
            value={sourceId}
            onChange={(event) => {
              setSourceId(event.target.value)
              setPromotion(undefined)
            }}
            required
          >
            <option value="">Choose a class</option>
            {classes.data?.items
              .filter((item) => !item.archivedAt)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {classLabel(item)}
                </option>
              ))}
          </Select>
          <Select
            label="Next class"
            value={targetId}
            onChange={(event) => {
              setTargetId(event.target.value)
              setPromotion(undefined)
            }}
            required
          >
            <option value="">Choose a class</option>
            {classes.data?.items
              .filter((item) => !item.archivedAt && item.id !== sourceId)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {classLabel(item)}
                </option>
              ))}
          </Select>
          <Button
            type="submit"
            loading={preview.isPending}
            disabled={!sourceId || !targetId}
          >
            Preview promotion
          </Button>
        </form>
        <ActionFeedback pending={preview.isPending} error={preview.error} />
        {promotion && (
          <div role="status" className="rounded-xl border p-4">
            <p>
              {promotion.total} active students in{' '}
              {classLabel(promotion.source)} can be reviewed for{' '}
              {classLabel(promotion.target)}.
            </p>
            <p className="text-sm text-muted-foreground">
              Preview only. No memberships or rosters were changed.
              {promotion.truncated
                ? ' The returned student list is truncated.'
                : ''}
            </p>
          </div>
        )}
      </Card>
      <ActionFeedback
        pending={action.isPending}
        error={action.error}
        success={action.isSuccess}
      />
    </div>
  )
}
