# DataSnake LinkedIn — topic feed

This is the canonical source of LinkedIn post topics for the DataSnake
company page. The `generate-linkedin-post` Edge Function reads this
file, picks the oldest topic that hasn't been drafted yet (tracked by
sha256 of the line text in `public.linkedin_posts.topic_hash`), and
asks Claude to draft a polished post. The draft lands in
`/admin/linkedin` for review.

**How to add a topic:** add one bullet under `## Topics`. Keep it short
— one sentence is enough. The agent expands it into a full post
following the style notes below. Datestamps are optional but help with
chronological ordering when several topics get added at once.

**How a topic moves through the system:**

```
docs/LINKEDIN_FEED.md  (your inbox)
       │ generate-linkedin-post (cron Mon/Wed/Fri 09:00 UTC, or manual)
       ▼
public.linkedin_posts (status='draft')
       │ admin reviews + edits + approves
       ▼
public.linkedin_posts (status='approved')
       │ publish-linkedin-post  (cron Mon/Wed/Fri 14:00 UTC — Phase 9.17.1)
       ▼
LinkedIn DataSnake company page
```

Topics that have already been drafted are skipped automatically. To
intentionally re-draft a topic, slightly rephrase its bullet text so
its hash changes.

---

## Topics

- 2026-05-22: We just shipped /admin/console — a Snowflake-style operations workspace consolidating sensor fleet, ingest health, API keys, and the insurance impact bridge into one admin tab strip
- 2026-05-20: /insurance/pipeline walks the data from raw sensor stream through rolling z-score anomaly detection into the underwriting actions on the live insurance dashboards
- 2026-05-18: Risk API is callable now — POST an address, get a JSON verdict in under 800 ms. Calibrated against FEMA NRI v3 with live event modifiers
- 2026-05-15: Phase 9.13.1 published the hardware-to-software data contract — every column DataSnake hardware must ship per measurement, why each matters, plus pipeline SLAs the software team commits to
- 2026-05-12: Portfolio CSV upload + per-tenant RLS means an insurer drops their 50K-policy book and sees their own analytics in under 2 minutes
- 2026-05-08: 26 self-documenting "How is this calculated?" panels across the insurance dashboards — readable as a single glossary at /insurance/glossary

---

## Style notes (persistent — the generator reads these every run)

**Voice & tone**

- Founder-first-person ("we shipped", "we wired", "we hit").
- Technical but accessible. Assume the reader knows what an API is but
  not necessarily what a parametric trigger is — define jargon inline,
  one short clause.
- Honest about scope. Specific numbers when they're real ("ingests
  hourly", "<800 ms"); qualitative when not.
- No emoji unless the topic genuinely benefits.
- 200-400 words per post is the sweet spot for LinkedIn engagement.

**Structure**

- Hook in the first 1-2 lines (the part that shows before "see more").
- 2-3 short paragraphs separated by blank lines.
- Tie the topic to a business outcome — usually "what this means for
  an insurer / underwriter / climate-risk team".
- Include 3-5 hashtags at the end. Mix industry (#insurtech,
  #parametric, #reinsurance) with signal (#climatetech,
  #earthobservation, #climatedata).

**What NOT to do**

- Don't invent product features. If the topic doesn't mention it, it
  isn't there yet.
- Don't fabricate statistics. If a number isn't in the topic, speak
  qualitatively ("dense coverage" vs "10,000 sensors").
- Don't address the user. The output is the post body, not a chat.
- Don't include "Here is the LinkedIn post:" or any meta-framing.
- Don't use clickbait or all-caps.

**Hashtag bank** (the generator picks 3-5 from here, biased by topic)

- Industry: `#insurtech`, `#reinsurance`, `#parametric`, `#mga`,
  `#climaterisk`, `#catastrophebonds`, `#underwriting`
- Signal: `#climatetech`, `#earthobservation`, `#climatedata`,
  `#iot`, `#sensors`, `#oceandata`, `#geospatial`
- Stack/tech: `#api`, `#postgres`, `#edgefunctions`,
  `#realtimedata`, `#timeseries`
- Mission: `#datasnake`, `#terrawatch`, `#climateadaptation`,
  `#mitigation`
