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

/** Shape of public/whoop-data.json from scripts/whoop-fetch.js */
export interface WhoopApiData {
  fetchedAt?: string
  recoveries?: WhoopApiRecovery[]
  sleeps?: WhoopApiSleep[]
  cycles?: WhoopApiCycle[]
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
        strain: cycle?.strain ?? 0,
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
