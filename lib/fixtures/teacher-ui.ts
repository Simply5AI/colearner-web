import type { TeacherMaterial, TeacherQuestion, TreeNode } from '@/lib/types/teacher'

export const mockMcqQuestion: TeacherQuestion = {
  id: 'q-mcq-1',
  planId: 'plan-1',
  topicId: 'topic-1',
  type: 'MCQ',
  status: 'PUBLISHED',
  prompt: 'Which sorting algorithm has O(n log n) average time complexity?',
  options: [
    { id: 'a', label: 'Bubble Sort' },
    { id: 'b', label: 'Merge Sort' },
    { id: 'c', label: 'Selection Sort' },
    { id: 'd', label: 'Insertion Sort' },
  ],
  correctAnswer: { optionId: 'b' },
  explanation:
    'Merge Sort consistently achieves O(n log n) time complexity in average and worst cases through divide-and-conquer.',
}

export const mockMultiSelectQuestion: TeacherQuestion = {
  id: 'q-ms-1',
  planId: 'plan-1',
  topicId: 'topic-1',
  type: 'MULTI_SELECT',
  status: 'PUBLISHED',
  prompt: 'Select all valid HTTP methods (RFC 7231):',
  options: [
    { id: 'get', label: 'GET' },
    { id: 'post', label: 'POST' },
    { id: 'fetch', label: 'FETCH' },
    { id: 'delete', label: 'DELETE' },
  ],
  correctAnswer: { optionIds: ['get', 'post', 'delete'] },
  explanation: 'FETCH is not a standard HTTP method. GET, POST, and DELETE are defined in RFC 7231.',
}

export const mockTrueFalseQuestion: TeacherQuestion = {
  id: 'q-tf-1',
  planId: 'plan-1',
  topicId: 'topic-1',
  type: 'TRUE_FALSE',
  status: 'PUBLISHED',
  prompt: 'TCP guarantees ordered delivery of packets.',
  correctAnswer: { value: true },
  explanation: 'TCP is a connection-oriented protocol that guarantees ordered, reliable delivery.',
}

export const mockShortAnswerQuestion: TeacherQuestion = {
  id: 'q-sa-1',
  planId: 'plan-1',
  topicId: 'topic-1',
  type: 'SHORT_ANSWER',
  status: 'PUBLISHED',
  prompt: 'What does DNS stand for?',
  correctAnswer: { accepted: ['Domain Name System', 'domain name system'], caseSensitive: false },
  explanation: 'DNS translates human-readable domain names into IP addresses.',
}

export const mockLongAnswerQuestion: TeacherQuestion = {
  id: 'q-la-1',
  planId: 'plan-1',
  topicId: 'topic-1',
  type: 'LONG_ANSWER',
  status: 'PUBLISHED',
  prompt: 'Explain the difference between symmetric and asymmetric encryption.',
  correctAnswer: {
    rubric: 'Should cover key usage, speed, and a real-world example.',
    keyPoints: ['same key vs key pair', 'speed trade-offs', 'TLS/HTTPS example'],
  },
  explanation:
    'Symmetric encryption uses one shared key for both encryption and decryption. Asymmetric encryption uses a public/private key pair.',
}

export const mockFillBlankQuestion: TeacherQuestion = {
  id: 'q-fb-1',
  planId: 'plan-1',
  topicId: 'topic-1',
  type: 'FILL_BLANK',
  status: 'PUBLISHED',
  prompt: 'The time complexity of binary search is O(____).',
  correctAnswer: { accepted: ['log n', 'O(log n)'], caseSensitive: false },
  explanation: 'Binary search halves the search space each step, yielding logarithmic complexity.',
}

export const mockCodeQuestion: TeacherQuestion = {
  id: 'q-code-1',
  planId: 'plan-1',
  topicId: 'topic-1',
  type: 'CODE',
  status: 'PUBLISHED',
  prompt: 'Write a function that returns the sum of two integers.',
  correctAnswer: {
    language: 'javascript',
    testCases: [
      { input: 'sum(2, 3)', expected: '5' },
      { input: 'sum(-1, 1)', expected: '0' },
    ],
  },
  explanation: 'A simple addition function handles positive and negative integers.',
}

export const mockQuestions: TeacherQuestion[] = [
  mockMcqQuestion,
  mockMultiSelectQuestion,
  mockTrueFalseQuestion,
  mockShortAnswerQuestion,
  mockLongAnswerQuestion,
  mockFillBlankQuestion,
  mockCodeQuestion,
]

export const mockRichTextContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Introduction to Recursion' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Recursion is when a function ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'calls itself' },
        { type: 'text', text: ' to solve smaller subproblems.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Base case stops recursion' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Recursive case reduces problem size' }] }],
        },
      ],
    },
  ],
}

export const mockMaterials: TeacherMaterial[] = [
  {
    id: 'mat-pdf-1',
    planId: 'plan-1',
    title: 'Algorithms Cheat Sheet',
    type: 'PDF',
    visibility: 'SUBSCRIBER',
    downloadable: true,
    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  },
  {
    id: 'mat-video-1',
    planId: 'plan-1',
    title: 'Merge Sort Walkthrough',
    type: 'VIDEO_LINK',
    visibility: 'PREVIEW',
    downloadable: false,
    url: 'https://www.youtube.com/embed/SortingVisualizer',
    externalUrl: 'https://www.youtube.com/watch?v=example',
  },
  {
    id: 'mat-link-1',
    planId: 'plan-1',
    title: 'Big-O Cheat Sheet',
    type: 'EXTERNAL_LINK',
    visibility: 'PREVIEW',
    downloadable: false,
    externalUrl: 'https://example.com/big-o',
    externalTitle: 'Big-O Complexity Chart',
    externalDescription: 'A visual reference for common algorithm complexities.',
    externalImageUrl: 'https://placehold.co/600x315',
  },
  {
    id: 'mat-rich-1',
    planId: 'plan-1',
    title: 'Recursion Notes',
    type: 'RICH_TEXT',
    visibility: 'SUBSCRIBER',
    downloadable: false,
    richTextContent: mockRichTextContent,
  },
  {
    id: 'mat-ext-1',
    planId: 'plan-1',
    title: 'Captured Article',
    type: 'EXTENSION_CAPTURE',
    visibility: 'SUBSCRIBER',
    downloadable: false,
    extensionContent:
      '## What is a Binary Tree?\n\nA binary tree is a hierarchical data structure where each node has at most two children.',
  },
]

export const mockTreeNodes: TreeNode[] = [
  {
    id: 'mod-1',
    kind: 'module',
    title: 'Fundamentals',
    children: [
      {
        id: 'topic-1',
        kind: 'topic',
        title: 'Sorting Algorithms',
        children: [
          { id: 'sub-1', kind: 'subtopic', title: 'Merge Sort' },
          { id: 'sub-2', kind: 'subtopic', title: 'Quick Sort' },
        ],
      },
      {
        id: 'topic-2',
        kind: 'topic',
        title: 'Search Algorithms',
        children: [{ id: 'sub-3', kind: 'subtopic', title: 'Binary Search' }],
      },
    ],
  },
  {
    id: 'mod-2',
    kind: 'module',
    title: 'Advanced Topics',
    children: [
      {
        id: 'topic-3',
        kind: 'topic',
        title: 'Graph Theory',
        children: [],
      },
    ],
  },
]