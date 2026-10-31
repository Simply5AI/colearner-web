import type { Metadata } from 'next'
import { MyPages } from '@/components/notes/my-pages'

export const metadata: Metadata = { title: 'My pages | CoLearner' }

/** DEMO-B. The learner's own notes, saved Co answers and analogies across all of their materials. */
export default function MyPagesRoute() {
  return <MyPages />
}
