// TerraWatch — Phase 9.3: client wrapper for the ask-terra-chat edge function.
//
// Mirrors src/services/askTerra.ts in shape so the calling pattern is
// familiar. JWT comes from the active Supabase session; if the user isn't
// authed we throw a typed error the UI can branch on.

import { supabase } from './supabase'

export interface AskTerraChatRequest {
  conversationId?: string
  message: string
  location?: { lat: number; lon: number; label?: string }
}

export interface AskTerraChatResponse {
  conversationId: string
  message: { role: 'assistant'; content: string }
  remaining: number
}

export class AskTerraChatAuthRequiredError extends Error {
  constructor() { super('Sign in to chat with Terra.') }
}
export class AskTerraChatQuotaError extends Error {
  constructor(message: string) { super(message) }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function askTerraChat(req: AskTerraChatRequest): Promise<AskTerraChatResponse> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new AskTerraChatAuthRequiredError()

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-terra-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      conversation_id: req.conversationId,
      message: req.message,
      location: req.location,
    }),
  })

  if (res.status === 401) throw new AskTerraChatAuthRequiredError()
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}))
    throw new AskTerraChatQuotaError(body.error ?? 'Daily limit reached.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Chat failed (${res.status})`)
  }

  const body = (await res.json()) as {
    conversation_id: string
    message: { role: 'assistant'; content: string }
    remaining: number
  }
  return {
    conversationId: body.conversation_id,
    message: body.message,
    remaining: body.remaining,
  }
}

// List recent conversations for the current user — used by the chat
// sidebar/history once we add it; safe to call from a fully-authed view.
export interface ConversationSummary {
  id: string
  title: string | null
  updatedAt: Date
  messageCount: number
  lastMessage: string | null
}

export async function listConversations(maxRows = 20): Promise<ConversationSummary[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('terra_list_conversations', { max_rows: maxRows })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{
    id: string
    title: string | null
    updated_at: string
    message_count: number | string
    last_message: string | null
  }>).map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: new Date(r.updated_at),
    messageCount: Number(r.message_count),
    lastMessage: r.last_message,
  }))
}

export interface ChatTurn {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
}

export async function loadConversation(conversationId: string): Promise<ChatTurn[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('terra_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{ id: string; role: string; content: string; created_at: string }>).map((r) => ({
    id: r.id,
    role: r.role as 'user' | 'assistant' | 'system',
    content: r.content,
    createdAt: new Date(r.created_at),
  }))
}
