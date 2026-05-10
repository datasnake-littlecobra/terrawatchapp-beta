// TerraWatch — Phase 9.3: Pinia store for the global Terra Chat surface.
//
// Holds the active conversation's messages, sending state, and quota.
// Loading the messages of a previously-stored conversation is handled here
// so AskTerraView can deep-link via /ask?c=<uuid>.

import { defineStore } from 'pinia'
import {
  askTerraChat,
  loadConversation,
  AskTerraChatAuthRequiredError,
  AskTerraChatQuotaError,
  type ChatTurn,
} from '@/services/askTerraChat'

export type ChatStatus = 'idle' | 'loading' | 'sending' | 'error'

interface State {
  conversationId: string | null
  turns: ChatTurn[]
  status: ChatStatus
  error: string | null
  quotaError: string | null
  authRequired: boolean
  remaining: number | null
}

export const useTerraChatStore = defineStore('terraChat', {
  state: (): State => ({
    conversationId: null,
    turns: [],
    status: 'idle',
    error: null,
    quotaError: null,
    authRequired: false,
    remaining: null,
  }),
  getters: {
    isEmpty: (s) => s.turns.length === 0,
    isSending: (s) => s.status === 'sending',
  },
  actions: {
    reset() {
      this.conversationId = null
      this.turns = []
      this.status = 'idle'
      this.error = null
      this.quotaError = null
      this.authRequired = false
      this.remaining = null
    },

    async openConversation(conversationId: string) {
      this.status = 'loading'
      this.error = null
      try {
        const turns = await loadConversation(conversationId)
        this.conversationId = conversationId
        this.turns = turns
        this.status = 'idle'
      } catch (e) {
        this.status = 'error'
        this.error = e instanceof Error ? e.message : 'Failed to load conversation'
      }
    },

    async send(message: string, location?: { lat: number; lon: number; label?: string }) {
      const trimmed = message.trim()
      if (!trimmed || this.status === 'sending') return

      // Optimistic user-message render so the input clears instantly.
      const provisional: ChatTurn = {
        id: `pending-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date(),
      }
      this.turns.push(provisional)
      this.status = 'sending'
      this.error = null
      this.quotaError = null
      this.authRequired = false

      try {
        // exactOptionalPropertyTypes — only pass keys whose values are defined.
        const req: { message: string; conversationId?: string; location?: { lat: number; lon: number; label?: string } } = { message: trimmed }
        if (this.conversationId) req.conversationId = this.conversationId
        if (location) req.location = location
        const res = await askTerraChat(req)
        this.conversationId = res.conversationId
        this.turns.push({
          id: `${res.conversationId}-${Date.now()}`,
          role: 'assistant',
          content: res.message.content,
          createdAt: new Date(),
        })
        this.remaining = res.remaining
        this.status = 'idle'
      } catch (e) {
        // Roll back the optimistic render so the user can retry without
        // duplication (the server didn't actually persist this turn).
        const idx = this.turns.indexOf(provisional)
        if (idx >= 0) this.turns.splice(idx, 1)

        if (e instanceof AskTerraChatAuthRequiredError) {
          this.authRequired = true
          this.status = 'idle'
        } else if (e instanceof AskTerraChatQuotaError) {
          this.quotaError = e.message
          this.status = 'idle'
        } else {
          this.error = e instanceof Error ? e.message : 'Failed to send'
          this.status = 'error'
        }
      }
    },
  },
})
