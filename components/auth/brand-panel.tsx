import { Download, Clock, BarChart3 } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Download,
    title: 'Capture',
    description: 'Import videos, articles, and docs — AI extracts the key concepts for you',
  },
  {
    number: '02',
    icon: Clock,
    title: 'Practice',
    description: 'AI-generated recall questions adapt to your pace with spaced repetition',
  },
  {
    number: '03',
    icon: BarChart3,
    title: 'Master',
    description: 'Track real progress across topics and reach mastery with proven metrics',
  },
]

export function BrandPanel() {
  return (
    <aside className="hidden lg:flex relative overflow-hidden flex-col items-center justify-center bg-gradient-to-br from-[#1C1410] via-[#0F0D0B] to-[#1A120E]">
      {/* Subtle background glow */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-brand-orange/[0.04] blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center max-w-[380px] px-10">
        {/* Logo mark */}
        <div className="animate-float mb-5">
          <div className="w-[64px] h-[64px] rounded-2xl bg-gradient-to-br from-brand-orange to-brand-orange-hover flex items-center justify-center shadow-[0_8px_24px_rgba(196,98,26,0.3)]">
            <span className="text-[24px] font-black text-white tracking-tight">CL</span>
          </div>
        </div>

        {/* Wordmark */}
        <h1 className="text-[28px] font-black text-white tracking-tight mb-1">
          Co<span className="text-brand-orange-hover">Learner</span>
        </h1>
        <p className="text-[13px] font-medium text-white/40 mb-12">
          Learn ambient. Recall on demand.
        </p>

        {/* Journey steps */}
        <div className="w-full relative">
          {/* Connecting line */}
          <div className="absolute left-[19px] top-10 bottom-10 w-px bg-white/15" />

          <div className="space-y-5">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.number} className="relative flex gap-4">
                  {/* Step dot */}
                  <div className="relative z-10 flex-shrink-0 mt-1">
                    <div className="w-[38px] h-[38px] rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                      <Icon className="size-4 text-white" />
                    </div>
                  </div>

                  {/* Step content card */}
                  <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold tracking-widest text-white/50">
                        STEP {step.number}
                      </span>
                    </div>
                    <div className="text-[14px] font-bold text-white/90 mb-1">
                      {step.title}
                    </div>
                    <div className="text-[11.5px] leading-relaxed text-white/35">
                      {step.description}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}
