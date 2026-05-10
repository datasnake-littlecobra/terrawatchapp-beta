// TerraWatch — Phase 9.9: client wrapper for the generate-blog edge fn.
//
// Mirrors the askTerra.ts shape — auth-required, custom error class for
// quota, parsed response shape. Used by AdminBlogGeneratorView.

import { requireSupabase } from './supabase'

export interface AppPostVariant {
  title:    string
  excerpt:  string
  body_md:  string
  category: string
  tags:     string[]
}
export interface LinkedInVariant {
  post:     string
  hashtags: string[]
}
export interface RedditVariant {
  title:      string
  body:       string
  subreddits: string[]
}
export interface InstagramVariant {
  caption:      string
  hashtags:     string[]
  image_prompt: string
}

export interface GenerateBlogResponse {
  app:       AppPostVariant
  linkedin:  LinkedInVariant
  reddit:    RedditVariant
  instagram: InstagramVariant
  remaining: number
}

export interface GenerateBlogRequest {
  topic:     string
  context?:  string
  audience?: 'general' | 'technical' | 'investor'
  tone?:     'professional' | 'conversational' | 'enthusiastic'
}

export class GenerateBlogQuotaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GenerateBlogQuotaError'
  }
}
export class GenerateBlogAuthError extends Error {
  constructor() {
    super('Sign in as an admin to use the blog generator.')
    this.name = 'GenerateBlogAuthError'
  }
}
export class GenerateBlogForbiddenError extends Error {
  constructor() {
    super('Admin access required.')
    this.name = 'GenerateBlogForbiddenError'
  }
}

export async function generateBlog(req: GenerateBlogRequest): Promise<GenerateBlogResponse> {
  const supabase = requireSupabase()
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) throw new GenerateBlogAuthError()

  const { data, error } = await supabase.functions.invoke<GenerateBlogResponse>('generate-blog', {
    body: req,
  })

  if (error) {
    const ctx = error.context as { status?: number; error?: { message?: string } } | undefined
    if (ctx?.status === 429) {
      throw new GenerateBlogQuotaError(ctx.error?.message ?? 'Daily limit reached.')
    }
    if (ctx?.status === 403) {
      throw new GenerateBlogForbiddenError()
    }
    if (ctx?.status === 401) {
      throw new GenerateBlogAuthError()
    }
    throw error
  }
  if (!data) throw new Error('generate-blog returned no response.')
  return data
}
