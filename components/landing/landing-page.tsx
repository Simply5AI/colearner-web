import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BookOpen, Check, ChevronDown, FileText, GraduationCap, Lightbulb, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import { BrandMark, CoCharacter, ThemeToggle } from '@/components/design-system'
import { AudienceTabs } from './audience-tabs'
import { LandingMotion } from './landing-motion'
import { AgePreviews } from './age-previews'
import { LearningPreview } from './learning-preview'
import { LearningStory, LearningToolkit } from './learning-world'
import styles from './landing.module.css'

const steps = [
  { title: 'Start with your material', icon: FileText, text: 'Bring your notes or a document, or open a lesson shared by your teacher.' },
  { title: 'Make the idea click', icon: Lightbulb, text: 'Learn one concept at a time, with clear explanations and room to ask Co a question.' },
  { title: 'Put it into practice', icon: BookOpen, text: 'Try a question, learn from the feedback, then explain the idea in your own words.' },
  { title: 'Know what comes next', icon: ArrowRight, text: 'Return to your reviews and use your progress to choose what to work on next.' },
]
const faq = [
  { question: 'Who is CoLearner for?', answer: 'CoLearner brings students, parents and teachers together around school learning. The initial curriculum focus is CBSE and ICSE Classes 1–10 in English, with experiences shaped for different ages.' },
  { question: 'How do I get started?', answer: 'If you already have access, log in with your CoLearner account. For school invitations, available lessons or account help, contact your school administrator. Feature availability depends on your school’s rollout.' },
  { question: 'Does Co just give students the answer?', answer: 'The learning experience is designed around explanations, hints, practice and teach-back. Co is an AI helper, so its responses can make mistakes. Students should check important information against their learning material and ask a teacher when unsure.' },
  { question: 'How do parents stay involved?', answer: 'Protected child learning uses guardian consent and school policies. Authorized parents can view full chats for children under 14; teen visibility uses summaries and safety alerts. Where school and family settings differ, the stricter setting applies. Available controls depend on the school rollout.' },
  { question: 'Can we use it on a phone or tablet?', answer: 'The web experience is designed for desktop, tablet and phone. Native mobile apps are a later part of the roadmap.' },
  { question: 'What about pricing and other languages?', answer: 'School pricing and commercial plans will follow product development. English comes first, with Hindi, senior classes and the ISC track planned for later.' },
]

