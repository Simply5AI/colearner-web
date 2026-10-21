'use client'

import type { Draft } from './answers'
import { ChoiceQuestion, MultiSelectQuestion } from './choice-question'
import { ClozeQuestionView } from './cloze-question'
import { MatchingQuestionView } from './matching-question'
import { OrderingQuestionView } from './ordering-question'
import type { QuestionProps } from './question-shared'
import { ShortAnswerQuestionView } from './short-answer-question'
import type { QuestionView } from '../session/practice-types'

/**
 * Chooses the renderer for the item's kind. The server only serves the seven kinds below; CODE and VOICE are never served,
 * so nothing renders for them and no microphone control exists. An unknown kind renders nothing rather than guessing.
 */
export function QuestionRenderer(props: QuestionProps<QuestionView, Draft>) {
  const { question } = props
  // The props are generic over the question; each branch narrows the question and keeps the draft, which every renderer re-checks by kind.
  switch (question.kind) {
    case 'MCQ': case 'TRUE_FALSE': return <ChoiceQuestion {...props} question={question} />
    case 'MULTI_SELECT': return <MultiSelectQuestion {...props} question={question} />
    case 'CLOZE': return <ClozeQuestionView {...props} question={question} />
    case 'MATCHING': return <MatchingQuestionView {...props} question={question} />
    case 'ORDERING': return <OrderingQuestionView {...props} question={question} />
    case 'SHORT_ANSWER': return <ShortAnswerQuestionView {...props} question={question} />
    default: return null
  }
}
