// TerraWatch — Phase 9.13: admin client for the public.api_keys table.
//
// Admin-only writes; admin-only reads. RLS in 0027_api_keys.sql enforces
// this. The raw key value is generated client-side (cryptographically
// random) and only the sha256 hash is sent to the server — the admin
// must copy the raw key from the response display because it is never
// recoverable from the DB.

import { supabase } from './supabase'

export interface ApiKeyRow {
  id:           string
  key_prefix:   string
  tenant_name:  string
  plan:         'free' | 'paid'
  daily_limit:  number
  created_at:   string
  revoked_at:   string | null
  last_used_at: string | null
  note:         string | null
  usage_today?: number
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateRawKey(): string {
  // 32 random bytes → base32-ish via base64url. Final shape: tw_<43-44 chars>.
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  const b64 = btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `tw_${b64}`
}

export interface CreatedKey {
  rawKey: string          // shown ONCE — copy now or lose it
  row:    ApiKeyRow
}

export async function createApiKey(input: {
  tenant_name: string
  plan:        'free' | 'paid'
  daily_limit: number
  note?:       string
}): Promise<CreatedKey> {
  if (!supabase) throw new Error('Supabase unavailable.')
  const rawKey = generateRawKey()
  const keyHash = await sha256Hex(rawKey)
  const keyPrefix = rawKey.slice(0, 11) // 'tw_' + 8 chars

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      key_hash:    keyHash,
      key_prefix:  keyPrefix,
      tenant_name: input.tenant_name,
      plan:        input.plan,
      daily_limit: input.daily_limit,
      note:        input.note ?? null,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Insert failed.')
  return { rawKey, row: data as ApiKeyRow }
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  if (!supabase) throw new Error('Supabase unavailable.')
  const today = new Date().toISOString().slice(0, 10)
  const [{ data: keys, error: e1 }, { data: usage, error: e2 }] = await Promise.all([
    supabase.from('api_keys').select('*').order('created_at', { ascending: false }),
    supabase.from('api_key_usage').select('key_id, count').eq('day', today),
  ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  const usageMap = new Map((usage ?? []).map((u: { key_id: string; count: number }) => [u.key_id, u.count]))
  return (keys ?? []).map((k) => ({
    ...(k as ApiKeyRow),
    usage_today: usageMap.get(k.id) ?? 0,
  }))
}

export async function revokeApiKey(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase unavailable.')
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
