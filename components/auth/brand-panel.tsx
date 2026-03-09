import { Download, Brain, TrendingUp } from 'lucide-react'

const features = [
  {
    icon: Download,
    title: 'Ambient Capture',
    description: 'Learn from videos, articles, and docs without effort',
    bgClass: 'bg-brand-teal/15',
    textClass: 'text-brand-teal',
  },
  {
    icon: Brain,
    title: 'Smart Recall',
    description: 'AI-generated questions with spaced repetition',
    bgClass: 'bg-brand-blue/15',
    textClass: 'text-brand-blue',
  },
  {
    icon: TrendingUp,
    title: '3 Sources of Mastery',
    description: 'Progress from Beginner to Advanced with real metrics',
    bgClass: 'bg-brand-purple/15',
    textClass: 'text-brand-purple',
  },
]

export function BrandPanel() {
  return (
    <aside className="hidden lg:flex relative overflow-hidden flex-col items-center justify-center bg-gradient-to-br from-[#1C1410] via-[#0F0D0B] to-[#1A120E]">
      {/* Animated pulsing rings */}
      <div className="absolute top-1/2 left-1/2 w-[240px] h-[240px] rounded-full border border-brand-orange/12 animate-pulse-ring-1" />
      <div className="absolute top-1/2 left-1/2 w-[380px] h-[380px] rounded-full border border-brand-orange/8 animate-pulse-ring-2" />
      <div className="absolute top-1/2 left-1/2 w-[520px] h-[520px] rounded-full border border-brand-orange/8 animate-pulse-ring-3" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-[360px] px-12">
        {/* Logo mark */}
        <div className="animate-float mb-5">
          <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-brand-orange to-brand-orange-hover flex items-center justify-center shadow-[0_8px_24px_rgba(196,98,26,0.3)]">
            <span className="text-[28px] font-black text-white tracking-tight">CL</span>
          </div>
        </div>

        {/* Wordmark */}
        <h1 className="text-[32px] font-black text-white tracking-tight mb-1.5">
          Co<span className="text-brand-orange-hover">Learner</span>
        </h1>
        <p className="text-sm font-medium text-white/40 mb-10">
          Learn ambient. Recall on demand.
        </p>

        {/* Feature bullets */}
        <div className="w-full text-left space-y-0">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3.5 py-3.5 border-t border-white/[0.04] first:border-t-0"
            >
              <div
                className={`w-9 h-9 rounded-[10px] flex-shrink-0 flex items-center justify-center ${feature.bgClass}`}
              >
                <feature.icon className={`size-4 ${feature.textClass}`} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-white/85">
                  {feature.title}
                </div>
                <div className="text-[11px] text-white/35 mt-0.5">
                  {feature.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
