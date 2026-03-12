import type { VercelRequest, VercelResponse } from '@vercel/node'

const WHOOP_BASE = 'https://api.prod.whoop.com'

async function kv(method: string, ...args: string[]) {
  const res = await fetch(process.env.KV_REST_API_URL!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([method, ...args]),
  })
  const data = await res.json()
  return data.result
}

async function refreshTokens() {
  const refreshToken =
    (await kv('GET', 'whoop:refresh_token')) || process.env.WHOOP_REFRESH_TOKEN
  if (!refreshToken) throw new Error('No refresh token available')

  const res = await fetch(`${WHOOP_BASE}/oauth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      scope: 'offline',
    }),
  })
  const tokens = await res.json()
  if (!tokens.access_token)
    throw new Error(`Refresh failed: ${JSON.stringify(tokens)}`)

  await kv('SET', 'whoop:refresh_token', tokens.refresh_token)
  await kv('SET', 'whoop:access_token', tokens.access_token)

  return tokens.access_token
}

async function whoopApi(path: string, token: string) {
  const res = await fetch(`${WHOOP_BASE}/developer${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) return null
  if (!res.ok) return null
  return res.json()
}

async function fetchAll(path: string, token: string, limit = 25) {
  const records: unknown[] = []
  let nextToken: string | undefined
  do {
    const params = new URLSearchParams({ limit: String(limit) })
    if (nextToken) params.set('nextToken', nextToken)
    const data = await whoopApi(`${path}?${params}`, token)
    if (!data) return null
    records.push(...(data.records ?? []))
    nextToken = data.next_token
  } while (nextToken && records.length < 500)
  return records
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = req.headers.authorization
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    let token =
      (await kv('GET', 'whoop:access_token')) || process.env.WHOOP_ACCESS_TOKEN

    let profile = token ? await whoopApi('/v2/user/profile/basic', token) : null
    if (!profile && token) {
      token = await refreshTokens()
      profile = await whoopApi('/v2/user/profile/basic', token)
    }
    if (!profile) {
      token = await refreshTokens()
      profile = await whoopApi('/v2/user/profile/basic', token)
    }
    if (!profile) throw new Error('Failed to load WHOOP profile')

    const [body, recoveries, sleeps, workouts, cycles] = await Promise.all([
      whoopApi('/v2/user/measurement/body', token!),
      fetchAll('/v2/recovery', token!, 14),
      fetchAll('/v2/activity/sleep', token!, 14),
      fetchAll('/v2/activity/workout', token!, 25),
      fetchAll('/v2/cycle', token!, 14),
    ])

    const data = {
      fetchedAt: new Date().toISOString(),
      profile,
      body: body ?? null,
      latest: {
        recovery: recoveries?.[0] ?? null,
        sleep: sleeps?.[0] ?? null,
        cycle: cycles?.[0] ?? null,
      },
      recoveries: recoveries ?? [],
      sleeps: sleeps ?? [],
      workouts: workouts ?? [],
      cycles: cycles ?? [],
    }

    await kv('SET', 'whoop:data', JSON.stringify(data))

    return res.status(200).json({ ok: true, fetchedAt: data.fetchedAt })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg })
  }
}
