'use client'
import { Button, ErrorState } from '@/components/design-system'
export default function LearningError({ reset }: { reset: () => void }) { return <ErrorState title="This learning page could not open" description="Your saved imports are kept in your library. Try opening the page again." action={<Button onClick={reset}>Try again</Button>} /> }
