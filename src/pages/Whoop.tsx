import { Link } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import Footer from '../Footer'
import { parseCsv } from '../lib/csv'
import {
  parseCycles,
  parseSleeps,
  guessCsvType,
  apiDataToCycles,
  apiDataToSleeps,
  type WhoopCycle,
  type WhoopSleep,
} from '../lib/whoop'

export default function Whoop() {
  const [cycles, setCycles] = useState<WhoopCycle[]>([])
  const [sleeps, setSleeps] = useState<WhoopSleep[]>([])
  const [apiFetchedAt, setApiFetchedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/whoop-data.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.recoveries || data?.sleeps) {
          setCycles(apiDataToCycles(data))
          setSleeps(apiDataToSleeps(data))
          if (data.fetchedAt) setApiFetchedAt(data.fetchedAt)
        }
      })
      .catch(() => {})
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

  const formatDate = (d: string) => {
    if (!d || d === 'Unknown') return '—'
    const date = new Date(d)
    return isNaN(date.getTime()) ? d : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const recoveryColor = (r: number) => {
    if (r >= 67) return 'text-[#4ade80]'
    if (r >= 34) return 'text-[#facc15]'
    return 'text-[#f87171]'
  }

  const hasData = cycles.length > 0 || sleeps.length > 0
  const displayCycles = cycles.slice(0, 14)
  const displaySleeps = sleeps.slice(0, 14)

  return (
    <div className="max-w-[42rem] mx-auto px-6 py-16">
      <Link
        to="/"
        className="text-[rgb(135,135,135)] text-sm border-b border-dashed border-[#444] hover:border-[#c4a8ff] hover:text-[#af87ff] transition-colors inline-block mb-12"
      >
        ← back
      </Link>

      <h1 className="text-base tracking-tight text-[rgb(135,135,135)] font-light mb-2">WHOOP</h1>
      <p className="text-[rgb(135,135,135)] text-sm mb-8">
        Data from <code className="text-[rgb(135,135,135)]">whoop-data.json</code> (run <code className="text-[rgb(135,135,135)]">npm run whoop:fetch</code> to refresh).
        Or upload CSV files from the app export below.
      </p>
      {apiFetchedAt && (
        <p className="text-[rgb(135,135,135)] text-xs mb-4">
          Last API fetch: {new Date(apiFetchedAt).toLocaleString()}
        </p>
      )}

      <label className="inline-flex items-center gap-2 text-xs text-[#af87ff] cursor-pointer border border-[#444] hover:border-[#c4a8ff] px-4 py-2 rounded transition-colors mb-8">
        <span>Choose CSV files</span>
        <input
          type="file"
          accept=".csv"
          multiple
          onChange={onFiles}
          className="sr-only"
        />
      </label>

      {loading && <p className="text-[rgb(135,135,135)] text-xs mb-4">Loading…</p>}
      {error && <p className="text-[#f87171] text-xs mb-4">{error}</p>}

      {!hasData && !loading && (
        <p className="text-[rgb(135,135,135)] text-xs">
          Upload <code className="text-[rgb(135,135,135)]">physiological_cycles.csv</code> and/or <code className="text-[rgb(135,135,135)]">sleeps.csv</code> from your WHOOP export ZIP.
        </p>
      )}

      {hasData && (
        <div className="space-y-10">
          {displayCycles.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-[#af87ff] uppercase tracking-widest mb-4">Recovery & strain</h2>
              <div className="text-[13px] space-y-2">
                {displayCycles.map((c) => (
                  <div
                    key={c.date}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#222] pb-2"
                  >
                    <span className="text-[rgb(135,135,135)]">{formatDate(c.date)}</span>
                    <span className="flex items-center gap-3 text-sm">
                      {c.recovery > 0 && (
                        <span className={recoveryColor(c.recovery)}>Recovery {Math.round(c.recovery)}%</span>
                      )}
                      {c.strain > 0 && <span className="text-[rgb(135,135,135)]">Strain {c.strain.toFixed(1)}</span>}
                      {c.rhr > 0 && <span className="text-[rgb(135,135,135)]">RHR {Math.round(c.rhr)}</span>}
                      {c.hrv > 0 && <span className="text-[rgb(135,135,135)]">HRV {Math.round(c.hrv)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {displaySleeps.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-[#af87ff] uppercase tracking-widest mb-4">Sleep</h2>
              <div className="text-[13px] space-y-2">
                {displaySleeps.map((s) => (
                  <div
                    key={s.date}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#222] pb-2"
                  >
                    <span className="text-[rgb(135,135,135)]">{formatDate(s.date)}</span>
                    <span className="flex items-center gap-3 text-sm text-[rgb(135,135,135)]">
                      {s.durationHours > 0 && (
                        <span>{s.durationHours.toFixed(1)}h</span>
                      )}
                      {s.score > 0 && <span>Score {Math.round(s.score)}%</span>}
                      {s.efficiency > 0 && <span>Efficiency {Math.round(s.efficiency)}%</span>}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      <Footer />
    </div>
  )
}
