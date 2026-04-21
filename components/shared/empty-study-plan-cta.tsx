import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GraduationCap, Sparkles } from 'lucide-react'

type Variant = 'home' | 'progress' | 'achievements'

interface EmptyStudyPlanCtaProps {
  variant?: Variant
}

const copy: Record<Variant, { title: string; description: string }> = {
  home: {
    title: 'Start your first Study Plan',
    description:
      'Build a personalized learning path to track progress, earn badges, and master new topics.',
  },
  progress: {
    title: 'No progress to show yet',
    description:
      'Create a Study Plan first — then your mastery stats, pass rate, and concept ledger will appear here.',
  },
  achievements: {
    title: 'Unlock your first badge',
    description:
      'Study Plan badges unlock as you plan, capture, and learn. Start a plan to begin.',
  },
}

export function EmptyStudyPlanCta({ variant = 'home' }: EmptyStudyPlanCtaProps) {
  const c = copy[variant]
  return (
    <Card className="border-dashed bg-accent/20">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <GraduationCap className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">{c.title}</h3>
          <p className="max-w-md text-xs text-muted-foreground">{c.description}</p>
        </div>
        <Link href="/roadmaps" className="mt-1">
          <Button size="sm" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Create your first Study Plan
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
