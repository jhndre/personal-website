/**
 * Normalize CSV headers: lowercase, strip BOM, common renames.
 */
function get(row: Record<string, string>, ...keys: string[]): string {
  const lower: Record<string, string> = {}
  for (const k of Object.keys(row)) {
    lower[k.toLowerCase().replace(/\s+/g, '_').replace(/^[\uFEFF]+/, '')] = row[k]
  }
  for (const key of keys) {
    const v = lower[key] ?? lower[key.replace(/_/g, ' ')]
    if (v !== undefined && v !== '') return v
  }
  return ''
}

export interface WhoopCycle {
  date: string
  recovery: number
  strain: number
  rhr: number
  hrv: number
}

export interface WhoopSleep {
  date: string
  durationHours: number
  score: number
  efficiency: number
}

/**
 * Parse physiological_cycles (or combined) CSV into cycles.
 */
export function parseCycles(rows: Record<string, string>[]): WhoopCycle[] {
  const cycles: WhoopCycle[] = []
  for (const row of rows) {
    const date =
      get(row, 'cycle_start', 'cycle_start_date', 'date', 'start', 'created_at') ||
      get(row, 'day', 'cycle_day')
    const recovery = parseFloat(get(row, 'recovery', 'recovery_score', 'recovery_score')) || 0
    const strain = parseFloat(get(row, 'strain', 'day_strain', 'strain_score')) || 0
    const rhr = parseFloat(get(row, 'rhr', 'resting_heart_rate', 'resting_hr')) || 0
    const hrv = parseFloat(get(row, 'hrv', 'hrv_rmssd_milli', 'hrv_rmssd')) || 0
    if (!date && !recovery && !strain) continue
    cycles.push({
      date: date || 'Unknown',
      recovery: Number.isNaN(recovery) ? 0 : recovery,
      strain: Number.isNaN(strain) ? 0 : strain,
      rhr: Number.isNaN(rhr) ? 0 : rhr,
      hrv: Number.isNaN(hrv) ? 0 : hrv,
    })
  }
  return cycles.sort((a, b) => (b.date < a.date ? -1 : 1))
}

/**
 * Parse sleeps CSV into sleep records.
 */
export function parseSleeps(rows: Record<string, string>[]): WhoopSleep[] {
  const sleeps: WhoopSleep[] = []
  for (const row of rows) {
    const start = get(row, 'start', 'start_time', 'sleep_onset', 'date')
    const end = get(row, 'end', 'end_time', 'wake_onset')
    const nap = get(row, 'nap', 'is_nap').toLowerCase()
    if (nap === 'true' || nap === '1') continue // skip naps for main list
    let durationHours = 0
    const duration = get(row, 'duration_hours', 'hours_of_sleep', 'total_sleep_time', 'total_in_bed_time_milli')
    if (duration) {
      const n = parseFloat(duration)
      durationHours = n > 100 ? n / (1000 * 60 * 60) : n // assume milli if large
    }
    const score = parseFloat(get(row, 'score', 'sleep_score', 'sleep_performance_percentage', 'overall_score')) || 0
    const efficiency = parseFloat(get(row, 'sleep_efficiency', 'sleep_efficiency_percentage', 'efficiency')) || 0
    if (!start && !durationHours && !score) continue
    sleeps.push({
      date: start || end || 'Unknown',
      durationHours: Number.isNaN(durationHours) ? 0 : durationHours,
      score: Number.isNaN(score) ? 0 : score,
      efficiency: Number.isNaN(efficiency) ? 0 : efficiency,
    })
  }
  return sleeps.sort((a, b) => (b.date < a.date ? -1 : 1))
}

export function guessCsvType(headerRow: string): 'cycles' | 'sleeps' | 'unknown' {
  const h = headerRow.toLowerCase()
  if (h.includes('recovery') || h.includes('strain') || h.includes('cycle')) return 'cycles'
  if (h.includes('sleep') || h.includes('onset') || h.includes('nap')) return 'sleeps'
  return 'unknown'
}

/**
 * Fetch WHOOP data: tries /api/whoop (Vercel KV) then /whoop-data.json (static).
 */
export async function fetchWhoopData(): Promise<WhoopApiData | null> {
  try {
    const r = await fetch('/api/whoop')
    if (r.ok) return await r.json()
    const r2 = await fetch('/whoop-data.json')
    return r2.ok ? await r2.json() : null
  } catch {
    return null
  }
}

/** Shape of public/whoop-data.json from scripts/whoop-fetch.js */
export interface WhoopApiData {
  fetchedAt?: string
  latest?: {
    recovery?: WhoopApiRecovery
    sleep?: WhoopApiSleep
    cycle?: WhoopApiCycle & { score?: { strain?: number } }
  }
  recoveries?: WhoopApiRecovery[]
  sleeps?: WhoopApiSleep[]
  cycles?: WhoopApiCycle[]
  workouts?: WhoopApiWorkout[]
}

export interface WhoopApiWorkout {
  id?: string
  start?: string
  end?: string
  sport_name?: string
  score_state?: string
  score?: {
    average_heart_rate?: number
    zone_durations?: {
      zone_one_milli?: number
      zone_two_milli?: number
      zone_three_milli?: number
      zone_four_milli?: number
      zone_five_milli?: number
    }
  }
}

