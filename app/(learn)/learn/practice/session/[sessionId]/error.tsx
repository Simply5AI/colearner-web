'use client'
import { Button, ErrorState } from '@/components/design-system'
export default function PracticeSessionError({ reset }: { reset: () => void }) { return <ErrorState title="This practice could not open" description="Your answers so far are saved. Try opening it again." action={<Button onClick={reset}>Try again</Button>} /> }
