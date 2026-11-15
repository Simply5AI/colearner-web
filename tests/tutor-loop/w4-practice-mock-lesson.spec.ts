import { test } from '@playwright/test'

// Playwright path (stack with TUTOR_LOOP_USE_FIXTURES=true, Rohan): /learn/practice?goalId=…&topicId=… opens the topic sheet,
// Start questions, answer with "How sure are you?"; then /learn/practice?tab=exam, Choose a mock, Build, Start,
// answer and flag, Submit, read the result. Sara: Short lesson (4 cards), Lesson done, Practise. Not run in this pass.
test.skip('Practice, mock and short lesson journey against fixtures', async () => {})
