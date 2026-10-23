'use client'
import { Card, EmptyState } from '@/components/design-system'
import Link from 'next/link'
import { useState } from 'react'
import {
  type Paged,
  type OwnTeachingAssignment,
  classLabel,
} from '@/lib/api/school'
import {
  SchoolHeading,
  QueryState,
  Pagination,
  useSchoolData,
} from './school-common'
export function ClassroomScreen({ schoolId }: { schoolId: string }) {
  const [page, setPage] = useState(1)
  const assignments = useSchoolData<Paged<OwnTeachingAssignment>>(
    schoolId,
    `/my-teaching-assignments?page=${page}&pageSize=100`,
  )
  return (
    <div className="space-y-8">
      <SchoolHeading
        title="My school teaching assignments"
        description="These class and subject assignments are verified by your selected school membership. Plan and lesson authoring happens in your teacher workspace."
      />
      <div className="flex flex-wrap gap-3">
        <Link href="/teacher/dashboard" className="ds-pill font-semibold underline-offset-2 hover:underline">
          Open teacher dashboard
        </Link>
        <Link href="/teacher/plans" className="ds-pill font-semibold underline-offset-2 hover:underline">
          Open my plans
        </Link>
      </div>
      <QueryState
        pending={assignments.isPending}
        error={assignments.error}
        retry={() => void assignments.refetch()}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.data?.items.map((item) => (
            <Card key={item.id} className="space-y-3">
              <h2 className="break-words text-xl font-bold">{item.subject}</h2>
              <p>
                {item.classroom ? classLabel(item.classroom) : 'School class'}
              </p>
              <span className="ds-pill">Active teaching assignment</span>
            </Card>
          ))}
        </div>
        {assignments.data?.items.length === 0 && (
          <EmptyState
            band="adults"
            title="No assigned classes yet"
            description="Your school administrator can assign your teaching classes and subjects."
          />
        )}
        {assignments.data && (
          <Pagination
            page={page}
            total={assignments.data.total}
            onChange={setPage}
          />
        )}
      </QueryState>
    </div>
  )
}
