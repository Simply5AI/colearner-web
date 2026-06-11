import { create } from 'zustand'

interface LocalConfig {
  baseUrl: string
  pass1Model: string
  pass2Model: string
}

interface LocalProgress {
  phase: 'transcript' | 'document-extract' | 'article-fetch' | 'chunking' | 'pass1' | 'ranking' | 'pass2' | 'saving'
  current: number
  total: number
  detail?: string
}

const LOCAL_CONFIG_KEY = 'colearner:ollama-config'
const PROCESSING_MODE_KEY = 'colearner:processing-mode'

type ProcessingMode = 'cloud' | 'local'

function loadLocalConfig(): LocalConfig {
  if (typeof window === 'undefined') {
    return { baseUrl: 'http://localhost:11434', pass1Model: '', pass2Model: '' }
  }
  try {
    const stored = localStorage.getItem(LOCAL_CONFIG_KEY)
    if (stored) return JSON.parse(stored) as LocalConfig
  } catch {}
  return { baseUrl: 'http://localhost:11434', pass1Model: '', pass2Model: '' }
}

function saveLocalConfig(config: LocalConfig) {
  try {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config))
  } catch {}
}

function loadProcessingMode(): ProcessingMode {
  if (typeof window === 'undefined') return 'cloud'
  const stored = localStorage.getItem(PROCESSING_MODE_KEY)
  return stored === 'local' ? 'local' : 'cloud'
}

interface CaptureState {
  expandedSource: number | null
  activeAudioTab: 'upload' | 'record'
  isRecording: boolean
  recordingDuration: number
  selectedFile: File | null
  selectedFiles: {
    document: File | null
    audio: File | null
    video: File | null
  }
  extractionId: string | null

  selectedRoadmapId: string | null
  selectedSubjectId: string | null

  processingMode: ProcessingMode
  ollamaStatus: 'unchecked' | 'checking' | 'available' | 'unavailable'
  ollamaModels: string[]
  localConfig: LocalConfig
  localProgress: LocalProgress | null
  localError: string | null

  setExpandedSource: (index: number | null) => void
  toggleSource: (index: number) => void
  setActiveAudioTab: (tab: 'upload' | 'record') => void
  setRecording: (recording: boolean) => void
  setRecordingDuration: (seconds: number) => void
  setSelectedFile: (file: File | null) => void
  setSourceFile: (source: keyof CaptureState['selectedFiles'], file: File | null) => void
  setExtractionId: (id: string | null) => void
  setSelectedRoadmapId: (id: string | null) => void
  setSelectedSubjectId: (id: string | null) => void
  setProcessingMode: (mode: ProcessingMode) => void
  setOllamaStatus: (status: CaptureState['ollamaStatus']) => void
  setOllamaModels: (models: string[]) => void
  setLocalConfig: (config: Partial<LocalConfig>) => void
  setLocalProgress: (progress: LocalProgress | null) => void
  setLocalError: (error: string | null) => void
  hydrateFromProfile: (settings: {
    processingMode?: ProcessingMode
    ollamaBaseUrl?: string
    ollamaPass1Model?: string | null
    ollamaPass2Model?: string | null
  }) => void
  reset: () => void
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  expandedSource: null,
  activeAudioTab: 'upload',
  isRecording: false,
  recordingDuration: 0,
  selectedFile: null,
  selectedFiles: {
    document: null,
    audio: null,
    video: null,
  },
  extractionId: null,
  selectedRoadmapId: null,
  selectedSubjectId: null,
  processingMode: loadProcessingMode(),
  ollamaStatus: 'unchecked',
  ollamaModels: [],
  localConfig: loadLocalConfig(),
  localProgress: null,
  localError: null,

  setExpandedSource: (index) => set({ expandedSource: index }),
  toggleSource: (index) =>
    set({ expandedSource: get().expandedSource === index ? null : index }),
  setActiveAudioTab: (tab) => set({ activeAudioTab: tab }),
  setRecording: (recording) => set({ isRecording: recording }),
  setRecordingDuration: (seconds) => set({ recordingDuration: seconds }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setSourceFile: (source, file) =>
    set((state) => ({
      selectedFiles: { ...state.selectedFiles, [source]: file },
      selectedFile: file,
    })),
  setExtractionId: (id) => set({ extractionId: id }),
  setSelectedRoadmapId: (id) => set({ selectedRoadmapId: id }),
  setSelectedSubjectId: (id) => set({ selectedSubjectId: id }),
  setProcessingMode: (mode) => {
    try { localStorage.setItem(PROCESSING_MODE_KEY, mode) } catch {}
    set({ processingMode: mode })
  },
  setOllamaStatus: (status) => set({ ollamaStatus: status }),
  setOllamaModels: (models) => set({ ollamaModels: models }),
  setLocalConfig: (partial) => {
    const updated = { ...get().localConfig, ...partial }
    saveLocalConfig(updated)
    set({ localConfig: updated })
  },
  setLocalProgress: (progress) => set({ localProgress: progress }),
  setLocalError: (error) => set({ localError: error }),
  hydrateFromProfile: (settings) => {
    const mode: ProcessingMode = settings.processingMode === 'local' ? 'local' : 'cloud'
    const config: Partial<LocalConfig> = {}
    if (settings.ollamaBaseUrl) config.baseUrl = settings.ollamaBaseUrl
    if (settings.ollamaPass1Model) config.pass1Model = settings.ollamaPass1Model
    if (settings.ollamaPass2Model) config.pass2Model = settings.ollamaPass2Model

    try { localStorage.setItem(PROCESSING_MODE_KEY, mode) } catch {}
    const updated = { ...get().localConfig, ...config }
    saveLocalConfig(updated)

    set({ processingMode: mode, localConfig: updated })
  },
  reset: () =>
    set({
      expandedSource: null,
      activeAudioTab: 'upload',
      isRecording: false,
      recordingDuration: 0,
      selectedFile: null,
      selectedFiles: {
        document: null,
        audio: null,
        video: null,
      },
      extractionId: null,
      selectedRoadmapId: null,
      selectedSubjectId: null,
      localProgress: null,
      localError: null,
    }),
}))
