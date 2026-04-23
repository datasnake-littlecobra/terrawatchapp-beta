import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const shareMock = vi.fn()
vi.mock('@capacitor/share', () => ({
  Share: { share: (...args: unknown[]) => shareMock(...args) },
}))

import { useShare } from '@/composables/useShare'

describe('useShare', () => {
  beforeEach(() => {
    shareMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the Capacitor share bridge when it resolves', async () => {
    shareMock.mockResolvedValueOnce(undefined)
    const { share } = useShare()
    const ok = await share({ title: 't', text: 'hello' })
    expect(ok).toBe(true)
    expect(shareMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to navigator.share when Capacitor throws', async () => {
    shareMock.mockRejectedValueOnce(new Error('no native'))
    const webShare = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      share: webShare,
      clipboard: { writeText: vi.fn() },
    })
    const { share } = useShare()
    const ok = await share({ title: 't', text: 'hello', url: 'https://terra.app' })
    expect(ok).toBe(true)
    expect(webShare).toHaveBeenCalledWith({
      title: 't',
      text: 'hello',
      url: 'https://terra.app',
    })
  })

  it('falls back to clipboard when neither share API works', async () => {
    shareMock.mockRejectedValueOnce(new Error('no native'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { share } = useShare()
    const ok = await share({ title: 't', text: 'hello', url: 'https://terra.app' })
    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello\nhttps://terra.app')
  })
})
