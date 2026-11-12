'use client'

import { useMemo } from 'react'
import { useTeaching } from '@/components/teacher/teaching-context'
import { plansApi, type PlanTreeNode, type TeachingRequest } from '@/lib/api/teaching/plans'
import { questionImportsApi, uploadTeachingFile } from '@/lib/api/teaching/question-imports'
import { worksheetsApi } from '@/lib/api/teaching/worksheets'

/** Typed, Zod-parsing B13 clients (CSV import and worksheets) bound to the signed-in teacher's school. */
export function useB13Apis() {
  const { request, schoolId } = useTeaching()
  return useMemo(() => {
    const send = request as TeachingRequest
    return {
      schoolId,
      plans: plansApi(send),
      imports: questionImportsApi(send, (suffix, file) => uploadTeachingFile(schoolId, suffix, file)),
      worksheets: worksheetsApi(send),
    }
  }, [request, schoolId])
}

export interface PlanTopic { id: string; title: string; depth: number }
/** Topics and subtopics in plan order (phases are headings, not places a question lives). */
export function planTopics(tree: PlanTreeNode[], depth = 0): PlanTopic[] {
  return tree.flatMap(node => [
    ...(node.kind === 'module' ? [] : [{ id: node.id, title: node.title, depth }]),
    ...planTopics(node.children, depth + 1),
  ])
}
