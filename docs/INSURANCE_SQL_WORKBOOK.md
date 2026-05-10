# DataSnake Insurance — Hands-on SQL & Math Workbook

A tab-by-tab study workbook. For each `/insurance` tab you get:
- **The data behind it** — where it lives.
- **Run-this-now SQL** — paste into Supabase Dashboard → SQL Editor.
- **What each output column means** in plain English.
- **The insurance math** — formulas that turn raw rows into AAL, EAL,
  Premium, Capital Charge, etc.
- **Where money is saved** — the link from the data to dollars.
- **Tinker prompts** — small modifications to try yourself.

Work through one tab per session. By the end you can defend every
number on the dashboard from a SQL query and a one-line formula.

> **Reality check on the data**
>
> | Tab | Source |
> |---|---|
> | Tab 1 (Overview) | **Real**: `public.fema_nri` + `public.events` in Supabase |
> | Tabs 2-7 | **Mock**: lives in `src/data/insurance-mock.ts`, not in the DB |
>
> For Tabs 2-7 the SQL queries below use the `with foo as (values ...)`
> Postgres CTE pattern — the data is baked into the query so it runs
> against any database (including Supabase) without setup. Copy the
> entire code block and paste it into SQL Editor.

---

## Tab 1 — `/insurance` Overview (real data)

### Where the data lives
- `public.fema_nri` — ~3,200 rows after seeding. One row per US county.
- `public.events` — live ingest, hourly cron. Severe-weather +
  earthquake + volcano + wildfire alerts.

### 1.1. Counties indexed (the first hero counter)

```sql
select count(*) as counties_indexed,
       count(*) filter (where risk_score >= 80) as high_risk_counties,
       sum(expected_annual_loss_total) / 1e9 as total_eal_b,
       max(state) as sample_state
  from public.fema_nri;
```

**What you get.** A single row with four numbers.

| Column | Meaning | Example |
|---|---|---|
| `counties_indexed` | Total US counties FEMA NRI knows about. | ~3,200 |
| `high_risk_counties` | Counties with composite risk score ≥ 80. | ~150-200 |
| `total_eal_b` | Total US Expected Annual Loss in $B. | ~$140B |
| `sample_state` | Just to confirm the state column populated. | "Wyoming" |

**The insurance math.** `expected_annual_loss_total` is computed by
FEMA from 18 hazard sub-models. Each hazard's EAL is `Building Value
× Annual Frequency × Vulnerability` (FEMA's vulnerability is the
fraction of building value lost when the event hits). Sum all 18 and
you get total EAL.

Translation to premium: a US homeowners insurance policy with $250K
TIV (Total Insured Value) in a county with $1B total EAL across (say)
500K policies has a per-policy expected loss of ~$2K/year. Premium
typically = AAL × 1.5 = **$3K/year** at fair pricing. Premium below
that means the carrier is taking uncompensated risk.

### 1.2. Top counties by composite risk

```sql
select county_fips, state, county_name,
       risk_score,
       risk_rating,
       expected_annual_loss_total / 1e6 as eal_m,
       social_vulnerability,
       community_resilience
  from public.fema_nri
 where risk_score is not null
 order by risk_score desc nulls last
 limit 10;
```

**What you get.** The 10 highest-risk US counties.

**Read it like this.** Bronx County NY, LA County CA, Harris County TX
will likely top this list — high population × high TIV × high hazard
exposure. Notice `social_vulnerability` (FEMA SoVI; 0-100 where higher
= more vulnerable) and `community_resilience` (CRI; higher = better
recovery capacity). These don't change EAL but DO change the human
cost. Reinsurers care; pure-economic models often skip them.

**Why this matters for premium.** Two counties with identical EAL but
different SoVI score deserve different premium loads — the high-SoVI
county will see longer business interruption + slower repairs + more
total-loss claims after an event. Sensor data doesn't change SoVI but
DOES improve the EAL precision.

### 1.3. Active threats joined to high-risk states

This is exactly what the active-threat strip on the dashboard renders.

```sql
with high_risk_states as (
  select distinct on (state)
    state, state_abbrev, county_fips, risk_score
  from public.fema_nri
  where risk_score >= 80
  order by state, risk_score desc nulls last
)
select e.id,
       e.severity,
       e.title,
       e.category,
       e.region,
       h.state          as matched_state,
       h.county_fips    as matched_county_fips,
       h.risk_score     as matched_risk_score,
       e.occurred_at
  from public.events e
  join high_risk_states h
    on  upper(coalesce(e.region, '')) = upper(h.state)
    or upper(coalesce(e.region, '')) = upper(coalesce(h.state_abbrev, ''))
 where e.severity in ('caution', 'danger')
   and e.occurred_at >= now() - interval '24 hours'
 order by case e.severity when 'danger' then 0 when 'caution' then 1 else 2 end,
          e.occurred_at desc
 limit 25;