interface WhoopApiRecovery {
  cycle_id?: number
  created_at?: string
  score_state?: string
  score?: {
    recovery_score?: number
    resting_heart_rate?: number
    hrv_rmssd_milli?: number
  }
}

interface WhoopApiCycle {
  id?: number
  cycle_id?: number
  start?: string
  end?: string
  strain?: number
  score?: { strain?: number }
  kilojoule?: number
}

interface WhoopApiSleep {
  start?: string
  end?: string
  nap?: boolean
  score_state?: string
  score?: {
    stage_summary?: { total_in_bed_time_milli?: number }
    sleep_performance_percentage?: number
    sleep_efficiency_percentage?: number
  }
}

/** Convert API recoveries + cycles into WhoopCycle[] for the UI */
export function apiDataToCycles(data: WhoopApiData): WhoopCycle[] {
  const recoveries = data.recoveries ?? []
  const cyclesById = new Map<number, WhoopApiCycle>()
  for (const c of data.cycles ?? []) {
    const id = c.cycle_id ?? c.id
    if (id != null) cyclesById.set(id, c)
  }

  return recoveries
    .filter((r) => r.score_state === 'SCORED' && r.score)
    .map((r) => {
      const score = r.score!
      const cycle = r.cycle_id != null ? cyclesById.get(r.cycle_id) : undefined
      const date = r.created_at ?? cycle?.start ?? ''
      return {
        date,
        recovery: score.recovery_score ?? 0,
        strain: cycle?.score?.strain ?? cycle?.strain ?? 0,
        rhr: score.resting_heart_rate ?? 0,
        hrv: score.hrv_rmssd_milli ?? 0,
      }
    })
    .sort((a, b) => (b.date < a.date ? -1 : 1))
}

/** Convert API sleeps into WhoopSleep[] for the UI */
export function apiDataToSleeps(data: WhoopApiData): WhoopSleep[] {
  return (data.sleeps ?? [])
    .filter((s) => !s.nap && s.score_state === 'SCORED' && s.score)
    .map((s) => {
      const score = s.score!
      const milli = score.stage_summary?.total_in_bed_time_milli ?? 0
      return {
        date: s.start ?? s.end ?? 'Unknown',
        durationHours: milli / (1000 * 60 * 60),
        score: score.sleep_performance_percentage ?? 0,
        efficiency: score.sleep_efficiency_percentage ?? 0,
      }
    })
    .sort((a, b) => (b.date < a.date ? -1 : 1))
}

/** Normalized workout for the activities UI */
export interface WhoopWorkoutRow {
  start: string
  dateKey: string // YYYY-MM-DD for grouping
  sportName: string
  durationMinutes: number
  averageHeartRate: number
  zoneOneThreeMilli: number
  zoneFourFiveMilli: number
}

/** Convert API workouts into WhoopWorkoutRow[] (last 7 days by start date) */
export function apiDataToWorkouts(data: WhoopApiData): WhoopWorkoutRow[] {
  const workouts = data.workouts ?? []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  return workouts
    .filter((w) => w.score_state === 'SCORED' && (w.start || w.end))
    .map((w) => {
      const start = w.start ?? w.end ?? ''
      const startDate = new Date(start)
      const endDate = w.end ? new Date(w.end) : startDate
      const durationMs = endDate.getTime() - startDate.getTime()
      const durationMinutes = Math.round(durationMs / (1000 * 60))
      const zd = w.score?.zone_durations ?? {}
      const z1 = zd.zone_one_milli ?? 0
      const z2 = zd.zone_two_milli ?? 0
      const z3 = zd.zone_three_milli ?? 0
      const z4 = zd.zone_four_milli ?? 0
      const z5 = zd.zone_five_milli ?? 0
      const dateKey = start.slice(0, 10)
      return {
        start,
        dateKey,
        sportName: w.sport_name ?? 'activity',
        durationMinutes,
        averageHeartRate: w.score?.average_heart_rate ?? 0,
        zoneOneThreeMilli: z1 + z2 + z3,
        zoneFourFiveMilli: z4 + z5,
      }
    })
    .filter((w) => new Date(w.start).getTime() >= cutoff.getTime())
    .sort((a, b) => (b.start < a.start ? -1 : 1))
}

/** Get latest sleep %, recovery %, strain from API data (uses latest or first of arrays) */
export function getWhoopLatestSummary(data: WhoopApiData | null): {
  sleepPct: number | null
  recoveryPct: number | null
  strain: number | null
} {
  if (!data) return { sleepPct: null, recoveryPct: null, strain: null }
  const sleep = data.latest?.sleep ?? data.sleeps?.[0]
  const recovery = data.latest?.recovery ?? data.recoveries?.[0]
  const cycle = data.latest?.cycle ?? data.cycles?.[0]
  return {
    sleepPct: sleep?.score?.sleep_performance_percentage ?? null,
    recoveryPct: recovery?.score?.recovery_score ?? null,
    strain: cycle?.score?.strain ?? cycle?.strain ?? null,
  }
}
