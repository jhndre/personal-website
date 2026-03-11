/**
 * One-time WHOOP OAuth flow: open http://localhost:3000, sign in with WHOOP,
 * then tokens are saved to .env. Run: npm run whoop:auth
 */
import { createServer } from 'node:http'
import { URL } from 'node:url'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envPath = resolve(root, '.env')

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error('Missing .env. Copy .env.example to .env and add WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET.')
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
const CLIENT_ID = env.WHOOP_CLIENT_ID
const CLIENT_SECRET = env.WHOOP_CLIENT_SECRET
const REDIRECT_URI = env.WHOOP_REDIRECT_URI || 'http://localhost:3000/callback'
const SCOPES = [
  'read:recovery',
  'read:cycles',
  'read:workout',
  'read:sleep',
  'read:profile',
  'read:body_measurement',
  'offline',
].join(' ')

const AUTH_URL = `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&state=whoopauth`

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '', 'http://localhost:3000')

  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code')
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Missing code parameter')
      return
    }

    const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    })

    const tokens = await tokenRes.json()

    if (tokens.access_token) {
      let envContent = readFileSync(envPath, 'utf-8')
      if (envContent.includes('WHOOP_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/WHOOP_ACCESS_TOKEN=.*/, `WHOOP_ACCESS_TOKEN=${tokens.access_token}`)
      } else {
        envContent += `\nWHOOP_ACCESS_TOKEN=${tokens.access_token}`
      }
      if (envContent.includes('WHOOP_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/WHOOP_REFRESH_TOKEN=.*/, `WHOOP_REFRESH_TOKEN=${tokens.refresh_token}`)
      } else {
        envContent += `\nWHOOP_REFRESH_TOKEN=${tokens.refresh_token}`
      }
      writeFileSync(envPath, envContent)

      console.log('\n✓ Tokens saved to .env')
      console.log(`  access_token: ${tokens.access_token.slice(0, 20)}...`)
      console.log(`  refresh_token: ${tokens.refresh_token?.slice(0, 20)}...`)
      console.log(`  expires_in: ${tokens.expires_in}s`)

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h1>Done! Tokens saved. You can close this tab.</h1>')
      setTimeout(() => process.exit(0), 1000)
    } else {
      console.error('Token exchange failed:', tokens)
      res.writeHead(500, { 'Content-Type': 'text/html' })
      res.end(`<pre>Token exchange failed: ${JSON.stringify(tokens, null, 2)}</pre>`)
    }
  } else {
    res.writeHead(302, { Location: AUTH_URL })
    res.end()
  }
})

server.listen(3000, () => {
  console.log('\nOpen http://localhost:3000 in your browser to authorize WHOOP\n')
})
