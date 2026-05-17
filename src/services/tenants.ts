// TerraWatch — Phase 9.14: tenant + membership client.
//
// Reads my_tenants() RPC, calls create_tenant() RPC. Both are
// SECURITY DEFINER and gated to authenticated. RLS on the underlying
// tables enforces per-user visibility.

import { supabase } from './supabase'

export interface Tenant {
  id:            string
  name:          string
  slug:          string
  plan:          'free' | 'paid'
  policyLimit:   number
  memberRole:    'owner' | 'member' | 'viewer'
  policyCount:   number
}

interface TenantRow {
  id:            string
  name:          string
  slug:          string
  plan:          'free' | 'paid'
  policy_limit:  number
  member_role:   'owner' | 'member' | 'viewer'
  policy_count:  number
}

export async function fetchMyTenants(): Promise<Tenant[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('my_tenants')
  if (error) throw new Error(error.message)
  return ((data ?? []) as TenantRow[]).map((r) => ({
    id:            r.id,
    name:          r.name,
    slug:          r.slug,
    plan:          r.plan,
    policyLimit:   r.policy_limit,
    memberRole:    r.member_role,
    policyCount:   r.policy_count,
  }))
}

export async function createTenant(input: {
  name:         string
  slug:         string
  contactEmail: string
}): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('create_tenant', {
    p_name:          input.name,
    p_slug:          input.slug,
    p_contact_email: input.contactEmail,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export interface TenantSummary {
  policyCount:       number
  totalExposure:     number
  avgRiskScore:      number | null
  topState:          string | null
  topStateExposure:  number | null
  countyCount:       number
}

interface SummaryRow {
  policy_count:       number
  total_exposure:     number | string
  avg_risk_score:     number | string | null
  top_state:          string | null
  top_state_exposure: number | string | null
  county_count:       number
}

export async function fetchTenantSummary(tenantId: string): Promise<TenantSummary | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('tenant_portfolio_summary', { p_tenant: tenantId })
  if (error) throw new Error(error.message)
  const row = ((data ?? []) as SummaryRow[])[0]
  if (!row) return null
  return {
    policyCount:       row.policy_count,
    totalExposure:     Number(row.total_exposure ?? 0),
    avgRiskScore:      row.avg_risk_score != null ? Number(row.avg_risk_score) : null,
    topState:          row.top_state,
    topStateExposure:  row.top_state_exposure != null ? Number(row.top_state_exposure) : null,
    countyCount:       row.county_count,
  }
}
