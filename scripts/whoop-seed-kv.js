/**
 * One-time: push local whoop-data.json and tokens to Vercel KV.
 * Run after: 1) npm run whoop:fetch, 2) vercel env pull .env.local (or add KV_* to .env)
 *
 * Usage: npm run whoop:seed-kv
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envPath = resolve(root, '.env')
const envLocalPath = resolve(root, '.env.local')
const whoopDataPath = resolve(root, 'public', 'whoop-data.json')

function parseEnvFile(path) {
  const raw = readFileSync(path, 'utf-8')
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        let key = l.slice(0, i).trim()
        let val = l.slice(i + 1).trim()
        if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1)
        }
        return [key, val]
      })
  )
}

function loadEnv() {
  const env = existsSync(envPath) ? parseEnvFile(envPath) : {}
  const local = existsSync(envLocalPath) ? parseEnvFile(envLocalPath) : {}
  return { ...env, ...local }
}

async function kv(method, ...args) {
  const res = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([method, ...args]),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.result
}

async function main() {
  const env = loadEnv()
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    console.error('Run `vercel env pull .env.local` or add KV_REST_API_URL and KV_REST_API_TOKEN to .env')
    process.exit(1)
  }
  Object.assign(process.env, env)

  if (!existsSync(whoopDataPath)) {
    console.error('Run npm run whoop:fetch first to create public/whoop-data.json')
    process.exit(1)
  }

  const whoopData = readFileSync(whoopDataPath, 'utf-8')
  await kv('SET', 'whoop:data', whoopData)
  console.log('✓ whoop:data')

  if (env.WHOOP_REFRESH_TOKEN) {
    await kv('SET', 'whoop:refresh_token', env.WHOOP_REFRESH_TOKEN)
    console.log('✓ whoop:refresh_token')
  }
  if (env.WHOOP_ACCESS_TOKEN) {
    await kv('SET', 'whoop:access_token', env.WHOOP_ACCESS_TOKEN)
    console.log('✓ whoop:access_token')
  }

  console.log('\nKV seeded. Deploy to Vercel; cron will keep /api/whoop-sync updated.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
