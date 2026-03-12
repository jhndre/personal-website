import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  apiDataToWorkouts,
  getWhoopLatestSummary,
  type WhoopApiData,
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

interface WhoopSectionProps {
  data: WhoopApiData | null
}

export default function WhoopSection({ data }: WhoopSectionProps) {
  const [showDetails, setShowDetails] = useState(false)

  const summary = getWhoopLatestSummary(data)
  const workouts = data ? apiDataToWorkouts(data) : []
  const hasData = (data?.recoveries?.length ?? 0) > 0 || (data?.sleeps?.length ?? 0) > 0 || workouts.length > 0

  const activityCounts = workouts.reduce<Record<string, number>>((acc, w) => {
    acc[w.sportName] = (acc[w.sportName] ?? 0) + 1
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
    <section className="mb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-0.5">
        <h2 className="text-sm font-light text-[rgb(135,135,135)] tracking-tight">whoop</h2>
        <Link
          to="/whoop"
          className="text-xs text-[rgb(135,135,135)] hover:text-[#c4a8ff] transition-colors border-b border-dashed border-[#444] hover:border-[#c4a8ff]"
        >
          full view →
        </Link>
      </div>
      {data?.fetchedAt && (
        <p className="text-[rgb(135,135,135)] text-sm mb-4">last updated {formatLastUpdated(data.fetchedAt)}</p>
      )}

      <div className="flex flex-wrap gap-8 mb-6">
        <div>
          <div className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-0.5">Sleep</div>
          <div className="text-xl font-semibold text-[#f5f5f0]">
            {summary.sleepPct != null ? `${summary.sleepPct}%` : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-0.5">Recovery</div>
          <div className="text-xl font-semibold text-[#f5f5f0]">
            {summary.recoveryPct != null ? `${summary.recoveryPct}%` : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-0.5">Strain</div>
          <div className="text-xl font-semibold text-[#f5f5f0]">
            {summary.strain != null ? summary.strain.toFixed(1) : '—'}
          </div>
        </div>
      </div>

      {workouts.length > 0 && (
        <>
          <h3 className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-3">
            Activities (last 7 days)
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
            {activityEntries.map(([name, count]) => (
              <span key={name} className="flex items-center gap-1.5 text-sm text-[rgb(135,135,135)]">
                <span>{sportIcon(name)}</span>
                <span className="text-[#e0e0e0]">{name.replace(/-/g, ' ')}</span>
                <span>×{count}</span>
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs text-[rgb(135,135,135)] hover:text-[#c4a8ff] transition-colors mb-3"
          >
            {showDetails ? 'hide details' : 'show details'} {showDetails ? '−' : '+'}
          </button>
          {showDetails && zoneTotal > 0 && (
            <div className="flex items-center gap-6 mb-6">
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
              <div className="text-sm text-[rgb(135,135,135)]">
                <div className="text-[#c4a8ff]">
                  Zone 1–3: {zone13Pct}% · {formatZoneHours(zone13Hours)}
                </div>
                <div>Zone 4–5: {zone45Pct}% · {formatZoneHours(zone45Hours)}</div>
              </div>
            </div>
          )}

          <h3 className="text-xs text-[rgb(135,135,135)] uppercase tracking-wide mb-3">By day</h3>
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

      {hasData && workouts.length === 0 && (
        <p className="text-[rgb(135,135,135)] text-sm">No workouts in the last 7 days.</p>
      )}

      {!hasData && (
        <p className="text-[rgb(135,135,135)] text-sm">
          Data loads from <code className="text-[#555]">/api/whoop</code> or <code className="text-[#555]">whoop-data.json</code>.
        </p>
      )}
    </section>
  )
}