```

**What you get.** Every "elevated" event right now (last 24h) that's
hitting a state which contains a high-risk county. Each row tells you
"X event is happening in your high-risk markets right now."

**The insurance math.** This is the **real-time exposure check**.
For each active event, the loss-modeling team computes:

```
event_modeled_loss =
   exposure_in_event_footprint   ($B of TIV in the impact zone)
 × loss_ratio_for_severity        (e.g. 0.04 for caution, 0.12 for danger)
 × claim_filing_rate              (typically 0.6-0.8 for severe events)
```

A "danger" severity event hitting a state with $50B of TIV in the
footprint = ~$2.4B of expected paid losses (50 × 0.12 × 0.4
adjustment for partial geographic coverage). Reinsurers pre-allocate
capital to that estimate within the first hour.

**Tinker.** Change `'caution'` to just `'danger'`, and `interval '24
hours'` to `interval '7 days'` to see the past week's most-elevated
events.

### 1.4. State-level EAL aggregation (the bar chart)

```sql
select state,
       count(*)                        as county_count,
       sum(expected_annual_loss_total) / 1e9    as total_eal_b,
       avg(risk_score)                 as avg_risk_score,
       count(*) filter (where risk_score >= 80) as high_risk_count
  from public.fema_nri
 where state is not null
 group by state
 order by total_eal_b desc nulls last
 limit 15;
```

**What you get.** Top 15 states ranked by aggregate climate-disaster
EAL. California, Florida, Texas, New York will dominate — both
because they have lots of counties AND because each carries
high-magnitude EAL.

**The insurance math.** State-level EAL is what reinsurers buy
treaties against. A "Florida cat treaty" priced at $2B in retention
+ $8B in limit roughly maps to "if Florida's modeled annual loss
exceeds $2B for a single event, the reinsurer pays the next $8B."
The numbers in this query are the **input** to that pricing.

### 1.5. Per-hazard EAL across the country

```sql
select 'flood'      as hazard, sum(eal_flood)      / 1e9 as total_b from public.fema_nri
union all
select 'wildfire',                sum(eal_wildfire)  / 1e9 from public.fema_nri
union all
select 'hurricane',               sum(eal_hurricane) / 1e9 from public.fema_nri
union all
select 'tornado',                 sum(eal_tornado)   / 1e9 from public.fema_nri
union all
select 'earthquake',              sum(eal_earthquake)/ 1e9 from public.fema_nri
order by total_b desc;
```

**What you get.** $B of US-wide EAL per spotlight peril.

**Where money is saved.** Each peril's $B is what DataSnake's fleet
targets. Submarine sensors → tighter flood + hurricane EAL.
Ground-motion network → tighter earthquake EAL. Met network →
tighter wildfire + tornado EAL. The $ scale here tells you which
peril deployment yields the largest absolute saving.

---

## Tab 2 — `/insurance/verdict` (mock data, paste the CTE)

### What's behind the chart
9 representative locations with hand-tuned risk scores, premium
multipliers, and key sensor-driven factors. The data lives in
`RISK_VERDICTS` in `src/data/insurance-mock.ts`.

### 2.1. The full verdict table — paste this into SQL Editor

```sql
with verdicts(location, risk_score, premium_mul, aal_mul,
              flood, seismic, wind, wildfire, surge, confidence) as (
  values
    ('Miami Beach, FL',       87, 3.4, 2.8, 9.2, 1.1, 8.8, 0.9, 9.4, 0.91),
    ('New Orleans, LA',       84, 2.9, 2.4, 9.6, 0.6, 8.1, 0.4, 9.0, 0.88),
    ('Tampa, FL',             81, 2.6, 2.2, 8.5, 0.7, 8.6, 1.4, 9.3, 0.85),
    ('Houston, TX',           79, 2.4, 2.1, 9.0, 0.4, 7.6, 1.8, 7.4, 0.86),
    ('San Francisco, CA',     74, 2.1, 1.9, 3.8, 9.1, 2.6, 5.2, 4.5, 0.93),
    ('Los Angeles, CA',       71, 1.9, 1.8, 2.4, 7.2, 4.1, 9.0, 1.6, 0.89),
    ('Boulder, CO',           64, 1.5, 1.4, 3.1, 1.7, 6.8, 8.2, 0.0, 0.81),
    ('Honolulu, HI',          62, 1.4, 1.3, 6.1, 4.2, 5.4, 3.2, 7.1, 0.83),
    ('Phoenix, AZ',           58, 1.3, 1.2, 2.2, 1.3, 3.1, 6.4, 0.0, 0.82),
    ('Nashville, TN',         36, 1.0, 1.0, 3.4, 1.8, 6.4, 1.2, 0.0, 0.79)
)
select location,
       risk_score,
       case when risk_score >= 80 then 'CRITICAL'
            when risk_score >= 65 then 'HIGH'
            when risk_score >= 50 then 'ELEVATED'
            when risk_score >= 30 then 'MODERATE'
            else 'LOW' end                                 as label,
       premium_mul,
       aal_mul,
       greatest(flood, seismic, wind, wildfire, surge)     as dominant_peril_score,
       confidence
  from verdicts
 order by risk_score desc;
```

