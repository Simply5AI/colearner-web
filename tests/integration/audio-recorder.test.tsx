import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioRecorder } from '@/components/materials/audio-recorder'

const stopTrack = vi.fn()
const getUserMedia = vi.fn()
class Recorder {
  static isTypeSupported = () => true
  state = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable?: (event: { data: Blob }) => void
  onstop?: () => void
  onerror?: () => void
  start() { this.state = 'recording' }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['recorded sound']) }); this.onstop?.() }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('MediaRecorder', Recorder)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('microphone recording', () => {
  it('records only after opt-in, returns a real file and releases the microphone', async () => {
    const saved = vi.fn(); render(<AudioRecorder onRecording={saved} maxBytes={1000} />)
    expect(getUserMedia).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Record audio' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }))
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false })
    expect(stopTrack).toHaveBeenCalled()
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ name: 'recording.webm', type: 'audio/webm' }))
  })
  it('releases a stream that arrives after the screen is closed', async () => {
    let resolve!: (value: unknown) => void
    getUserMedia.mockImplementation(() => new Promise(done => { resolve = done }))
    const saved = vi.fn(); const view = render(<AudioRecorder onRecording={saved} maxBytes={1000} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record audio' })); view.unmount()
    resolve({ getTracks: () => [{ stop: stopTrack }] })
    await waitFor(() => expect(stopTrack).toHaveBeenCalled())
    expect(saved).not.toHaveBeenCalled()
  })
  it('explains denied permission and retains the upload alternative', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    render(<AudioRecorder onRecording={vi.fn()} maxBytes={1000} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record audio' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone permission was denied')
    expect(screen.getByRole('button', { name: 'Record audio' })).toBeEnabled()
  })
});
