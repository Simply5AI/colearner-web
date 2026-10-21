import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { MaterialBrowserHarness } from '@/components/materials/material-browser-harness'

/** Local visual qualification only; no fake API or learner record exists in production. */
export default function MaterialDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><MaterialBrowserHarness /></Suspense>
}