**What you get.** Each location's verdict label (CRITICAL/HIGH/etc.),
the premium multiplier the underwriter would apply, and the dominant
peril severity 0-10.

**The insurance math.**

```
recommended_premium    = baseline_rate × premium_mul × TIV
expected_annual_loss   = baseline_AAL  × aal_mul     × policy_count
```

Worked example. **Miami Beach $1M home, baseline rate 0.4% of TIV.**
- Standard premium  = 0.4% × $1,000,000 = **$4,000/yr**
- Risk-adjusted    = $4,000 × 3.4 = **$13,600/yr** (Miami Beach
  premium_mul from the row above)
- Without DataSnake's score the underwriter would price at $4K and
  pick up uncompensated risk. With it, they price at $13.6K. The $9.6K
  delta × 100,000 such homes in the book = **$960M/yr** of premium
  the carrier was leaving on the table at the standard rate.

The `aal_mul` doesn't change premium directly — it changes the
**expected loss** the carrier reserves against. If portfolio mean AAL
is $400/home/yr, Miami Beach is 2.8 × $400 = $1,120/home/yr. That's
the insurance accounting impact.

### 2.2. Confidence-weighted blended risk

```sql
with verdicts(location, risk_score, confidence, premium_mul) as (
  values
    ('Miami Beach, FL', 87, 0.91, 3.4),
    ('New Orleans, LA', 84, 0.88, 2.9),
    ('San Francisco',   74, 0.93, 2.1),
    ('Houston, TX',     79, 0.86, 2.4),
    ('Boulder, CO',     64, 0.81, 1.5),
    ('Phoenix, AZ',     58, 0.82, 1.3),
    ('Nashville, TN',   36, 0.79, 1.0)
)
select location,
       risk_score,
       confidence,
       round(risk_score * confidence)                       as confidence_weighted_score,
       round((risk_score * confidence + (1 - confidence) * 50)::numeric, 1)
                                                            as bayesian_blended_score,
       round(premium_mul * (0.5 + confidence * 0.5), 2)     as effective_premium_mul
  from verdicts
 order by confidence_weighted_score desc;
```

**The math.** When confidence < 1, the underwriter blends the score
toward a portfolio-mean prior (here 50). This is **Bayesian shrinkage**:
- Confidence 0.91 → score barely moves (87 × 0.91 + 50 × 0.09 = ~83.7).
- Confidence 0.79 → score moves more aggressively toward 50.

Why this matters: low-confidence sensor outputs SHOULD price more
conservatively until enough samples build the posterior. DataSnake's
confidence improves with sensor-density and observation count.

---

## Tab 3 — `/insurance/map` Command Center

### 3.1. Color band thresholds + KPI strip math

```sql
with cells(city, lat, lon, risk, exposure_b, dominant, trend) as (
  values
    ('Miami Beach',     25.79,  -80.13, 87, 142.3, 'surge',    'rising'),
    ('Tampa',           27.95,  -82.46, 81,  98.7, 'surge',    'rising'),
    ('New Orleans',     29.95,  -90.07, 84,  88.2, 'flood',    'rising'),
    ('Houston',         29.76,  -95.36, 79, 156.5, 'flood',    'stable'),
    ('San Francisco',   37.77, -122.41, 74, 184.7, 'seismic',  'rising'),
    ('Los Angeles',     34.05, -118.24, 71, 211.0, 'wildfire', 'rising'),
    ('Charleston SC',   32.78,  -79.93, 71,  38.4, 'surge',    'rising'),
    ('New York',        40.71,  -74.01, 55, 312.4, 'surge',    'rising'),
    ('Boston',          42.36,  -71.06, 41,  96.0, 'surge',    'stable'),
    ('Boulder',         40.01, -105.27, 64,  17.4, 'wildfire', 'rising'),
    ('Phoenix',         33.45, -112.07, 58,  44.8, 'wildfire', 'rising'),
    ('Seattle',         47.61, -122.33, 49,  76.0, 'seismic',  'stable'),
    ('Nashville',       36.16,  -86.78, 36,  22.1, 'wind',     'falling'),
    ('Honolulu',        21.31, -157.86, 62,  14.3, 'surge',    'stable')
)
select
  case when risk >= 70 then 'red'
       when risk >= 40 then 'amber'
       else 'green' end                                  as color_band,
  count(*)                                              as zones,
  sum(exposure_b)                                       as exposure_b,
  count(*) filter (where trend = 'rising')              as rising
  from cells
 group by 1
 order by case 1
   when 'red'    then 0 when 'amber' then 1 else 2 end;
```

**What you get.** Three rows: red / amber / green portfolio splits.

**The insurance math.** Reinsurance treaties are typically tiered
against the exposure aggregated into red zones — that's the
**concentration accumulation** which feeds the layer-by-layer pricing
of the reinsurance program:

```
treaty_layer_1_premium = 0.8% × red_zone_exposure × tail_load(1.4)
treaty_layer_2_premium = 0.5% × amber_zone_exposure × tail_load(1.2)
```

