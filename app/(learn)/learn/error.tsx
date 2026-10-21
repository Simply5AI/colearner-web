'use client'
import { Button, ErrorState } from '@/components/design-system'
export default function LearnError({ reset }: { reset: () => void }) { return <ErrorState title="This learning page could not open" description="Nothing you saved has been lost. Try opening the page again." action={<Button onClick={reset}>Try again</Button>} /> }
