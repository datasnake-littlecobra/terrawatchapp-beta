-- TerraWatch — security cleanup: drop the orphaned safe_select RPC.
--
-- Added in 0047 for the /ai-models SQL Playground, which was removed in
-- commit 9aecea1 ("remove Research + AI Models sections, add Location Risk
-- vertical") without revoking this grant. Left as-is, it remained a
-- generic, anon-callable, user-supplied-SQL executor: SECURITY INVOKER
-- keeps RLS in force, but its only guard against injection was a keyword
-- blacklist (not an allowlist/parser), which does not stop things like
-- pg_sleep(), information_schema enumeration, or other recon/DoS vectors.
-- No caller remains in the frontend — dropping it entirely removes the
-- attack surface rather than leaving a revoked-but-present function that
-- could be re-granted by accident later.

drop function if exists public.safe_select(text);
