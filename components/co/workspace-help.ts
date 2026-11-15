import type { CoContextRef } from './co-types'
import { buildTutorHref, type TutorContextDescriptor } from '@/lib/tutor-loop/open-tutor'

export interface ScreenHelp {
  title: string
  message: string
  actions: Array<{ label: string; href: string }>
}

const library = { label: 'Open library', href: '/learn/library' }
const practice = { label: 'Practise', href: '/learn/practice' }
const learn = { label: 'Open learning plans', href: '/learn' }
const add = { label: 'Add material', href: '/learn/import' }
const progress = { label: 'See my progress', href: '/learn/progress' }
const today = { label: 'Open Today', href: '/learn/today' }
const fullTutor = { label: 'Open Ask Co', href: '/learn/co' }

/** Only known route shapes become legacy chat context. Query strings, personal details and page text are never captured. */
export function workspaceCoContext(pathname: string): CoContextRef | null {
  const match = /^\/learn\/(library|lesson)\/([a-zA-Z0-9_-]{1,128})$/.exec(pathname)
  if (!match || match[2] === 'new') return null
  return match[1] === 'lesson'
    ? { kind: 'LESSON', lessonId: match[2]!, stepIndex: null }
    : { kind: 'MATERIAL', materialId: match[2]! }
}

/** Resolves a closed Tutor Loop context descriptor from a known learner pathname. */
export function workspaceTutorContext(pathname: string): TutorContextDescriptor {
  const legacy = workspaceCoContext(pathname)
  if (legacy) {
    return legacy.kind === 'LESSON'
      ? { kind: 'LESSON', lessonId: legacy.lessonId }
      : { kind: 'MATERIAL', materialId: legacy.materialId }
  }
  const homeworkMatch = /^\/learn\/homework\/([a-zA-Z0-9_-]{1,128})$/.exec(pathname)
  if (homeworkMatch && homeworkMatch[1] !== 'new') {
    return { kind: 'HOMEWORK', homeworkSessionId: homeworkMatch[1]! }
  }
  const teachMatch = /^\/learn\/teach\/([a-zA-Z0-9_-]{1,128})$/.exec(pathname)
  if (teachMatch && teachMatch[1] !== 'new') {
    return { kind: 'TEACH_BACK', sessionId: teachMatch[1]! }
  }
  const mockResultMatch = /^\/learn\/practice\/mock\/([a-zA-Z0-9_-]{1,128})(?:\/result)?$/.exec(pathname)
  if (mockResultMatch) {
    return { kind: 'MOCK_RESULT', sessionId: mockResultMatch[1]! }
  }
  return { kind: 'GLOBAL' }
}

export function workspaceTutorHref(pathname: string): string {
  return buildTutorHref(workspaceTutorContext(pathname))
}

/** Built-in product guidance, kept distinct from AI replies about learning material. */
export function workspaceHelp(pathname: string): ScreenHelp {
  if (pathname === '/learn/import')
    return {
      title: 'Add learning material',
      message:
        'Choose a source, give it a title and pick a subject. Read it, wait until it is ready, then open the reader. Photos are read with local OCR, audio is transcribed, and YouTube links use available captions.',
      actions: [library, { label: 'Snap a page', href: '/learn/snap' }],
    }
  if (pathname === '/learn/snap')
    return {
      title: 'Snap a page',
      message:
        'Use a clear page with no people or personal details. When photo processing is available, you can capture, crop and order pages before sending. Review the pages before sending them to Co.',
      actions: [add, library],
    }
  if (pathname.startsWith('/learn/today'))
    return {
      title: 'Today and your schedule',
      message:
        'See your next suggested activity with its reason and time estimate, review your week schedule, or check your progress toward your goal.',
      actions: [fullTutor, practice],
    }
  if (pathname.startsWith('/learn/co'))
    return {
      title: 'Your AI tutor',
      message:
        'Browse your subjects, topics and past sessions on the left, pick a quick action, or ask a question grounded in your study materials.',
      actions: [today, library],
    }
  if (pathname.startsWith('/learn/library/'))
    return {
      title: 'Your material reader',
      message:
        'Read your source and its key ideas here. Ask Co about this material, create a lesson or start practice using the controls in the reader. Co can point back to the material it used.',
      actions: [library, practice],
    }
  if (pathname.startsWith('/learn/library'))
    return {
      title: 'Your library',
      message:
        'Your saved materials live here. Search or filter by subject, source or status. Open a ready item to read, create a lesson, practise or ask Co about it.',
      actions: [add, learn],
    }
  if (pathname.startsWith('/learn/lesson'))
    return {
      title: 'Your lesson',
      message:
        'Work through the lesson one step at a time. Use Next and Back, answer the check in your own words, and ask Co when something needs explaining. Your learning progress is saved as you go.',
      actions: [library, practice],
    }
  if (pathname.startsWith('/learn/practice'))
    return {
      title: 'Your practice',
      message:
        'Pick a ready practice set or a review that is due. Try each question yourself, then review the feedback. Questions you find difficult help you choose what to work on next.',
      actions: [library, progress],
    }
  if (pathname.startsWith('/learn/homework'))
    return {
      title: 'Homework help',
      message:
        'Type the problem and check that Co understood it. Work through the steps yourself and ask for a hint when you need one. Co guides your thinking; you supply your own final attempt.',
      actions: [library, practice],
    }
  if (pathname.startsWith('/learn/teach'))
    return {
      title: 'Teach it back',
      message:
        'Choose a ready material and explain the idea in your own words. Co checks your explanation against that source and suggests what to improve. You can revise your explanation and try again.',
      actions: [library, progress],
    }
  if (pathname.startsWith('/learn/notes'))
    return {
      title: 'My pages',
      message:
        'Keep your notes and saved explanations here. Use your own words to explain an idea, then return to the source or practise it to check what you remember.',
      actions: [library, practice],
    }
  if (pathname.startsWith('/learn/progress'))
    return {
      title: 'Your progress',
      message:
        'See what you have practised and completed. Use this to decide what to revisit. A suggestion from Co is guidance; your recorded answers and activity show what you have done.',
      actions: [practice, learn],
    }
  return {
    title: 'Your learning workspace',
    message:
      'Start with a learning plan, bring material to your library, or practise something you have learned. I can help you find your way here. Choose a ready material below to ask Co learning questions.',
    actions: [learn, library, practice],
  }
}

export function answerWorkspaceQuestion(text: string, pathname: string): ScreenHelp {
  if (/homework|hint/i.test(text)) return workspaceHelp('/learn/homework')
  if (/teach.?back|explain.*own|explanation/i.test(text)) return workspaceHelp('/learn/teach')
  if (/progress|score|result/i.test(text)) return workspaceHelp('/learn/progress')
  if (/practi[cs]e|quiz|review|test/i.test(text)) return workspaceHelp('/learn/practice')
  if (/photo|camera|snap/i.test(text)) return workspaceHelp('/learn/snap')
  if (/import|upload|audio|video|youtube|pdf|document|locked|unlock|sample/i.test(text))
    return workspaceHelp('/learn/import')
  if (/note|my pages/i.test(text)) return workspaceHelp('/learn/notes')
  if (/library|material|source/i.test(text)) return workspaceHelp('/learn/library')
  if (/lesson/i.test(text)) return workspaceHelp('/learn/lesson')
  if (/today|schedule|week/i.test(text)) return workspaceHelp('/learn/today')
  if (/tutor|ask co/i.test(text)) return workspaceHelp('/learn/co')
  return workspaceHelp(pathname)
}
