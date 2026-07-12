<script setup lang="ts">
// TerraWatch — Phase 9.18.0: competitor matrix.
//
// Side-by-side comparison: DataSnake (today on public data) vs
// DataSnake (with proprietary sensors, future) vs First Street vs
// Zesty AI vs RMS vs raw FEMA. Each row is a defensible claim;
// matching MetricInfoPanel explainers back the prose.

interface Row {
  dimension: string
  firstStreet: string
  zestyAi:    string
  rms:        string
  ds_public:  string
  ds_full:    string
}

const rows: Row[] = [
  {
    dimension:   'Data type',
    firstStreet: 'Modeled risk scores',
    zestyAi:     'AI from aerial imagery',
    rms:         'Catastrophe models',
    ds_public:   'Live public-source ingest',
    ds_full:     '+ proprietary sensor measurements',
  },
  {
    dimension:   'Resolution',
    firstStreet: 'Address',
    zestyAi:     'Parcel',
    rms:         'Regional',
    ds_public:   '~100m (NOAA grid) → county (NRI)',
    ds_full:     '50-500m (point sensors)',
  },
  {
    dimension:   'Update cadence',
    firstStreet: 'Quarterly',
    zestyAi:     'Quarterly',
    rms:         'Quarterly',
    ds_public:   'Hourly (cron ingest)',
    ds_full:     'Continuous (10-min cron + uplink)',
  },
  {
    dimension:   'Pre-event signals',
    firstStreet: 'None',
    zestyAi:     'None',
    rms:         'None',
    ds_public:   'NWS alerts only',
    ds_full:     'Microseismic + tidal anomaly + soil saturation',
  },
  {
    dimension:   'Parametric-ready',
    firstStreet: 'No',
    zestyAi:     'No',
    rms:         'No',
    ds_public:   'Yes — live thresholds + audit log',
    ds_full:     'Yes — signed sensor data, defensible at reinsurance recovery',
  },
  {
    dimension:   'Reproducibility',
    firstStreet: 'Black-box',
    zestyAi:     'Black-box',
    rms:         'Black-box',
    ds_public:   'SQL queries published below every chart',
    ds_full:     'Same + ed25519-signed sensor rows',
  },
  {
    dimension:   'Proprietary moat',
    firstStreet: 'Model IP only',
    zestyAi:     'Model IP only',
    rms:         'Model IP only',
    ds_public:   'Open — anyone can replicate today',
    ds_full:     'Sensor network (capital + deployment)',
  },
  {
    dimension:   'Cost to evaluate',
    firstStreet: 'License required',
    zestyAi:     'License required',
    rms:         'License required',
    ds_public:   'Free — every chart on this section runs on public data',
    ds_full:     'Paid (proprietary tier)',
  },
]
</script>

<template>
  <section class="rounded-2xl border border-white/5 bg-surface-1 overflow-hidden">
    <header class="p-4 sm:p-5 border-b border-white/5">
      <p class="text-ink-muted text-[10px] uppercase tracking-widest">Differentiation</p>
      <h2 class="text-base sm:text-lg font-semibold text-ink-primary mt-1">
        DataSnake vs First Street / Zesty AI / RMS
      </h2>
      <p class="text-ink-muted text-sm mt-2 max-w-3xl">
        The same five use cases under each vendor's lens. The
        "DataSnake (public data)" column is what this section
        proves today — running on free NOAA / FEMA / USGS / NASA
        FIRMS data. The "DataSnake (proprietary)" column is the
        upsell once sensors deploy.
      </p>
    </header>
    <div class="overflow-x-auto">
      <table class="w-full text-sm border-collapse min-w-[840px]">
        <thead>
          <tr class="text-[10px] uppercase tracking-widest text-ink-muted/60 border-b border-white/5">
            <th class="text-left py-2 px-3 font-medium">Dimension</th>
            <th class="text-left py-2 px-3 font-medium">First Street</th>
            <th class="text-left py-2 px-3 font-medium">Zesty AI</th>
            <th class="text-left py-2 px-3 font-medium">RMS</th>
            <th class="text-left py-2 px-3 font-medium text-accent">DataSnake (public)</th>
            <th class="text-left py-2 px-3 font-medium text-caution">DataSnake (proprietary)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <tr v-for="r in rows" :key="r.dimension" class="text-ink-primary">
            <td class="py-2 px-3 font-medium text-xs">{{ r.dimension }}</td>
            <td class="py-2 px-3 text-xs text-ink-muted">{{ r.firstStreet }}</td>
            <td class="py-2 px-3 text-xs text-ink-muted">{{ r.zestyAi }}</td>
            <td class="py-2 px-3 text-xs text-ink-muted">{{ r.rms }}</td>
            <td class="py-2 px-3 text-xs text-accent">{{ r.ds_public }}</td>
            <td class="py-2 px-3 text-xs text-caution">{{ r.ds_full }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
