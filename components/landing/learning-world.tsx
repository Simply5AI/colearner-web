import Image from 'next/image'
import { ArrowRight, BookOpen, Check, FileText, Lightbulb, MessageCircle, RotateCcw, Sparkles } from 'lucide-react'
import { CoAvatar } from '@/components/design-system'
import styles from './learning-world.module.css'

export function LearningStory() {
  return <section data-reveal="visible" id="about-colearner" className={styles.story} aria-labelledby="story-title">
    <figure className={styles.storyArtwork}>
      <Image src="/images/home/student-discovery.webp" alt="A student exploring a science idea with her notebook, tablet and a plant at her study desk." width={1536} height={1024} sizes="(max-width: 760px) 100vw, 50vw" className={styles.storyImage} />
      <div className={styles.artworkTag}><Sparkles size={15} aria-hidden="true" />Room for a little wonder</div>
      <figcaption className={styles.artworkCaption}><span className={styles.captionIcon}><Lightbulb size={21} aria-hidden="true" /></span><div><span>THE LITTLE MOMENTS MATTER</span><p>“Wait… I can explain this now.”</p></div></figcaption>
    </figure>
    <div className={styles.storyCopy}>
      <p className={styles.eyebrow}>A LITTLE MORE ABOUT COLEARNER</p>
      <h2 id="story-title">The school day ends.<br /><span>The wondering doesn’t.</span></h2>
      <p>A question from class. A page that needs another read. That one idea that hasn’t quite clicked yet. CoLearner gives those moments a place to go.</p>
      <p>Bring what you’re learning and work through it with Co, your AI study companion. Explore a clearer explanation, try it for yourself, and find the words to explain it back.</p>
      <div className={styles.storyPrinciple}><span aria-hidden="true">↳</span><p>Built around your learning.<br /><strong>With space to find your own way.</strong></p></div>
      <a href="#inside-colearner" className={styles.textLink}>Take a little look inside <ArrowRight size={17} aria-hidden="true" /></a>
    </div>
  </section>
}

export function LearningToolkit() {
  return <section data-reveal="visible" id="inside-colearner" className={styles.toolkit} aria-labelledby="toolkit-title">
    <div className={styles.toolkitHeading}><div><p className={styles.eyebrow}>A STUDY SPACE THAT MAKES SENSE</p><h2 id="toolkit-title">More than a place to ask.<br />A place to put it all together.</h2></div><p>Your material, your questions, your next small step. Connected in one learning journey.</p></div>
    <div className={styles.toolkitGrid}>
      <article className={`${styles.toolCard} ${styles.materialCard}`}>
        <div className={styles.cardCopy}><span className={styles.cardLabel}><FileText size={16} aria-hidden="true" />START WITH WHAT YOU HAVE</span><h3>From a page of notes<br />to a path through a topic.</h3><p>Bring notes or a document, or open a teacher-shared lesson. Keep the material you’re studying at the heart of your next session.</p></div>
        <div className={styles.materialVisual} aria-label="Illustrative study space">
          <div className={styles.notebookBack} aria-hidden="true" />
          <div className={styles.notebook}>
            <div className={styles.notebookHeader}><span><BookOpen size={15} aria-hidden="true" />Your study space</span><span>Example</span></div>
            <span className={styles.subjectLabel}>SCIENCE · ONE CONCEPT AT A TIME</span><h4>Nutrition in plants</h4>
            <div className={styles.sourceRow}><span><FileText size={20} aria-hidden="true" /></span><div><strong>My class notes</strong><p>Your starting point</p></div><Check size={16} aria-hidden="true" /></div>
            <div className={styles.notebookStep}><span>01</span><p>Explore the idea</p><ArrowRight size={15} aria-hidden="true" /></div>
            <div className={styles.notebookStep}><span>02</span><p>Give it a go</p><ArrowRight size={15} aria-hidden="true" /></div>
            <div className={styles.notebookStep}><span>03</span><p>Explain it in your words</p><ArrowRight size={15} aria-hidden="true" /></div>
          </div>
        </div>
      </article>
      <article className={`${styles.toolCard} ${styles.questionCard}`}>
        <div className={styles.cardCopy}><span className={styles.cardLabel}><MessageCircle size={16} aria-hidden="true" />MAKE SPACE FOR “WHY?”</span><h3>Another question?<br />That’s a good thing.</h3><p>Ask for a simpler example or a hint. Co helps you work through the tricky part, one idea at a time.</p></div>
        <div className={styles.conversation} aria-label="Illustrative conversation with Co"><p>Can we try a simpler example?</p><div><CoAvatar size={38} state="explaining" /><p>Of course. Think of a leaf as a tiny kitchen…</p></div><span>Example conversation</span></div>
      </article>
      <article className={`${styles.toolCard} ${styles.reviewCard}`}>
        <div className={styles.cardCopy}><span className={styles.cardLabel}><RotateCcw size={16} aria-hidden="true" />MAKE IT YOUR OWN</span><h3>A little practice.<br />Then, a fresh perspective.</h3><p>Try questions, learn from feedback and explain an idea back to Co. Use your progress to choose what to revisit.</p></div>
        <div className={styles.reviewVisual} aria-label="Illustrative learning cycle"><span><BookOpen size={18} aria-hidden="true" />Learn</span><ArrowRight size={15} aria-hidden="true" /><span><Lightbulb size={18} aria-hidden="true" />Practice</span><ArrowRight size={15} aria-hidden="true" /><span><MessageCircle size={18} aria-hidden="true" />Explain</span></div>
      </article>
    </div>
    <p className={styles.exampleNote}>A glimpse of the experience. Examples are illustrative; features depend on your school’s rollout.</p>
  </section>
}
