/**
 * Teacher-role domain types (TASK-12).
 * Mirrors planned B2–B4 API contracts from colearner-platform.
 */

export type TeacherQuestionType =
  | 'MCQ'
  | 'MULTI_SELECT'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'LONG_ANSWER'
  | 'FILL_BLANK'
  | 'CODE'

export type TeacherQuestionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface TeacherQuestionOption {
  id: string
  label: string
}

export interface McqCorrectAnswer {
  optionId: string
}

export interface MultiSelectCorrectAnswer {
  optionIds: string[]
}

export interface TrueFalseCorrectAnswer {
  value: boolean
}

export interface TextCorrectAnswer {
  accepted: string[]
  caseSensitive: boolean
}

export interface LongAnswerCorrectAnswer {
  rubric: string
  keyPoints: string[]
}

export interface CodeTestCase {
  input: string
  expected: string
}

export interface CodeCorrectAnswer {
  language: string
  testCases: CodeTestCase[]
}

export type TeacherCorrectAnswer =
  | McqCorrectAnswer
  | MultiSelectCorrectAnswer
  | TrueFalseCorrectAnswer
  | TextCorrectAnswer
  | LongAnswerCorrectAnswer
  | CodeCorrectAnswer

export interface TeacherQuestion {
  id: string
  planId: string
  topicId: string
  type: TeacherQuestionType
  status: TeacherQuestionStatus
  prompt: string
  options?: TeacherQuestionOption[]
  correctAnswer: TeacherCorrectAnswer
  explanation: string
  referenceMaterialIds?: string[]
  aiGenerated?: boolean
}

export type TeacherAnswerValue =
  | { type: 'MCQ'; optionId: string }
  | { type: 'MULTI_SELECT'; optionIds: string[] }
  | { type: 'TRUE_FALSE'; value: boolean }
  | { type: 'SHORT_ANSWER'; text: string }
  | { type: 'LONG_ANSWER'; text: string }
  | { type: 'FILL_BLANK'; text: string }
  | { type: 'CODE'; code: string }

export type MaterialType =
  | 'PDF'
  | 'VIDEO_UPLOAD'
  | 'VIDEO_LINK'
  | 'EXTERNAL_LINK'
  | 'RICH_TEXT'
  | 'EXTENSION_CAPTURE'

export type MaterialVisibility = 'PREVIEW' | 'SUBSCRIBER'

export interface TeacherMaterial {
  id: string
  planId: string
  topicId?: string
  title: string
  type: MaterialType
  visibility: MaterialVisibility
  downloadable: boolean
  url?: string
  contentUrl?: string
  richTextContent?: Record<string, unknown>
  externalUrl?: string
  externalTitle?: string
  externalDescription?: string
  externalImageUrl?: string
  extensionContent?: string
  mimeType?: string
}

export type TreeNodeKind = 'module' | 'topic' | 'subtopic'

export interface TreeNode {
  id: string
  kind: TreeNodeKind
  title: string
  description?: string
  children?: TreeNode[]
}

export type MasteryLevel = 'new' | 'learning' | 'review' | 'mastered' | 'excel'

export interface UploadProgress {
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  error?: string
}

export interface CompletedUpload {
  fileName: string
  material: Pick<TeacherMaterial, 'id' | 'title' | 'type' | 'url' | 'contentUrl'>
}