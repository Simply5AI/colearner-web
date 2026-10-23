import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { B11Harness } from '@/components/teach-back/dev/b11-harness'
export default function ProgressDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><B11Harness kind="progress" /></Suspense>
}