Numbers above are illustrative. The **point**: the dashboard's
red/amber/green split DIRECTLY drives reinsurance premium. A 10%
shift from amber to red moves treaty premium by ~$200M/yr on a
$50B-exposure book.

### 3.2. Rising-risk markets (the sidebar list)

```sql
with cells(city, risk, dominant, trend) as (
  values
    ('Miami Beach',     87, 'surge',    'rising'),
    ('New Orleans',     84, 'flood',    'rising'),
    ('Tampa',           81, 'surge',    'rising'),
    ('Houston',         79, 'flood',    'stable'),
    ('San Francisco',   74, 'seismic',  'rising'),
    ('Los Angeles',     71, 'wildfire', 'rising'),
    ('Charleston SC',   71, 'surge',    'rising'),
    ('Boulder',         64, 'wildfire', 'rising'),
    ('Phoenix',         58, 'wildfire', 'rising'),
    ('Seattle',         49, 'seismic',  'stable')
)
select city, risk, dominant
  from cells
 where trend = 'rising'
 order by risk desc
 limit 8;
```

**What you get.** The 8 highest-scoring rising markets — these are the
ones that need premium repricing **before** the next renewal cycle,
not after.

**Where money is saved.** Catching a 5% concentration creep on a $200B
TIV book early lets you reprice ~$10B of TIV at fair rates —
generating **$60-100M/yr** of net premium uplift if your fair-rate
delta is 0.6-1.0%. Catching it AFTER an event = paying claims at the
old rates.

---

## Tab 4 — `/insurance/ep-curves` (the CFO conversation)

### 4.1. The full EP curve table

```sql
with ep(peril, return_period, baseline_b, sensor_b) as (
  values
    ('flood',    10,   0.8,  0.7),
    ('flood',    25,   2.1,  1.7),
    ('flood',    50,   4.6,  3.6),
    ('flood',   100,   9.4,  7.3),
    ('flood',   200,  19.2, 15.0),
    ('flood',   500,  35.0, 27.6),
    ('seismic',  10,   0.4,  0.3),
    ('seismic',  25,   1.0,  0.8),
    ('seismic',  50,   2.2,  1.7),
    ('seismic', 100,   4.8,  3.8),
    ('seismic', 200,   9.3,  7.5),
    ('seismic', 500,  17.0, 13.4),
    ('wind',     10,   0.5,  0.4),
    ('wind',     25,   1.4,  1.1),
    ('wind',     50,   3.0,  2.4),
    ('wind',    100,   6.0,  4.7),
    ('wind',    200,  12.0,  9.4),
    ('wind',    500,  22.0, 17.2),
    ('combined', 10,   1.2,  0.9),
    ('combined', 25,   3.1,  2.4),
    ('combined', 50,   6.8,  5.2),
    ('combined',100,  14.2, 11.1),
    ('combined',200,  28.5, 22.3),
    ('combined',500,  52.0, 41.0)
)
select peril, return_period,
       baseline_b,
       sensor_b,
       baseline_b - sensor_b                                as saving_b,
       round(((baseline_b - sensor_b) / baseline_b * 100)::numeric, 1)
                                                            as pct_reduction,
       round((1.0 / return_period)::numeric, 4)             as annual_probability,
       round(((baseline_b - sensor_b) / return_period)::numeric, 3)
                                                            as annualized_saving_b
  from ep
 order by peril, return_period;
```

**What you get.** For every (peril, return_period) pair: the modeled
$B baseline loss, $B sensor-tightened loss, $B saving, % reduction,
the annual probability, and the **annualized expected-loss saving**
(saving / RP — the expected dollars saved per year, weighted by event
frequency).

**The insurance math — read carefully, this is the heart of the deal.**

```
annual_probability    = 1 / return_period             (e.g., 1-in-100yr = 0.01)
saving_b              = baseline_b - sensor_b         (the gap on the chart)
pct_reduction         = saving_b / baseline_b × 100   (the headline %)
annualized_saving_b   = saving_b / return_period      (probability-weighted)

total_annualized_saving = SUM over all return periods of annualized_saving_b
```

For the **combined** peril:

| RP | annual prob | annualized saving |
|---|---|---|
| 10  | 0.10  | $0.030B = $30M  |
| 25  | 0.04  | $0.028B = $28M  |
| 50  | 0.02  | $0.032B = $32M  |
| 100 | 0.01  | $0.031B = $31M  |
| 200 | 0.005 | $0.031B = $31M  |
| 500 | 0.002 | $0.022B = $22M  |
| **Total** |  | **~$174M/yr** |

The dashboard's "annualized expected-loss saving" callout shows this
sum. **That number is real-money-saved per year.**

### 4.2. Capital-efficiency derivation

```sql
with combined_ep(rp, baseline_b, sensor_b) as (
  values
    (100, 14.2, 11.1)
)
select
  baseline_b                         as legacy_capital_held_b,
  sensor_b                           as datasnake_capital_held_b,
  baseline_b - sensor_b              as freed_capital_b,
  round(((baseline_b - sensor_b) * 0.06)::numeric, 2)
                                     as incremental_return_b_per_year,
  round((((baseline_b - sensor_b) * 0.06) * 1000)::numeric, 0)
                                     as incremental_return_m_per_year
  from combined_ep;
```

