// TerraWatch — Phase 9.8: blog post service.
//
// Phase 9.7 read posts from /content/blog/*.md at build time. Phase 9.8
// moved canonical storage into the public.blog_posts Supabase table so
// admins can publish/hide/edit at runtime. This file is now a thin
// re-export of the DB-backed implementation in blogDb.ts; the public
// surface (listPosts / getPost / relatedPosts) is preserved so existing
// view imports (BlogIndexView, BlogPostView) keep working.

export type { BlogPost } from './blogDb'
export { listPosts, getPost, relatedPosts } from './blogDb'
