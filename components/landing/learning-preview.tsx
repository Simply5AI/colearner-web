'use client'

import { useState } from 'react'
import { ArrowRight, BookOpen, Check, Leaf, MessageCircle, RotateCcw, Sparkles } from 'lucide-react'
import { CoAvatar, CoCharacter } from '@/components/design-system'
import styles from './landing.module.css'

const modes = ['Learn', 'Practice', 'Ask Co'] as const

/** Fixed public example: no learner data, account action, or model request. */
export function LearningPreview() {
  const [mode, setMode] = useState<(typeof modes)[number]>('Learn')
  const [answer, setAnswer] = useState<string | null>(null)
  const [showReply, setShowReply] = useState(false)
  return <div className={styles.previewStage}>
    <div className={styles.previewGreeting}>
      <CoCharacter state="waving" size={84} decorative />
      <div><span className={styles.eyebrow}>MEET YOUR STUDY COMPANION</span><p>A little help from Co.</p></div>
    </div>
    <section className={styles.preview} aria-label="Interactive learning example">
      <div className={styles.previewTop}><span><Leaf size={17} aria-hidden="true" />Science</span><span className={styles.sampleLabel}>Sample lesson</span></div>
      <div className={styles.previewTabs} role="group" aria-label="Explore the learning example">
        {modes.map((item, i) => <button key={item} type="button" aria-pressed={mode === item} aria-controls="learning-example-content" onClick={() => setMode(item)}><span aria-hidden="true">{i + 1}</span>{item}</button>)}
      </div>
      <div id="learning-example-content" className={styles.previewBody} aria-live="polite">
        {mode === 'Learn' && <>
          <p className={styles.lessonEyebrow}>ONE CONCEPT AT A TIME</p>
          <h3>How do plants make food?</h3>
          <p>Plants use sunlight, water and carbon dioxide to make their own food. This process is called <strong>photosynthesis.</strong></p>
          <div className={styles.coExplanation}><CoAvatar state="explaining" size={42} /><p>Think of a leaf as a tiny kitchen. Sunlight provides the energy to get cooking.</p></div>
          <p className={styles.exampleSource}><BookOpen size={15} aria-hidden="true" />Example topic: photosynthesis</p>
          <button type="button" className={styles.previewNext} onClick={() => setMode('Practice')}>Try a quick question <ArrowRight size={16} aria-hidden="true" /></button>
        </>}
        {mode === 'Practice' && <>
          <p className={styles.lessonEyebrow}>GIVE IT A GO</p><h3>What powers the process?</h3>
          <p>Where do plants get the energy they need for photosynthesis?</p>
          <div className={styles.answerOptions}>
            {['Sunlight', 'Soil'].map(option => <button key={option} type="button" aria-pressed={answer === option} onClick={() => setAnswer(option)}><span className={styles.optionIndicator}>{answer === option && <Check size={14} aria-hidden="true" />}</span>{option}</button>)}
          </div>
          {answer && <p className={styles.answerFeedback}>{answer === 'Sunlight' ? 'That’s it! Sunlight supplies the energy. Water and carbon dioxide are the ingredients.' : 'Soil supplies nutrients, but think about what a leaf captures during the day. Try again.'}</p>}
          <button type="button" className={styles.previewNext} onClick={() => setMode('Ask Co')}>Explore the idea with Co <ArrowRight size={16} aria-hidden="true" /></button>
        </>}
        {mode === 'Ask Co' && <>
          <p className={styles.lessonEyebrow}>MAKE ROOM FOR CURIOSITY</p><h3>A question is a good start.</h3>
          <p>Co helps you explore an idea before moving on. Try this example question.</p>
          <button type="button" className={styles.exampleQuestion} aria-expanded={showReply} onClick={() => setShowReply(!showReply)}><MessageCircle size={18} aria-hidden="true" />Why do plants need sunlight?</button>
          {showReply && <div className={styles.coExplanation}><CoAvatar state="explaining" size={42} /><p>Making food takes energy. Leaves capture light and use its energy to turn water and carbon dioxide into sugars.</p></div>}
          <button type="button" className={styles.previewNext} onClick={() => { setMode('Learn'); setAnswer(null); setShowReply(false) }}><RotateCcw size={15} aria-hidden="true" />Start the example again</button>
        </>}
      </div>
      <div className={styles.previewFoot}><Sparkles size={14} aria-hidden="true" />Interactive example · fixed content, no live AI</div>
    </section>
  </div>
}