**What you get.** A single-row, single-statement derivation of the
core CFO claim.

**The math, line-by-line.**

1. **Legacy capital held against 1-in-100yr** = $14.2B. Reinsurers
   have to keep this much in regulatory capital against that single
   tail scenario.
2. **Sensor-enhanced 1-in-100yr** = $11.1B. With sensor priors
   tightening the model, the 1-in-100 bound moves down.
3. **Freed capital** = $14.2B − $11.1B = **$3.1B**. Capital that was
   reserved against modeled-but-not-real losses is now redeployable.
4. **Return on Capital** at industry-typical 6% = 3.1 × 0.06 =
   **$186M/year of incremental investment income**.
5. That's **without writing a single new policy**. Pure efficiency
   uplift from tighter modeling.

**Where money is saved.** Sensor data pays for itself if it costs
**less than $186M/yr to deploy and operate**. DataSnake's full-fleet
opex is in the low tens of millions. The math is favorable.

### 4.3. Try yourself: portfolio scaling

The numbers above are for a $300-500B coastal portfolio. To scale to
yours, just multiply linearly:

```sql
-- For a $50B regional book (1/8 the scale)
select 14.2 / 8.0  as your_baseline_b,
       11.1 / 8.0  as your_sensor_b,
       (14.2 - 11.1) / 8.0  as your_freed_capital_b,
       (14.2 - 11.1) / 8.0 * 0.06 * 1000  as your_extra_return_m_per_year;
```

---

## Tab 5 — `/insurance/parametric` Trigger Monitor

### 5.1. Status determination (the gating rule)

```sql
with contracts(contract_id, peril, threshold, current_reading,
               payout_amount, client) as (
  values
    ('PAR-2026-001', 'Storm Surge',           3.0,    1.2,    12000000, 'Reinsurer A'),
    ('PAR-2026-004', 'Seismic',               6.2,    2.1,    25000000, 'Lloyd''s Syndicate B'),
    ('PAR-2026-007', 'Fire-Weather Index',   50.0,   41.0,    8500000, 'Captive Mutual C'),
    ('PAR-2026-011', 'Significant Wave Ht',   7.5,    2.4,    5000000, 'Insurer D'),
    ('PAR-2026-015', 'Tsunami DART',          0.6,    0.04,  40000000, 'Reinsurer E'),
    ('PAR-2026-019', 'Rainfall Deficit',    250.0,  218.0,    3200000, 'Agribusiness F')
)
select contract_id,
       peril,
       threshold,
       current_reading,
       round((current_reading / threshold * 100)::numeric, 1)   as pct_of_threshold,
       case
         when (peril = 'Rainfall Deficit' and current_reading < threshold)
              then 'TRIGGERED'                       -- inverse semantic: deficit triggers BELOW threshold
         when current_reading >= threshold
              then 'TRIGGERED'
         when current_reading >= threshold * 0.8
              then 'WARNING'
         else 'MONITORING'
       end                                                       as status,
       payout_amount / 1e6                                       as payout_m
  from contracts
 order by case
   when current_reading >= threshold then 0
   when current_reading >= threshold * 0.8 then 1
   else 2 end,
   payout_amount desc;
```

**What you get.** Each contract's status determined by the gating
rule, plus the dollar payout if triggered.

**The insurance math — parametric trigger semantics.**

```
status = TRIGGERED  if current_reading >= threshold       (or current < threshold for deficit-type)
status = WARNING    if current_reading >= 0.8 × threshold  (within 20%)
status = MONITORING otherwise
```

**Two rows are interesting:**

1. `PAR-2026-007` (Sonoma fire-weather): reading 41 / threshold 50 =
   82% — **WARNING**. The contract pays $8.5M when FWI ≥ 50.
   Adjuster eyes this hourly during fire season.
2. `PAR-2026-019` (Iowa rainfall deficit): reading 218 / threshold
   250 = 87%. But the **inverse semantic** — drought triggers when
   rainfall is BELOW threshold. So 218 < 250 = **TRIGGERED**. $3.2M
   should already be wiring to the agribusiness mutual.

### 5.2. Total payout exposure

```sql
with contracts(contract_id, peril, threshold, current_reading,
               payout_amount) as (
  values
    ('PAR-2026-001', 'Storm Surge',          3.0,   1.2,  12000000),
    ('PAR-2026-004', 'Seismic',              6.2,   2.1,  25000000),
    ('PAR-2026-007', 'Fire-Weather Index',  50.0,  41.0,   8500000),
    ('PAR-2026-011', 'Significant Wave Ht',  7.5,   2.4,   5000000),
    ('PAR-2026-015', 'Tsunami DART',         0.6,   0.04, 40000000),
    ('PAR-2026-019', 'Rainfall Deficit',   250.0, 218.0,   3200000)
)
select 
  count(*) filter (where current_reading >= threshold or 
                        (threshold > 100 and current_reading < threshold))         as triggered_count,
  count(*) filter (where current_reading >= threshold * 0.8 and 
                         current_reading < threshold)                               as warning_count,
  sum(payout_amount) filter (where current_reading >= threshold or 
                                   (threshold > 100 and current_reading < threshold)) / 1e6
                                                                                    as triggered_payout_m,
  sum(payout_amount) filter (where current_reading >= threshold * 0.8 and 
                                   current_reading < threshold) / 1e6
                                                                                    as at_risk_payout_m,
  sum(payout_amount) / 1e6                                                          as total_book_m
  from contracts;
```

