import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function TeacherPlansPage() {
  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study plans</h1>
          <p className="text-sm text-muted-foreground">
            Author and publish master study plans for your students.
          </p>
        </div>
        <Button disabled>New plan</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming in W2</CardTitle>
          <CardDescription>
            Plan list, editor, and tree authoring depend on TASK-12-B2 study plan APIs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dev/ui">Preview shared UI primitives</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}