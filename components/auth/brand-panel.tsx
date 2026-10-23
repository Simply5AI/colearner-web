import Link from 'next/link'
import { BookOpen, Lightbulb, Sparkles, Star } from 'lucide-react'
import { BrandMark, CoCharacter } from '@/components/design-system'
import styles from './auth.module.css'

export function BrandPanel() {
  return <aside className={styles.brandPanel}>
    <Link href="/" className={styles.brandLink} aria-label="CoLearner home"><BrandMark /></Link>
    <div className={styles.brandContent}>
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.orbit} /><div className={styles.orbitInner} />
        <span className={styles.sceneSpark}><Sparkles size={26} /></span>
        <span className={styles.sceneStar}><Star size={22} /></span>
        <span className={styles.sceneBook}><BookOpen size={27} strokeWidth={1.7} /></span>
        <div className={styles.coStage}><CoCharacter band="kids" state="waving" size={230} decorative /></div>
        <span className={styles.helloBubble}>Hey, curious mind!</span>
        <span className={styles.ideaBubble}><Lightbulb size={18} />Every question is a good start.</span>
      </div>
      <div className={styles.brandCopy}><p className={styles.eyebrow}>YOUR CURIOSITY HAS A COMPANION</p><h2>Big wonders.<br /><span>Little steps.</span></h2><p>Ask a question. Try an idea. Make a discovery.<br />Co is here to help you work it out.</p></div>
      <div className={styles.journey} aria-label="Learning with Co"><span><i>1</i>Explore</span><span><i>2</i>Practice</span><span><i>3</i>Understand</span></div>
    </div>
    <p className={styles.brandFoot}>Made for students. Guided by families & teachers.</p>
  </aside>
}
