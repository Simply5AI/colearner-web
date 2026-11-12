'use client'

import { useRouter } from 'next/navigation'
import { CsvImportFlow, type ImportLocation } from './csv-import-flow'

/** Keeps the plan and import id in the URL so a reload or a shared tab resumes the same import. */
export function CsvImportScreen({ planId, importId }: { planId: string | null; importId: string | null }) {
  const router = useRouter()
  const onLocationChange = ({ planId: nextPlan, importId: nextImport }: ImportLocation) => {
    const query = new URLSearchParams()
    if (nextPlan) query.set('planId', nextPlan)
    if (nextImport) query.set('importId', nextImport)
    router.replace(`/teacher/questions/import${query.size ? `?${query.toString()}` : ''}`)
  }
  return <CsvImportFlow initialPlanId={planId} initialImportId={importId} onLocationChange={onLocationChange} />
}
