// TerraWatch — Phase 9.17.1: LinkedIn OAuth client.
//
// Reads connection status via linkedin_oauth_status() RPC (admin-only).
// Builds the authorize URL using VITE_LINKEDIN_CLIENT_ID. Exchanges
// the auth code via the linkedin-oauth-callback Edge Function.

import { supabase } from './supabase'

export interface LinkedInStatus {
  connected:                boolean
  orgUrn:                   string | null
  orgName:                  string | null
  orgVanityName:            string | null
  accessTokenExpiresAt:     Date | null
  refreshTokenExpiresAt:    Date | null
  scope:                    string | null
  connectedAt:              Date | null
  connectedByEmail:         string | null
  needsRefresh:             boolean
  needsReconnect:           boolean
}

interface StatusRow {
  connected:                  boolean
  org_urn:                    string | null
  org_name:                   string | null
  org_vanity_name:            string | null
  access_token_expires_at:    string | null
  refresh_token_expires_at:   string | null
  scope:                      string | null
  connected_at:               string | null
  connected_by_email:         string | null
  needs_refresh:              boolean
  needs_reconnect:            boolean
}

export async function fetchLinkedInStatus(): Promise<LinkedInStatus> {
  if (!supabase) {
    return {
      connected: false, orgUrn: null, orgName: null, orgVanityName: null,
      accessTokenExpiresAt: null, refreshTokenExpiresAt: null, scope: null,
      connectedAt: null, connectedByEmail: null,
      needsRefresh: false, needsReconnect: false,
    }
  }
  const { data, error } = await supabase.rpc('linkedin_oauth_status')
  if (error) throw new Error(error.message)
  const row = ((data ?? []) as StatusRow[])[0]
  if (!row || !row.connected) {
    return {
      connected: false, orgUrn: null, orgName: null, orgVanityName: null,
      accessTokenExpiresAt: null, refreshTokenExpiresAt: null, scope: null,
      connectedAt: null, connectedByEmail: null,
      needsRefresh: false, needsReconnect: false,
    }
  }
  return {
    connected:                true,
    orgUrn:                   row.org_urn,
    orgName:                  row.org_name,
    orgVanityName:            row.org_vanity_name,
    accessTokenExpiresAt:     row.access_token_expires_at  ? new Date(row.access_token_expires_at)  : null,
    refreshTokenExpiresAt:    row.refresh_token_expires_at ? new Date(row.refresh_token_expires_at) : null,
    scope:                    row.scope,
    connectedAt:              row.connected_at ? new Date(row.connected_at) : null,
    connectedByEmail:         row.connected_by_email,
    needsRefresh:             row.needs_refresh,
    needsReconnect:           row.needs_reconnect,
  }
}

// Scopes for the Community Management API.
const SCOPES = [
  'openid',
  'profile',
  'email',
  'w_organization_social',     // post on the company page
  'r_organization_admin',      // look up the admin's orgs
  'r_organization_social',     // read posts (verify after publish)
].join(' ')

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID as string | undefined
  if (!clientId) {
    throw new Error('VITE_LINKEDIN_CLIENT_ID is not set at build time')
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    state,
    scope:         SCOPES,
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

export interface ExchangeResult {
  ok:                       boolean
  org_urn?:                 string
  org_name?:                string
  org_vanity_name?:         string
  scope?:                   string
  access_token_expires_at?: string
  refresh_token_expires_at?: string
  error?:                   string
}

export async function exchangeOauthCode(code: string, redirectUri: string, state?: string): Promise<ExchangeResult> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.functions.invoke<ExchangeResult>(
    'linkedin-oauth-callback',
    { body: { code, redirect_uri: redirectUri, state } },
  )
  if (error) {
    let msg = error.message || 'OAuth exchange failed'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.clone().json()
        if (body?.error) msg = `${body.error} (HTTP ${ctx.status})`
      }
    } catch { /* keep generic */ }
    throw new Error(msg)
  }
  if (!data) throw new Error('No response from server')
  return data
}

export interface PublishNowResult {
  ok:           boolean
  picked?:      string | null
  linkedin_urn?: string
  message?:     string
  error?:       string
}

export async function publishLinkedInPostNow(postId?: string): Promise<PublishNowResult> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.functions.invoke<PublishNowResult>(
    'publish-linkedin-post',
    { body: postId ? { post_id: postId } : {} },
  )
  if (error) {
    let msg = error.message || 'Publish failed'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.clone().json()
        if (body?.error) msg = `${body.error} (HTTP ${ctx.status})`
      }
    } catch { /* keep generic */ }
    throw new Error(msg)
  }
  if (!data) throw new Error('No response from server')
  return data
}
