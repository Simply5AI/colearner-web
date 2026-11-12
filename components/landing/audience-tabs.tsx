'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, BookOpen, Check, GraduationCap, HeartHandshake, Lightbulb, ListChecks, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import { CoAvatar } from '@/components/design-system'
import styles from './landing.module.css'

const audiences = [
  {
    id: 'students', label: 'Students', subtitle: 'Find your next lightbulb moment', icon: GraduationCap, eyebrow: 'YOUR QUESTIONS. YOUR NEXT DISCOVERY.',
    image: '/images/home/student-discovery.webp', imageAlt: 'A student in a casual sweatshirt exploring a science idea with her notebook and tablet at home.', imageCaption: 'A little curiosity. A clearer next step.',
    title: 'Find your “oh, now I get it.”', description: 'A place to work through the tricky bits, ask another question, and build understanding at your own pace.',
    features: [
      { icon: BookOpen, title: 'Start with what you’re studying', text: 'Bring your learning material or open a teacher-shared lesson. Keep the topic you’re working on at the centre.' },
      { icon: MessageCircle, title: 'Ask without feeling stuck', text: 'Get an explanation or a guiding hint from Co. Try the next step yourself, then come back with another question.' },
      { icon: Lightbulb, title: 'Make the idea your own', text: 'Practice, review and explain it back in your own words. Use your learning progress to decide what to revisit.' },
    ],
    scenario: 'A tricky concept, one small step at a time', steps: ['Open your class material', 'Explore an explanation with Co', 'Practice, then explain it back'],
    quote: '“Can we try that with a simpler example?”', response: 'Good question. Let’s break it into one small idea first.',
    action: 'Open your learning space', href: '/login',
  },
  {
    id: 'parents', label: 'Parents', subtitle: 'Stay close as they grow', icon: HeartHandshake, eyebrow: 'A LITTLE INDEPENDENCE. A GUIDING HAND.',
    image: '/images/home/family-discovery.webp', imageAlt: 'A mother in a cream sweater listening as her son explains a science idea at their kitchen table.', imageCaption: 'Their discovery. Your encouragement.',
    title: 'Be part of their lightbulb moments.', description: 'Support your child’s learning with a clear place for consent, approvals and the right level of involvement for their age.',
    features: [
      { icon: ShieldCheck, title: 'Help them get started', text: 'Use a school-issued child invitation to verify your relationship and give consent before protected child learning begins.' },
      { icon: ListChecks, title: 'Stay involved in learning choices', text: 'Review requests that need your approval. Family and school rules shape the experience, with the stricter setting taking priority.' },
      { icon: Users, title: 'Give them room to grow', text: 'Authorized parents can view full chats for children under 14. For teens, visibility uses summaries and safety alerts.' },
    ],
    scenario: 'From school invitation to supported learning', steps: ['Verify your relationship', 'Review consent and learning requests', 'Stay involved as they grow'],
    quote: '“How can I help without doing it for them?”', response: 'Try asking your child to explain one thing they understood today.',
    action: 'Explore family access', href: '/login?callbackUrl=/workspaces',
  },
  {
    id: 'teachers', label: 'Teachers', subtitle: 'Bring every lesson a little further', icon: BookOpen, eyebrow: 'YOUR TEACHING. MORE ROOM TO LEARN.',
    image: '/images/home/classroom-discovery.webp', imageAlt: 'A teacher in a modern classroom guiding two students through a science activity with a plant and notebook.', imageCaption: 'Your lesson. Their next discovery.',
    title: 'Keep the lesson going beyond class.', description: 'Bring plans, materials and guided learning together, so students have a clear next step when they open CoLearner.',
    features: [
      { icon: BookOpen, title: 'Build a clear learning path', text: 'Organize plans into topics, attach source material and prepare lessons around what your class is learning.' },
      { icon: Check, title: 'Review before you share', text: 'Check lesson drafts and questions, make your changes, then publish and assign through your school workspace.' },
      { icon: GraduationCap, title: 'See where support is needed', text: 'Use available class and learner progress to guide follow-up. Co’s suggestions stay separate from measured learning evidence.' },
    ],
    scenario: 'A lesson with a clear path after the bell', steps: ['Prepare topics and materials', 'Review and share with your class', 'Use progress to plan your next check-in'],
    quote: '“What should my students work on next?”', response: 'Start with their available learning evidence, then choose the next step.',
    action: 'Open your school workspace', href: '/login?callbackUrl=/workspaces',
  },
]

export function AudienceTabs() {
  const [selected, setSelected] = useState(0)
  const id = useId()
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const audience = audiences[selected]!
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    const rtl = event.currentTarget.closest('[dir="rtl"]') || document.documentElement.dir === 'rtl'
    if (event.key === 'ArrowRight') next = (index + (rtl ? 2 : 1)) % audiences.length
    else if (event.key === 'ArrowLeft') next = (index + (rtl ? 1 : 2)) % audiences.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = audiences.length - 1
    else return
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus()
  }
  return <div className={styles.audience}>
    <div role="tablist" aria-label="Explore CoLearner for your role" className={styles.audienceTabs}>
      {audiences.map(({ id: key, label, subtitle, icon: Icon }, index) => <button key={key} ref={element => { tabs.current[index] = element }} type="button" role="tab" aria-label={label} id={`${id}-${key}`} aria-controls={`${id}-panel-${key}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => onKeyDown(event, index)}><span className={styles.audienceTabIcon}><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span><span className={styles.audienceTabText}><strong>{label}</strong><span>{subtitle}</span></span><ArrowRight className={styles.audienceTabArrow} size={18} aria-hidden="true" /></button>)}
    </div>
    {audiences.map((item, index) => <div key={item.id} role="tabpanel" id={`${id}-panel-${item.id}`} aria-labelledby={`${id}-${item.id}`} hidden={selected !== index} tabIndex={0} data-audience={item.id} className={styles.audiencePanel}>
      {selected === index && <>
        <div className={styles.audienceDetails}><p className={styles.eyebrow}>{audience.eyebrow}</p><h3>{audience.title}</h3><p>{audience.description}</p>
          <div className={styles.audienceFeatures}>{audience.features.map(({ icon: Icon, title, text }) => <article key={title}><span className={styles.iconTile}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span><div><h4>{title}</h4><p>{text}</p></div></article>)}</div>
          <Link href={audience.href} className={styles.audienceAction}>{audience.action}<ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <div className={styles.audienceStory}>
          <figure className={styles.audienceArtwork}><Image key={audience.image} src={audience.image} alt={audience.imageAlt} width={1536} height={1024} sizes="(max-width: 760px) 100vw, 50vw" /><figcaption><audience.icon size={15} aria-hidden="true" />{audience.imageCaption}</figcaption></figure>
          <div className={styles.audienceStoryBody}><div className={styles.storyCo}><CoAvatar state="encouraging" size={42} /><div><p>{audience.quote}</p><span>{audience.response}</span></div></div><p className={styles.storyTop}>A LITTLE LOOK AT THE JOURNEY</p><h4>{audience.scenario}</h4><ol>{audience.steps.map((step, i) => <li key={step}><span>0{i + 1}</span>{step}</li>)}</ol><p className={styles.storyNote}>Features and access depend on your school’s rollout and permissions. Co is an AI helper and can make mistakes.</p></div>
        </div>
      </>}
    </div>)}
  </div>
}
