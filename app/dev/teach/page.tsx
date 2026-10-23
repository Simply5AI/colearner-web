import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { B11Harness } from '@/components/teach-back/dev/b11-harness'
export default function TeachDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><B11Harness kind="teach" /></Suspense>
}
