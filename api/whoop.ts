import type { VercelRequest, VercelResponse } from '@vercel/node'

async function kvGet(key: string) {
  const res = await fetch(process.env.KV_REST_API_URL!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['GET', key]),
  })
  const data = await res.json()
  return data.result
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const cached = await kvGet('whoop:data')
    if (!cached) return res.status(404).json({ error: 'No data yet' })

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(JSON.parse(cached))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: msg })
  }
}
