import { create } from 'zustand'
import type { BYOKProvider } from '@/lib/llm/types'

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
const BYOK_PROVIDER_KEY = 'colearner:byok-provider'
const BYOK_API_KEY_KEY = 'colearner:byok-api-key'
const BYOK_FAST_MODEL_KEY = 'colearner:byok-fast-model'
const BYOK_SMART_MODEL_KEY = 'colearner:byok-smart-model'

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

function loadProcessingMode(): 'cloud' | 'local' | 'byok' {
  if (typeof window === 'undefined') return 'cloud'
  return (localStorage.getItem(PROCESSING_MODE_KEY) as 'cloud' | 'local' | 'byok') || 'cloud'
}

function loadByokProvider(): BYOKProvider | null {
  if (typeof window === 'undefined') return null
  return (localStorage.getItem(BYOK_PROVIDER_KEY) as BYOKProvider) || null
}

function loadByokApiKey(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(BYOK_API_KEY_KEY) || null
}

function loadByokModel(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key) || null
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

  // Study plan (roadmap) selection — scopes captures to a plan
  selectedRoadmapId: string | null

  // Local Ollama processing
  processingMode: 'cloud' | 'local' | 'byok'
  ollamaStatus: 'unchecked' | 'checking' | 'available' | 'unavailable'
  ollamaModels: string[]
  localConfig: LocalConfig
  localProgress: LocalProgress | null
  localError: string | null

  // BYOK (Bring Your Own Key)
  byokProvider: BYOKProvider | null
  byokApiKey: string | null
  byokFastModel: string | null
  byokSmartModel: string | null
  byokKeyVerified: boolean

  setExpandedSource: (index: number | null) => void
  toggleSource: (index: number) => void
  setActiveAudioTab: (tab: 'upload' | 'record') => void
  setRecording: (recording: boolean) => void
  setRecordingDuration: (seconds: number) => void
  setSelectedFile: (file: File | null) => void
  setSourceFile: (source: keyof CaptureState['selectedFiles'], file: File | null) => void
  setExtractionId: (id: string | null) => void
  setSelectedRoadmapId: (id: string | null) => void
  setProcessingMode: (mode: 'cloud' | 'local' | 'byok') => void
  setOllamaStatus: (status: CaptureState['ollamaStatus']) => void
  setOllamaModels: (models: string[]) => void
  setLocalConfig: (config: Partial<LocalConfig>) => void
  setLocalProgress: (progress: LocalProgress | null) => void
  setLocalError: (error: string | null) => void
  setByokProvider: (provider: BYOKProvider | null) => void
  setByokApiKey: (key: string | null) => void
  setByokFastModel: (model: string | null) => void
  setByokSmartModel: (model: string | null) => void
  setByokKeyVerified: (verified: boolean) => void
  hydrateFromProfile: (settings: {
    processingMode?: 'cloud' | 'local' | 'byok'
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
  processingMode: loadProcessingMode(),
  ollamaStatus: 'unchecked',
  ollamaModels: [],
  localConfig: loadLocalConfig(),
  localProgress: null,
  localError: null,

  byokProvider: loadByokProvider(),
  byokApiKey: loadByokApiKey(),
  byokFastModel: loadByokModel(BYOK_FAST_MODEL_KEY),
  byokSmartModel: loadByokModel(BYOK_SMART_MODEL_KEY),
  byokKeyVerified: false,

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
  setByokProvider: (provider) => {
    try {
      if (provider) localStorage.setItem(BYOK_PROVIDER_KEY, provider)
      else localStorage.removeItem(BYOK_PROVIDER_KEY)
    } catch {}
    set({ byokProvider: provider, byokKeyVerified: false })
  },
  setByokApiKey: (key) => {
    try {
      if (key) localStorage.setItem(BYOK_API_KEY_KEY, key)
      else localStorage.removeItem(BYOK_API_KEY_KEY)
    } catch {}
    set({ byokApiKey: key, byokKeyVerified: false })
  },
  setByokFastModel: (model) => {
    try {
      if (model) localStorage.setItem(BYOK_FAST_MODEL_KEY, model)
      else localStorage.removeItem(BYOK_FAST_MODEL_KEY)
    } catch {}
    set({ byokFastModel: model })
  },
  setByokSmartModel: (model) => {
    try {
      if (model) localStorage.setItem(BYOK_SMART_MODEL_KEY, model)
      else localStorage.removeItem(BYOK_SMART_MODEL_KEY)
    } catch {}
    set({ byokSmartModel: model })
  },
  setByokKeyVerified: (verified) => set({ byokKeyVerified: verified }),
  hydrateFromProfile: (settings) => {
    const mode = settings.processingMode || 'cloud'
    const config: Partial<LocalConfig> = {}
    if (settings.ollamaBaseUrl) config.baseUrl = settings.ollamaBaseUrl
    if (settings.ollamaPass1Model) config.pass1Model = settings.ollamaPass1Model
    if (settings.ollamaPass2Model) config.pass2Model = settings.ollamaPass2Model

    // Update localStorage cache
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
      localProgress: null,
      localError: null,
    }),
}))
