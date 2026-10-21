'use client'
import { Button, ErrorState } from '@/components/design-system'
export default function HomeworkSessionError({ reset }: { reset: () => void }) { return <ErrorState title="This homework help could not open" description="Your work so far is saved. Try opening it again." action={<Button onClick={reset}>Try again</Button>} /> }
