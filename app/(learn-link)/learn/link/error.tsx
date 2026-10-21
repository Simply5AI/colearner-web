'use client'
import { Button, ErrorState } from '@/components/design-system'
export default function LearnLinkError({ reset }: { reset: () => void }) { return <ErrorState title="This page could not open" description="Nothing has been changed. Try opening the page again." action={<Button onClick={reset}>Try again</Button>} /> }
