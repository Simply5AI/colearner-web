'use client'

import { Youtube, Globe, FileText, Mic, Video } from 'lucide-react'
import { CaptureRingCard } from './capture-ring-card'
import { YouTubeSource } from './sources/youtube-source'
import { WebSource } from './sources/web-source'
import { DocumentSource } from './sources/document-source'
import { AudioSource } from './sources/audio-source'
import { VideoSource } from './sources/video-source'

const sources = [
  {
    index: 0,
    label: 'Video lesson',
    name: 'YouTube',
    description: 'Paste a lecture, tutorial, or explainer video with captions.',
    icon: <Youtube className="h-[22px] w-[22px]" />,
    ringColor: '#DC2626',
    ringBg: 'bg-red-50',
    ringBorder: 'border-[#DC2626]',
    ringShadow: 'shadow-[0_0_0_3px_rgba(220,38,38,0.08)]',
    content: <YouTubeSource />,
  },
  {
    index: 1,
    label: 'Reading',
    name: 'Web Articles',
    description: 'Capture articles, docs, essays, and course pages.',
    icon: <Globe className="h-[22px] w-[22px]" />,
    ringColor: '#2563EB',
    ringBg: 'bg-blue-50',
    ringBorder: 'border-[#2563EB]',
    ringShadow: 'shadow-[0_0_0_3px_rgba(37,99,235,0.08)]',
    content: <WebSource />,
  },
  {
    index: 2,
    label: 'Document',
    name: 'Local Docs',
    description: 'Upload notes, handouts, PDFs, assignments, or syllabi.',
    icon: <FileText className="h-[22px] w-[22px]" />,
    ringColor: '#7C3AED',
    ringBg: 'bg-violet-50',
    ringBorder: 'border-[#7C3AED]',
    ringShadow: 'shadow-[0_0_0_3px_rgba(124,58,237,0.08)]',
    content: <DocumentSource />,
  },
  {
    index: 3,
    label: 'Audio lesson',
    name: 'Audio & Podcasts',
    description: 'Upload a lecture recording, podcast, or spoken notes.',
    icon: <Mic className="h-[22px] w-[22px]" />,
    ringColor: '#059669',
    ringBg: 'bg-emerald-50',
    ringBorder: 'border-[#059669]',
    ringShadow: 'shadow-[0_0_0_3px_rgba(5,150,105,0.08)]',
    content: <AudioSource />,
  },
  {
    index: 4,
    label: 'Video file',
    name: 'Local Video',
    description: 'Upload class recordings, demos, or screen recordings.',
    icon: <Video className="h-[22px] w-[22px]" />,
    ringColor: '#D97706',
    ringBg: 'bg-amber-50',
    ringBorder: 'border-[#D97706]',
    ringShadow: 'shadow-[0_0_0_3px_rgba(217,119,6,0.08)]',
    content: <VideoSource />,
  },
]

export function CaptureSourceAccordion() {
  return (
    <div className="flex flex-col gap-2.5">
      {sources.map((s) => (
        <CaptureRingCard
          key={s.index}
          index={s.index}
          label={s.label}
          name={s.name}
          description={s.description}
          icon={s.icon}
          ringColor={s.ringColor}
          ringBg={s.ringBg}
          ringBorder={s.ringBorder}
          ringShadow={s.ringShadow}
        >
          {s.content}
        </CaptureRingCard>
      ))}
    </div>
  )
}