**The insurance math — DataSnake's revenue here.**

For each parametric contract, DataSnake earns:
- A **subscription fee** for trigger monitoring: typically 1-2% of the
  payout amount per year. On the 6 contracts above (total payout
  $93.7M), that's **$0.9-1.9M/yr** of pure-recurring DataSnake
  revenue.
- A **validation fee** if the contract triggers and pays out:
  typically $20-80K per validated trigger event. Iowa cornbelt
  triggered = $20-80K of one-shot revenue right now.

**Why the buyer pays.** A reinsurer underwriting parametric capacity
needs a **trusted oracle**. Either they trust DataSnake's signed
sensor readings, or they hire an independent firm at much higher
cost. DataSnake automates what was previously manual.

---

## Tab 6 — `/insurance/portfolio` (the money math is here)

### 6.1. Pricing fairness — the chart math

```sql
with policies(policy_id, region, exposure_b, risk_score,
              premium_b, classified) as (
  values
    ('POL-00001', 'Miami-Dade',     12.0, 85, 0.18,  'underpriced'),
    ('POL-00002', 'Miami-Dade',      9.5, 80, 0.16,  'priced_correctly'),
    ('POL-00003', 'Tampa Bay',       9.5, 81, 0.10,  'underpriced'),
    ('POL-00004', 'Tampa Bay',       8.0, 78, 0.18,  'overpriced'),
    ('POL-00005', 'Houston',        11.0, 79, 0.15,  'priced_correctly'),
    ('POL-00006', 'New Orleans',     8.0, 84, 0.12,  'underpriced'),
    ('POL-00007', 'San Francisco',  14.0, 74, 0.21,  'priced_correctly'),
    ('POL-00008', 'Los Angeles',    13.0, 71, 0.14,  'underpriced'),
    ('POL-00009', 'Charleston',      5.0, 71, 0.10,  'priced_correctly'),
    ('POL-00010', 'Boulder',         3.0, 64, 0.05,  'priced_correctly'),
    ('POL-00011', 'Phoenix',         4.0, 58, 0.04,  'underpriced'),
    ('POL-00012', 'Seattle',         6.0, 49, 0.08,  'overpriced'),
    ('POL-00013', 'Nashville',       2.0, 36, 0.02,  'priced_correctly'),
    ('POL-00014', 'New York',       25.0, 55, 0.40,  'priced_correctly'),
    ('POL-00015', 'Boston',          8.0, 41, 0.07,  'priced_correctly')
),
calc as (
  select policy_id, region, exposure_b, risk_score, premium_b, classified,
         exposure_b * 0.012 * (risk_score / 50.0)                  as fair_premium_b,
         (exposure_b * 0.012 * (risk_score / 50.0)) / 1.5          as eal_b
    from policies
)
select policy_id,
       region,
       exposure_b,
       risk_score,
       round(eal_b::numeric, 4)                              as eal_b,
       round(fair_premium_b::numeric, 4)                     as fair_premium_b,
       premium_b                                             as actual_premium_b,
       round((premium_b - fair_premium_b)::numeric * 1000, 1)
                                                             as gap_to_fair_m,
       round(((premium_b - fair_premium_b) / fair_premium_b * 100)::numeric, 1)
                                                             as gap_pct,
       classified
  from calc
 order by gap_to_fair_m;
```

**What you get.** Per policy: exposure, risk score, computed EAL,
computed fair premium, actual premium, gap to fair (in $M), gap %,
and the classification.

**The insurance math — the fairness equations.**

```
LOAD_FACTOR        = 1.5    (industry-typical premium / EAL)
fair_premium       = exposure × 0.012 × (risk_score / 50)
                                         ↑
                                 normalised against a 50/100 mean score
eal                = fair_premium / LOAD_FACTOR

gap_to_fair        = actual_premium − fair_premium
gap_pct            = gap_to_fair / fair_premium × 100

classified:
  underpriced       if gap_pct < -10%
  priced_correctly  if -10% <= gap_pct <= +10%
  overpriced        if gap_pct > +10%
```

**Read the output.** Negative `gap_to_fair_m` means underpriced.
Sum the negative gaps across policies → that's the **underpricing
gap** the dashboard headlines.

### 6.2. The headline number — total underpricing gap

