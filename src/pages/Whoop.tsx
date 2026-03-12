import { Link } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import Footer from '../Footer'
import { parseCsv } from '../lib/csv'
import {
  fetchWhoopData,
  parseCycles,
  parseSleeps,
  guessCsvType,
  apiDataToCycles,
  apiDataToSleeps,
  apiDataToWorkouts,
  getWhoopLatestSummary,
  type WhoopCycle,
  type WhoopSleep,
  type WhoopWorkoutRow,
} from '../lib/whoop'

const SPORT_ICONS: Record<string, string> = {
  cycling: '🚴',
  running: '🏃',
  weightlifting: '🏋️',
  'weightlifting_msk': '🏋️',
  swimming: '🏊',
  tennis: '🎾',
  'muay-thai': '🥊',
  golf: '⛳',
  powerlifting: '🏋️',
  activity: '●',
}
function sportIcon(sportName: string): string {
  return SPORT_ICONS[sportName.toLowerCase()] ?? '●'
}

function formatLastUpdated(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default function Whoop() {
  const [cycles, setCycles] = useState<WhoopCycle[]>([])
  const [sleeps, setSleeps] = useState<WhoopSleep[]>([])
  const [workouts, setWorkouts] = useState<WhoopWorkoutRow[]>([])
  const [summary, setSummary] = useState<{ sleepPct: number | null; recoveryPct: number | null; strain: number | null }>({
    sleepPct: null,
    recoveryPct: null,
    strain: null,
  })
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = 'Whoop · Andre Kim'
    return () => { document.title = 'Andre Kim' }
  }, [])

  useEffect(() => {
    fetchWhoopData().then((data) => {
      if (!data) return
      if (data.recoveries || data.sleeps || data.workouts) {
        setCycles(apiDataToCycles(data))
        setSleeps(apiDataToSleeps(data))
        setWorkouts(apiDataToWorkouts(data))
        setSummary(getWhoopLatestSummary(data))
        if (data.fetchedAt) setFetchedAt(data.fetchedAt)
      }
    })
  }, [])

  const processFile = useCallback(async (file: File) => {
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) return
    const header = Object.keys(rows[0]).join(',').toLowerCase()
    const type = guessCsvType(header)
    if (type === 'cycles') {
      setCycles((prev) => {
        const next = parseCycles(rows)
        const byDate = new Map(prev.map((c) => [c.date, c]))
        next.forEach((c) => byDate.set(c.date, c))
        return [...byDate.values()].sort((a, b) => (b.date < a.date ? -1 : 1))
      })
    } else if (type === 'sleeps') {
      setSleeps((prev) => {
        const next = parseSleeps(rows)
        const byDate = new Map(prev.map((s) => [s.date, s]))
        next.forEach((s) => byDate.set(s.date, s))
        return [...byDate.values()].sort((a, b) => (b.date < a.date ? -1 : 1))
      })
    }
  }, [])

  const onFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null)
      setLoading(true)
      const files = e.target.files
      if (!files?.length) {
        setLoading(false)
        return
      }
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          if (!file.name.endsWith('.csv')) continue
          await processFile(file)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse files')
      }
      setLoading(false)
      e.target.value = ''
    },
    [processFile]
  )

  const hasData = cycles.length > 0 || sleeps.length > 0 || workouts.length > 0

  const activityCounts = workouts.reduce<Record<string, number>>((acc, w) => {
    const name = w.sportName
    acc[name] = (acc[name] ?? 0) + 1
    return acc
  }, {})
  const activityEntries = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])

  const zone13 = workouts.reduce((s, w) => s + w.zoneOneThreeMilli, 0)
  const zone45 = workouts.reduce((s, w) => s + w.zoneFourFiveMilli, 0)
  const zoneTotal = zone13 + zone45
  const zone13Pct = zoneTotal > 0 ? Math.round((zone13 / zoneTotal) * 100) : 0
  const zone45Pct = zoneTotal > 0 ? Math.round((zone45 / zoneTotal) * 100) : 0
  const zone13Hours = zone13 / (1000 * 60 * 60)
  const zone45Hours = zone45 / (1000 * 60 * 60)
  const formatZoneHours = (h: number) => {
    if (h < 1) return `${Math.round(h * 60)}m`
    return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`
  }

  const workoutsByDay = workouts.reduce<Record<string, WhoopWorkoutRow[]>>((acc, w) => {
    if (!acc[w.dateKey]) acc[w.dateKey] = []
    acc[w.dateKey].push(w)
    return acc
  }, {})
  const sortedDays = Object.keys(workoutsByDay).sort((a, b) => (b < a ? -1 : 1))

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d0d] text-[#f5f5f0]">
      <div className="flex-1 max-w-[42rem] mx-auto px-6 py-16 w-full">
        <Link
          to="/"
          className="text-[rgb(135,135,135)] text-sm border-b border-dashed border-[#444] hover:border-[#c4a8ff] hover:text-[#af87ff] transition-colors inline-block mb-8"
        >
          ← back
        </Link>

        <h1 className="text-sm font-light text-[rgb(135,135,135)] tracking-tight mb-0.5">whoop</h1>
        {fetchedAt && (
          <p className="text-[rgb(135,135,135)] text-sm mb-6">last updated {formatLastUpdated(fetchedAt)}</p>
        )}

        <div className="flex flex-wrap gap-8 mb-8">
          <div>
            <div className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-0.5">Sleep</div>
            <div className="text-xl font-semibold">
              {summary.sleepPct != null ? `${summary.sleepPct}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-0.5">Recovery</div>
            <div className="text-xl font-semibold">
              {summary.recoveryPct != null ? `${summary.recoveryPct}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-0.5">Strain</div>
            <div className="text-xl font-semibold">
              {summary.strain != null ? summary.strain.toFixed(1) : '—'}
            </div>
          </div>
        </div>

        {workouts.length > 0 && (
          <>
            <h2 className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-3">
              Activities (last 7 days)
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6">
              {activityEntries.map(([name, count]) => (
                <span key={name} className="flex items-center gap-1.5 text-sm">
                  <span>{sportIcon(name)}</span>
                  <span className="text-[#e0e0e0]">{name.replace(/-/g, ' ')}</span>
                  <span className="text-[rgb(135,135,135)]">×{count}</span>
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs text-[rgb(135,135,135)] hover:text-[#c4a8ff] transition-colors mb-4"
            >
              {showDetails ? 'hide details' : 'show details'} {showDetails ? '−' : '+'}
            </button>
            {showDetails && zoneTotal > 0 && (
              <div className="flex items-center gap-6 mb-8">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="rgba(196,168,255,0.35)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#c4a8ff"
                      strokeWidth="4"
                      strokeDasharray={`${(zone13Pct / 100) * 88} 88`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="text-sm">
                  <div className="text-[#c4a8ff]">
                    Zone 1–3: {zone13Pct}% · {formatZoneHours(zone13Hours)}
                  </div>
                  <div className="text-[rgb(135,135,135)]">
                    Zone 4–5: {zone45Pct}% · {formatZoneHours(zone45Hours)}
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-3">By day</h2>
            <div className="space-y-5">
              {sortedDays.map((dateKey) => (
                <div key={dateKey}>
                  <div className="text-xs text-[rgb(135,135,135)] mb-2">
                    {formatDayHeader(workoutsByDay[dateKey][0].start)}
                  </div>
                  <ul className="space-y-1.5">
                    {workoutsByDay[dateKey].map((w) => (
                      <li key={w.start} className="flex items-center gap-2 text-sm">
                        <span>{sportIcon(w.sportName)}</span>
                        <span className="text-[#e0e0e0]">{w.sportName.replace(/-/g, ' ')}</span>
                        <span className="text-[rgb(135,135,135)]">
                          {formatDuration(w.durationMinutes)}
                          {w.averageHeartRate > 0 && ` · ${w.averageHeartRate}bpm avg`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}

        {hasData && workouts.length === 0 && (cycles.length > 0 || sleeps.length > 0) && (
          <p className="text-[rgb(135,135,135)] text-sm">
            No workouts in the last 7 days. Recovery and sleep data is from API.
          </p>
        )}

        <div className="mt-10 pt-6 border-t border-[#222]">
          <label className="inline-flex items-center gap-2 text-xs text-[#af87ff] cursor-pointer border border-[#444] hover:border-[#c4a8ff] px-4 py-2 rounded transition-colors">
            <span>Upload CSV (cycles/sleeps)</span>
            <input type="file" accept=".csv" multiple onChange={onFiles} className="sr-only" />
          </label>
          {loading && <span className="text-xs text-[rgb(135,135,135)] ml-2">Loading…</span>}
          {error && <p className="text-[#f87171] text-xs mt-2">{error}</p>}
        </div>

        {!hasData && !loading && (
          <p className="text-[rgb(135,135,135)] text-sm mt-6">
            Data loads from <code className="text-[#555]">/api/whoop</code> or{' '}
            <code className="text-[#555]">whoop-data.json</code>. Upload CSV as fallback.
          </p>
        )}
      </div>
      <Footer />
    </div>
  )
}
