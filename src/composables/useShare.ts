import { Share } from '@capacitor/share'

export interface ShareInput {
  title: string
  text: string
  dialogTitle?: string
  url?: string
}

export function useShare() {
  async function share(input: ShareInput): Promise<boolean> {
    try {
      const payload: Parameters<typeof Share.share>[0] = {
        title: input.title,
        text: input.text,
      }
      if (input.dialogTitle) payload.dialogTitle = input.dialogTitle
      if (input.url) payload.url = input.url
      await Share.share(payload)
      return true
    } catch {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          const payload: ShareData = { title: input.title, text: input.text }
          if (input.url) payload.url = input.url
          await navigator.share(payload)
          return true
        } catch {
          // fall through to clipboard
        }
      }
      try {
        const fallback = input.url ? `${input.text}\n${input.url}` : input.text
        await navigator.clipboard.writeText(fallback)
        return true
      } catch {
        return false
      }
    }
  }

  return { share }
}