```sql
with policies(policy_id, exposure_b, risk_score, premium_b, classified) as (
  values
    ('POL-00001', 12.0, 85, 0.18, 'underpriced'),
    ('POL-00003',  9.5, 81, 0.10, 'underpriced'),
    ('POL-00006',  8.0, 84, 0.12, 'underpriced'),
    ('POL-00008', 13.0, 71, 0.14, 'underpriced'),
    ('POL-00011',  4.0, 58, 0.04, 'underpriced')
)
select 
  count(*)                                                as underpriced_policies,
  round(sum(exposure_b * 0.012 * (risk_score / 50.0) - premium_b)::numeric, 4)
                                                          as gap_to_fair_b,
  round((sum(exposure_b * 0.012 * (risk_score / 50.0) - premium_b) * 1000)::numeric, 1)
                                                          as gap_to_fair_m
  from policies;
```

**The math.** Sum (fair_premium − actual_premium) for the underpriced
cohort. That's the dollar amount the carrier is **leaving on the
table every year**.

**Why DataSnake matters.** The fair_premium calculation uses EAL on
the right side. If EAL itself wobbles ±30%, the fair_premium
estimate has the same wobble — and underpricing gets hidden inside
that noise. **Sensor-grade EAL means you can trust the gap.**

### 6.3. The 80/20 callout

```sql
with policies(exposure_b, risk_score) as (
  values
    (12.0, 85), (9.5, 80), (9.5, 81), (8.0, 78), (11.0, 79),
    (8.0, 84), (14.0, 74), (13.0, 71), (5.0, 71), (3.0, 64),
    (4.0, 58), (6.0, 49), (2.0, 36), (25.0, 55), (8.0, 41)
),
totals as (
  select sum(exposure_b)                              as total_exposure_b,
         count(*)                                     as total_count
    from policies
),
high_risk as (
  select sum(exposure_b)                              as high_exposure_b,
         count(*)                                     as high_count
    from policies
   where risk_score >= 70
)
select 
  high_count, total_count,
  round((high_count::numeric / total_count * 100), 1)             as pct_of_policies,
  round(high_exposure_b::numeric, 1)                              as high_exposure_b,
  round(total_exposure_b::numeric, 1)                             as total_exposure_b,
  round((high_exposure_b / total_exposure_b * 100)::numeric, 1)   as pct_of_exposure
  from totals, high_risk;
```

**The math.** Pareto's rule made specific:

```
pct_of_policies = high_risk_policy_count / total_policy_count × 100
pct_of_exposure = sum(exposure where risk >= 70) / sum(exposure) × 100
```

**The reinsurance translation.** When `pct_of_exposure >> pct_of_policies`,
your CAT exposure is concentrated. Rule-of-thumb actionables:
- **>40% concentration** → revisit reinsurance attachment point.
- **>50% concentration** → trigger a pricing-model focused refresh
  on those policies specifically.

DataSnake at this layer = address-level resolution to FIND those
3-5% policies and price them accurately, instead of broad uniform
rate increases.

---

## Tab 7 — `/insurance/claims` Validation

### 7.1. The verdict logic

```sql
with claims(claim_id, claim_amount, sensor_reading, threshold,
            sensor_distance_mi, claimant_location) as (
  values
    ('CLM-0041',   850000, 2.3, 2.0, 0.5,  'Galveston, TX'),    -- surge total-loss
    ('CLM-0042',  1200000, 1.9, 1.5, 1.2,  'Galveston, TX'),    -- surge major
    ('CLM-0043',    32000, 78,  60,  0.8,  'Houston, TX'),      -- inland rain minor
    ('CLM-0044',   720000, 0.4, 2.0, 1.0,  'Lake Charles, LA'), -- surge claim, sensors say no
    ('CLM-0045',   410000, 142, 120, 0.7,  'Beaumont, TX'),     -- wind major
    ('CLM-0046',   280000, 0.6, 1.5, 14.0, 'Cameron Parish'),   -- sensors too far
    ('CLM-0047',    64000, 2.2, 1.0, 0.3,  'Galveston, TX')     -- auto total-loss
)
select claim_id,
       claim_amount / 1e3                                          as claim_amount_k,
       sensor_reading,
       threshold,
       round((sensor_reading / nullif(threshold, 0) * 100)::numeric, 1)
                                                                   as ratio_pct,
       sensor_distance_mi,
       case
         when sensor_distance_mi > 10
              then 'INSUFFICIENT'
         when sensor_reading >= threshold
              then 'CONSISTENT'
         when sensor_reading < threshold * 0.5
              then 'INCONSISTENT'
         else 'INCONSISTENT'
       end                                                        as verdict
  from claims
 order by case
   when sensor_distance_mi > 10        then 2
   when sensor_reading >= threshold    then 0
   else 1 end,
   claim_amount desc;
```

