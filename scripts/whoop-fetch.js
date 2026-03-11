/**
 * Fetch WHOOP data via API and write public/whoop-data.json.
 * Run after whoop:auth (e.g. npm run whoop:fetch). Refresh token automatically on 401.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envPath = resolve(root, '.env')

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error('Missing .env. Run npm run whoop:auth first.')
    process.exit(1)
  }
  const raw = readFileSync(envPath, 'utf-8')
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

const env = loadEnv()
const BASE = 'https://api.prod.whoop.com'

async function refreshTokens() {
  const res = await fetch(`${BASE}/oauth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.WHOOP_REFRESH_TOKEN,
      client_id: env.WHOOP_CLIENT_ID,
      client_secret: env.WHOOP_CLIENT_SECRET,
      scope: 'offline',
    }),
  })
  const tokens = await res.json()
  if (!tokens.access_token) throw new Error(`Refresh failed: ${JSON.stringify(tokens)}`)

  let envContent = readFileSync(envPath, 'utf-8')
  envContent = envContent.replace(/WHOOP_ACCESS_TOKEN=.*/, `WHOOP_ACCESS_TOKEN=${tokens.access_token}`)
  if (tokens.refresh_token) {
    envContent = envContent.replace(/WHOOP_REFRESH_TOKEN=.*/, `WHOOP_REFRESH_TOKEN=${tokens.refresh_token}`)
  }
  writeFileSync(envPath, envContent)

  return tokens.access_token
}

async function api(path, token) {
  const res = await fetch(`${BASE}/developer${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`)
  return res.json()
}

async function fetchAll(path, token, limit = 25) {
  const records = []
  let nextToken
  do {
    const params = new URLSearchParams({ limit: String(limit) })
    if (nextToken) params.set('nextToken', nextToken)
    const data = await api(`${path}?${params}`, token)
    if (!data) return null
    records.push(...(data.records ?? []))
    nextToken = data.next_token
  } while (nextToken && records.length < 500)
  return records
}

async function main() {
  let token = env.WHOOP_ACCESS_TOKEN

  let profile = await api('/v2/user/profile/basic', token)
  if (!profile) {
    console.log('Access token expired, refreshing...')
    token = await refreshTokens()
    profile = await api('/v2/user/profile/basic', token)
  }
  if (!profile) {
    console.error('Failed to load profile. Re-run npm run whoop:auth.')
    process.exit(1)
  }

  const [body, recoveries, sleeps, workouts, cycles] = await Promise.all([
    api('/v2/user/measurement/body', token),
    fetchAll('/v2/recovery', token),
    fetchAll('/v2/activity/sleep', token),
    fetchAll('/v2/activity/workout', token),
    fetchAll('/v2/cycle', token),
  ])

  const latestRecovery = recoveries?.[0]
  const latestScore = latestRecovery?.score

  const data = {
    fetchedAt: new Date().toISOString(),
    profile,
    body,
    latest: {
      recovery: recoveries?.[0],
      sleep: sleeps?.[0],
      cycle: cycles?.[0],
    },
    recoveries: recoveries ?? [],
    sleeps: sleeps ?? [],
    workouts: workouts ?? [],
    cycles: cycles ?? [],
  }

  const outPath = resolve(root, 'public', 'whoop-data.json')
  writeFileSync(outPath, JSON.stringify(data, null, 2))
  console.log(`✓ Saved ${outPath}`)
  if (latestScore) {
    console.log(`  Recovery: ${latestScore.recovery_score}%`)
    console.log(`  HRV: ${latestScore.hrv_rmssd_milli != null ? Number(latestScore.hrv_rmssd_milli).toFixed(1) : '—'} ms`)
    console.log(`  RHR: ${latestScore.resting_heart_rate ?? '—'} bpm`)
  }
  console.log(`  Workouts: ${(workouts ?? []).length}`)
  console.log(`  Sleep records: ${(sleeps ?? []).length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
