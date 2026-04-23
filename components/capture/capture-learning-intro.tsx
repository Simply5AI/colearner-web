import { Brain, FileInput, ListChecks, RotateCcw } from 'lucide-react'

const steps = [
  {
    label: 'Add material',
    description: 'Paste a link or upload a file.',
    icon: FileInput,
  },
  {
    label: 'Find concepts',
    description: 'We identify the ideas worth learning.',
    icon: Brain,
  },
  {
    label: 'Practice',
    description: 'Recall questions are prepared when you start.',
    icon: ListChecks,
  },
  {
    label: 'Review',
    description: 'Weak spots return at the right time.',
    icon: RotateCcw,
  },
]

export function CaptureLearningIntro() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Learning set builder
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">
            Turn any source into a study-ready learning set
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Add a video, article, document, or recording. CoLearner extracts the key ideas, links them to your study plan, and gets them ready for recall.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:w-[560px] xl:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className="rounded-xl border border-border/80 bg-background/40 p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-3.5 w-3.5" />
                </div>
                <span className="font-mono text-[10px] font-bold text-muted-foreground">
                  {index + 1}
                </span>
              </div>
              <p className="text-xs font-bold text-foreground">{step.label}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
