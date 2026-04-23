import type { DataSource } from '@/types/dataSource'
import type { LatLon } from '@/lib/geo'
import {
  getRecentQuakes,
  getHistoricalQuakes,
  getBboxQuakes,
  type Quake,
} from './usgs'
import { getForecast, type ForecastBundle } from './openMeteo'
import {
  getCurrentKp,
  getKpForecast3day,
  type KpSample,
} from './noaaKp'
import {
  getNearestStation,
  getTidePredictions,
  type TideStation,
  type TidePrediction,
} from './noaaTides'
import { searchPlaces, type Place } from './geocode'

interface RecentQuakesReq {
  center: LatLon
  radiusKm?: number
  sinceHours?: number
  minMagnitude?: number
}

interface HistoricalQuakesReq {
  center: LatLon
  radiusKm?: number
  years?: number
  minMagnitude?: number
}

interface BboxQuakesReq {
  center: LatLon
  radiusKm?: number
  minMagnitude?: number
}

interface ForecastReq {
  loc: LatLon
  days?: number
}

interface TidePredictionsReq {
  stationId: string
  start: Date
  end: Date
}

interface GeocodeReq {
  query: string
  limit?: number
}

export const sources = {
  seismicRecent: {
    id: 'usgs.quakes.recent',
    tier: 'public',
    cacheTtlMs: 10 * 60_000,
    fetch: (r: RecentQuakesReq) =>
      getRecentQuakes(r.center, r.radiusKm, r.sinceHours, r.minMagnitude),
  } satisfies DataSource<RecentQuakesReq, Quake[]>,

  seismicHistory: {
    id: 'usgs.quakes.historical',
    tier: 'public',
    cacheTtlMs: 24 * 60 * 60_000,
    fetch: (r: HistoricalQuakesReq) =>
      getHistoricalQuakes(r.center, r.radiusKm, r.years, r.minMagnitude),
  } satisfies DataSource<HistoricalQuakesReq, Quake[]>,

  seismicBbox: {
    id: 'usgs.quakes.bbox',
    tier: 'public',
    cacheTtlMs: 10 * 60_000,
    fetch: (r: BboxQuakesReq) =>
      getBboxQuakes(r.center, r.radiusKm, r.minMagnitude),
  } satisfies DataSource<BboxQuakesReq, Quake[]>,

  weatherForecast: {
    id: 'openmeteo.forecast',
    tier: 'public',
    cacheTtlMs: 30 * 60_000,
    fetch: (r: ForecastReq) => getForecast(r.loc, r.days),
  } satisfies DataSource<ForecastReq, ForecastBundle>,

  spaceWeatherNow: {
    id: 'noaa.swpc.kp.now',
    tier: 'public',
    cacheTtlMs: 10 * 60_000,
    fetch: () => getCurrentKp(),
  } satisfies DataSource<void, KpSample>,

  spaceWeatherForecast: {
    id: 'noaa.swpc.kp.forecast3',
    tier: 'public',
    cacheTtlMs: 60 * 60_000,
    fetch: () => getKpForecast3day(),
  } satisfies DataSource<void, KpSample[]>,

  tideStation: {
    id: 'noaa.coops.station',
    tier: 'public',
    cacheTtlMs: 24 * 60 * 60_000,
    fetch: (loc: LatLon) => getNearestStation(loc),
  } satisfies DataSource<LatLon, TideStation | null>,

  tidePredictions: {
    id: 'noaa.coops.predictions',
    tier: 'public',
    cacheTtlMs: 6 * 60 * 60_000,
    fetch: (r: TidePredictionsReq) =>
      getTidePredictions(r.stationId, r.start, r.end),
  } satisfies DataSource<TidePredictionsReq, TidePrediction[]>,

  geocode: {
    id: 'openmeteo.geocode',
    tier: 'public',
    cacheTtlMs: 24 * 60 * 60_000,
    fetch: (r: GeocodeReq) => searchPlaces(r.query, r.limit),
  } satisfies DataSource<GeocodeReq, Place[]>,
} as const

export type SourceRegistry = typeof sources
export type SourceId = SourceRegistry[keyof SourceRegistry]['id']