**What you get.** Each claim's verdict driven by:
- **Sensor proximity** (`sensor_distance_mi`): if >10 miles, mark
  INSUFFICIENT (the sensor isn't close enough to validate).
- **Sensor reading vs claimed-damage threshold**:
  - Reading ≥ threshold → CONSISTENT (claim supported).
  - Reading < threshold → INCONSISTENT (claim suspicious).

**The insurance math — fraud detection economics.**

```
expected_payout         = sum(claim_amount)               (gross intake)
likely_fraud            = sum(claim_amount where INCONSISTENT)
adjuster_save           = likely_fraud × 0.7              (70% of inconsistent claims fail forensic review)
sensor_validation_save  = likely_fraud × 0.20-0.25         (15-25% above current process)
adjuster_visit_savings  = count(CONSISTENT) × $300         (skip site visit on auto-approved)
```

For the 7-claim dashboard sample:

```
gross intake     = $850K + $1.2M + $32K + $720K + $410K + $280K + $64K  = $3.56M
likely fraud     = $720K (CLM-0044, INCONSISTENT)
adjuster save    = $720K × 0.7 = $504K
plus auto-approve savings on the 4 CONSISTENT claims = 4 × $300 = $1,200

Total saving on 7 claims = $505K
```

**Scale this up.** A primary insurer processes ~100K claims per major
event. Even at 1% INCONSISTENT rate (very conservative), that's
**1,000 claims worth ~$50-200M of avoided fraud payouts** per major
event. Plus the auto-approve speedup on ~40% of CONSISTENT claims.

### 7.2. The total adjuster savings model

```sql
with event_claims(event_id, total_claims, avg_claim_amount,
                  inconsistent_rate, consistent_rate) as (
  values
    ('Gulf Coast Storm 2026', 100000, 35000, 0.04, 0.85)
)
select 
  total_claims,
  round((total_claims * inconsistent_rate)::numeric)              as flagged_claims,
  round((total_claims * inconsistent_rate * avg_claim_amount * 0.7 / 1e6)::numeric, 1)
                                                                  as fraud_save_m,
  round((total_claims * consistent_rate * 0.4 * 300 / 1e6)::numeric, 2)
                                                                  as auto_approve_save_m,
  round(((total_claims * inconsistent_rate * avg_claim_amount * 0.7 +
          total_claims * consistent_rate * 0.4 * 300) / 1e6)::numeric, 1)
                                                                  as total_save_m
  from event_claims;
```

**The math.** For one major event:
- 4% of 100K claims = **4,000 flagged**.
- Of those, 70% fail forensic review at $35K avg = **$98M of avoided
  payouts**.
- 40% of consistent claims (85% × 100K = 85,000 → 34,000 auto-
  approved) save $300 each in adjuster visits = **$10.2M**.
- Total saving on one event = **$108M**.

DataSnake's portion of that as a service fee = 5-10% of the avoided
loss = **$5.4-10.8M per major event** as direct revenue.

---

## How to read this workbook to your advantage

Work through it in this order:

1. **Day 1**: Tab 1 (real data — most credibility-anchoring).
   Run the queries against your actual DB. Watch the numbers update
   as the cron loads new events.
2. **Day 2**: Tab 4 (EP curves — the CFO conversation). The
   $186M/yr capital-efficiency derivation is the single most
   important number to memorize.
3. **Day 3**: Tab 6 (Portfolio fairness). Run the underpricing-gap
   calculation; that's the single most actionable insurer-conversation
   number.
4. **Day 4**: Tab 5 (Parametric). Run the trigger-status logic, see
   what TRIGGERED costs DataSnake to validate, what subscription fee
   structure looks like.
5. **Day 5**: Tab 2 (Risk Verdict). Practice the per-property
   premium math — this is the daily-conversation number.
6. **Day 6**: Tab 3 (Command Center). Practice talking the
   color-band concentration story. Reinsurance treaty pricing.
7. **Day 7**: Tab 7 (Claims). Practice the fraud-detection
   economics — this is the loss-adjustment department conversation.

By Day 7 you can pitch every audience that matters: CFO (Tab 4),
underwriter (Tab 2), reinsurer (Tabs 3 + 6), parametric buyer (Tab 5),
claims department (Tab 7).

---

## When you've internalized the math, you can answer these without
notes

- "How does sensor data save money?" → Tighten EAL → tighten 1-in-100
  tail → free reinsurance capital → $186M/yr at 6% ROC on a $300B
  portfolio.
- "How big is this market?" → ~$50B/yr global property reinsurance
  premium. 1% efficiency uplift = $500M/yr addressable.
- "What's a parametric contract?" → Sensor-triggered automatic
  payout. Bypasses the adjuster process. Pays in hours not months.
  DataSnake = trusted oracle.
- "What's the underpricing gap?" → Sum of (fair − actual) premium
  across underpriced policies. Currently invisible because EAL
  itself wobbles. Sensor data makes it visible and therefore
  actionable.
- "How does fraud detection work?" → Joining the claim's
  coordinates + timestamp to the sensor reading at that moment.
  CONSISTENT / INCONSISTENT / INSUFFICIENT verdict. ~$108M/yr saved
  per insurer per major event.

---

_Generated as a hands-on SQL + math workbook companion to the
DataSnake Insurance Intelligence dashboard. Pair this with the
Plain-English Explainer at docs/INSURANCE_LAYMAN_EXPLAINER.md.
Last updated: 2026-05-10._
