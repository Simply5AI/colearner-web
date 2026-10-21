'use client'
import { Button, ErrorState } from '@/components/design-system'
export default function LessonError({ reset }: { reset: () => void }) { return <ErrorState title="This lesson could not open" description="Your place in the lesson is saved. Try opening it again." action={<Button onClick={reset}>Try again</Button>} /> }
