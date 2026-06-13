'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BookOpen, Plus, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlanStatusBadge } from '@/components/teacher/plans/plan-status-badge'
import type { PlanStatus, TeacherStudyPlanSummary } from '@/lib/types/teacher'

interface PlansListViewProps {
  initialPlans: TeacherStudyPlanSummary[]
}

export function PlansListView({ initialPlans }: PlansListViewProps) {
  const [plans, setPlans] = useState(initialPlans)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PlanStatus | 'ALL'>('ALL')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return plans.filter((plan) => {
      if (status !== 'ALL' && plan.status !== status) return false
      if (!query) return true
      return (
        plan.title.toLowerCase().includes(query) ||
        plan.description.toLowerCase().includes(query) ||
        plan.subjectTags.some((tag) => tag.toLowerCase().includes(query))
      )
    })
  }, [plans, search, status])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plans..."
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as PlanStatus | 'ALL')}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href="/teacher/plans/new">
            <Plus className="h-4 w-4" />
            New plan
          </Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/60" />
            <div>
              <p className="font-medium">No study plans yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first master plan to start adding modules and topics.
              </p>
            </div>
            <Button asChild>
              <Link href="/teacher/plans/new">Create study plan</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((plan) => (
            <Link key={plan.id} href={`/teacher/plans/${plan.id}`}>
              <Card className="h-full transition-colors hover:border-primary/30 hover:bg-muted/20">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-2 text-base">{plan.title}</CardTitle>
                    <PlanStatusBadge status={plan.status} />
                  </div>
                  <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    {plan.subjectTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>{plan.enrollmentCount} enrolled</span>
                    <span>{plan.topicCount} topics</span>
                  </div>
                  <p className="text-xs">
                    Updated {formatDistanceToNow(new Date(plan.updatedAt), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {plans.length} plans. Data is served from the local teacher
        dev store until TASK-12-B2 APIs ship.
      </p>
    </div>
  )
}