export function PublicHeader() {
  return <header className={styles.header}><div className={styles.headerInner}>
    <Link href="/" className={styles.logoLink} aria-label="CoLearner home"><BrandMark /></Link>
    <nav aria-label="Public navigation" className={styles.navigation}><a href="/#how-it-works">How it works</a><a href="/#for-you">Made for you</a><a href="/#schools">For schools</a></nav>
    <div className={styles.headerActions}><ThemeToggle /><Link href="/login" className={styles.loginLink}>Log in <ArrowRight size={15} aria-hidden="true" /></Link></div>
  </div></header>
}
export function PublicFooter() {
  return <footer className={styles.footer}><div className={styles.footerInner}>
    <div><BrandMark /><p>Curiosity has a companion.</p></div>
    <nav aria-label="Footer"><a href="/#about-colearner">About</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></nav>
    <p lang="en">Made for learning, together.<br /><span>English · Hindi planned</span></p>
  </div></footer>
}
export function LandingPage() {
  return <div className={styles.page}>
    <a href="#main-content" className="sr-only z-50 rounded-lg bg-background p-3 focus:not-sr-only focus:absolute">Skip to content</a><PublicHeader />
    <main id="main-content"><LandingMotion>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.heroBadge}><span />A little curiosity goes a long way</p>
          <h1 id="hero-title">Less memorising.<br /><span>More understanding.</span></h1>
          <p className={styles.heroDescription}>Meet Co, your AI study companion. Turn school material into clear lessons, thoughtful questions and practice that helps you understand.</p>
          <div className={styles.actions}><Link href="/login" className={styles.primaryAction}>Continue learning <ArrowRight size={18} aria-hidden="true" /></Link><a href="#how-it-works" className={styles.secondaryAction}>See how it works <ChevronDown size={17} aria-hidden="true" /></a></div>
          <p className={styles.rolloutNote}>School rollout in progress. Features vary by school.</p>
          <div className={styles.heroProof}><span><BookOpen size={17} aria-hidden="true" />Your learning material</span><span><ShieldCheck size={17} aria-hidden="true" />Guided by school & family</span></div>
        </div>
        <LearningPreview />
      </section>
      <div className={styles.curriculumStrip}><p>Built around the school day.<br /><strong>Ready for the questions after it.</strong></p><div><span>CBSE & ICSE focus</span><span>Classes 1–10</span><span>Students, families & teachers</span></div></div>
      <LearningStory />
      <section data-reveal="visible" id="how-it-works" className={styles.section} aria-labelledby="loop-title">
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>FROM “I DON’T GET IT” TO “I’VE GOT THIS”</p><h2 id="loop-title">Small steps.<br />Real moments of understanding.</h2><p>A clear path through a topic, with Co beside you when you need a little help.</p></div>
        <div className={styles.steps}>{steps.map(({ title, icon: Icon, text }, i) => <article key={title}><div className={styles.stepTop}><span className={styles.iconTile}><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span><span className={styles.stepNumber}>0{i + 1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <LearningToolkit />
      <section data-reveal="visible" id="for-you" className={`${styles.section} ${styles.audienceSection}`} aria-labelledby="audience-title">
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>BETTER TOGETHER</p><h2 id="audience-title">One learning journey.<br />Everyone has a part.</h2><p>For the questions students ask, the care parents give, and the lessons teachers bring to life.</p></div>
        <AudienceTabs />
      </section>
      <section data-reveal="visible" className={`${styles.section} ${styles.ageSection}`} aria-labelledby="age-title">
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>ROOM TO GROW</p><h2 id="age-title">Same companion.<br />A different pace for every age.</h2><p>More guidance when they’re starting. More independence as they grow.</p></div>
        <AgePreviews />
      </section>
      <section data-reveal="visible" id="families" className={`${styles.section} ${styles.familySection}`} aria-labelledby="family-title">
        <figure className={styles.familyArtwork}><Image src="/images/home/family-discovery.webp" alt="A child explaining an idea about a plant to his mother as they learn together at home." width={1536} height={1024} sizes="(max-width: 760px) 100vw, 50vw" /><figcaption><CoCharacter state="encouraging" size={64} decorative /><p>A small question.<br /><strong>A conversation worth having.</strong></p></figcaption></figure>
        <div className={styles.familyIntro}><p className={styles.eyebrow}>FOR FAMILIES</p><h2 id="family-title">Their curiosity.<br />Your guiding hand.</h2><p>Give your child space to explore while staying involved in how they learn. Co supports the conversation between learners, parents and teachers.</p>
        <div className={styles.familyBenefits}>
          {[{ icon: ShieldCheck, title: 'You’re part of the learning journey', text: 'Guardian consent and school policies shape access to protected child learning.' }, { icon: MessageCircle, title: 'Visibility that grows with them', text: 'Age-aware chat visibility helps parents stay involved while giving teens more independence.' }, { icon: Lightbulb, title: 'Help that builds understanding', text: 'Explanations, hints and teach-back encourage learners to work through an idea, not just copy an answer.' }].map(({ icon: Icon, title, text }) => <article key={title}><span className={styles.iconTile}><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span><div><h3>{title}</h3><p>{text}</p></div></article>)}
        </div>
        <Link href="/privacy" className={styles.textLink}>Explore privacy & consent <ArrowRight size={17} aria-hidden="true" /></Link></div>
      </section>
      <section data-reveal="visible" id="schools" className={styles.schoolSection} aria-labelledby="school-title">
        <div><p className={styles.eyebrow}>FOR SCHOOLS</p><h2 id="school-title">Keep the whole<br />learning team connected.</h2><p>Give teacher-shared plans and lessons a place in every student’s learning journey, with parent approvals and a shared school workspace.</p><Link href="/contact" className={styles.schoolAction}>School access & support <ArrowRight size={18} aria-hidden="true" /></Link></div>
        <div className={styles.schoolRoles}>
          {[{ icon: GraduationCap, title: 'Students', text: 'A clear next step in their learning.' }, { icon: BookOpen, title: 'Teachers', text: 'Plans and lessons to share with their class.' }, { icon: Users, title: 'Parents', text: 'Approvals and visibility appropriate to their child.' }].map(({ icon: Icon, title, text }) => <div key={title}><Icon size={23} strokeWidth={1.6} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div><Check size={17} aria-hidden="true" /></div>)}
          <p className={styles.schoolNote}>Access and capabilities depend on your school’s rollout.</p>
        </div>
      </section>
      <section data-reveal="visible" className={`${styles.section} ${styles.faqSection}`} aria-labelledby="faq-title"><div className={styles.sectionHeading}><p className={styles.eyebrow}>GOOD QUESTIONS</p><h2 id="faq-title">A little more<br />before you begin.</h2><p>Here’s what to know about learning with Co.</p></div><div className={styles.faq}>{faq.map(item => <details key={item.question}><summary>{item.question}<ChevronDown size={18} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></section>
      <section data-reveal="visible" className={styles.closing} aria-labelledby="closing-title"><CoCharacter state="waving" size={88} decorative /><div><h2 id="closing-title">Bring your next question.</h2><p>There’s always a little more to discover.</p></div><Link href="/login" className={styles.primaryAction}>Learn with Co <ArrowRight size={18} aria-hidden="true" /></Link></section>
    </LandingMotion></main><PublicFooter />
  </div>
}
