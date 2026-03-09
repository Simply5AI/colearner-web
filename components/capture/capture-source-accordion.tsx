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
    label: 'Source 0',
    name: 'YouTube',
    description: 'Paste a YouTube URL to extract concepts from video transcripts',
    icon: <Youtube className="h-[22px] w-[22px]" />,
    ringColor: '#DC2626',
    ringBg: 'bg-red-50',
    ringBorder: 'border-[#DC2626]',
    ringShadow: 'shadow-[0_0_0_3px_rgba(220,38,38,0.08)]',
    content: <YouTubeSource />,
  },
  {
    index: 1,
    label: 'Source 1',
    name: 'Web Articles',
    description: 'Paste a URL or use the Chrome Extension for dwell-based capture',
    icon: <Globe className="h-[22px] w-[22px]" />,
    ringColor: '#2563EB',
    ringBg: 'bg-blue-50',
    ringBorder: 'border-[#2563EB]',
    ringShadow: 'shadow-[0_0_0_3px_rgba(37,99,235,0.08)]',
    content: <WebSource />,
  },
  {
    index: 2,
    label: 'Source 2',
    name: 'Local Docs',
    description: 'Upload PDF or Word documents to extract and learn from',
    icon: <FileText className="h-[22px] w-[22px]" />,
    ringColor: '#7C3AED',
    ringBg: 'bg-violet-50',
    ringBorder: 'border-[#7C3AED]',
    ringShadow: 'shadow-[0_0_0_3px_rgba(124,58,237,0.08)]',
    content: <DocumentSource />,
  },
  {
    index: 3,
    label: 'Source 3',
    name: 'Audio & Podcasts',
    description: 'Upload audio files or record live for speech-to-concept extraction',
    icon: <Mic className="h-[22px] w-[22px]" />,
    ringColor: '#059669',
    ringBg: 'bg-emerald-50',
    ringBorder: 'border-[#059669]',
    ringShadow: 'shadow-[0_0_0_3px_rgba(5,150,105,0.08)]',
    content: <AudioSource />,
  },
  {
    index: 4,
    label: 'Source 4',
    name: 'Local Video',
    description: 'Upload local video files — we extract the audio track and transcribe',
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
