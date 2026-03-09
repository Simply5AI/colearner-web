import { create } from 'zustand'

interface CaptureState {
  expandedSource: number | null
  activeAudioTab: 'upload' | 'record'
  isRecording: boolean
  recordingDuration: number
  selectedFile: File | null
  extractionId: string | null

  setExpandedSource: (index: number | null) => void
  toggleSource: (index: number) => void
  setActiveAudioTab: (tab: 'upload' | 'record') => void
  setRecording: (recording: boolean) => void
  setRecordingDuration: (seconds: number) => void
  setSelectedFile: (file: File | null) => void
  setExtractionId: (id: string | null) => void
  reset: () => void
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  expandedSource: null,
  activeAudioTab: 'upload',
  isRecording: false,
  recordingDuration: 0,
  selectedFile: null,
  extractionId: null,

  setExpandedSource: (index) => set({ expandedSource: index }),
  toggleSource: (index) =>
    set({ expandedSource: get().expandedSource === index ? null : index }),
  setActiveAudioTab: (tab) => set({ activeAudioTab: tab }),
  setRecording: (recording) => set({ isRecording: recording }),
  setRecordingDuration: (seconds) => set({ recordingDuration: seconds }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setExtractionId: (id) => set({ extractionId: id }),
  reset: () =>
    set({
      expandedSource: null,
      activeAudioTab: 'upload',
      isRecording: false,
      recordingDuration: 0,
      selectedFile: null,
      extractionId: null,
    }),
}))
