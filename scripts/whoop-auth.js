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
const CLIENT_ID = (env.WHOOP_CLIENT_ID || '').trim()
const CLIENT_SECRET = (env.WHOOP_CLIENT_SECRET || '').trim()

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing WHOOP_CLIENT_ID or WHOOP_CLIENT_SECRET in .env')
  process.exit(1)
}
if (CLIENT_ID.includes('\n') || CLIENT_SECRET.includes('\n')) {
  console.error('WHOOP_CLIENT_ID or WHOOP_CLIENT_SECRET contains a newline. Use a single line in .env.')
  process.exit(1)
}

const SCOPES = [
  'read:recovery',
  'read:cycles',
  'read:workout',
  'read:sleep',
  'read:profile',
  'read:body_measurement',
  'offline',
].join(' ')

function buildAuthUrl(redirectUri) {
  return `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&state=whoopauth`
    .replace(/[\r\n]+/g, '')
    .trim()
}

function startServer(port) {
  const redirectUri = `http://localhost:${port}/callback`
  const authUrl = buildAuthUrl(redirectUri)
  const baseUrl = `http://localhost:${port}`

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '', baseUrl)

    if (url.pathname === '/callback') {
    const code = url.searchParams.get('code')
    if (!code) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        '<h1>Wrong URL</h1><p>Do not open <code>/callback</code> directly.</p>' +
          `<p><a href="/">Click here</a> to start at <strong>${baseUrl}</strong> — you will be redirected to WHOOP to sign in, then sent back here with a code.</p>`
      )
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
        redirect_uri: redirectUri,
      }),
    })

    const tokens = await tokenRes.json()

    if (tokens.access_token) {
      let envContent = readFileSync(envPath, 'utf-8')
      // Match line with or without leading # (so we uncomment when saving)
      if (/WHOOP_ACCESS_TOKEN=/.test(envContent)) {
        envContent = envContent.replace(/#?\s*WHOOP_ACCESS_TOKEN=.*/m, `WHOOP_ACCESS_TOKEN=${tokens.access_token}`)
      } else {
        envContent += `\nWHOOP_ACCESS_TOKEN=${tokens.access_token}`
      }
      if (/WHOOP_REFRESH_TOKEN=/.test(envContent)) {
        envContent = envContent.replace(/#?\s*WHOOP_REFRESH_TOKEN=.*/m, `WHOOP_REFRESH_TOKEN=${tokens.refresh_token}`)
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
      // Exit after a short delay so the response is fully sent
      setTimeout(() => process.exit(0), 2000)
    } else {
      console.error('Token exchange failed:', tokens)
      res.writeHead(500, { 'Content-Type': 'text/html' })
      res.end(`<pre>Token exchange failed: ${JSON.stringify(tokens, null, 2)}</pre>`)
    }
  } else {
    // Redirect to WHOOP OAuth; also send a fallback HTML page in case the redirect is stripped (e.g. 404 on api.prod.whoop.com)
    res.writeHead(302, {
      Location: authUrl,
      'Cache-Control': 'no-store',
    })
    res.end(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${escapeHtml(authUrl)}"></head><body><p>Redirecting to WHOOP…</p><p>If you are not redirected, <a href="${escapeHtml(authUrl)}">click here to authorize</a>.</p><p style="margin-top:1.5em;font-size:0.9em;color:#666">If you see &quot;This page isn't working&quot; at api.prod.whoop.com, add this Redirect URI in the WHOOP Developer Dashboard → your app → Redirect URIs:</p><p style="font-family:monospace;font-size:0.85em">${escapeHtml(redirectUri)}</p></body></html>`
    )
  }
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < 3010) {
      server.close(() => startServer(port + 1))
    } else {
      throw err
    }
  })

  server.listen(port, () => {
    const preview = authUrl.replace(/client_id=[^&]+/, 'client_id=...')
    console.log(`\nOpen http://localhost:${port} in your browser to authorize WHOOP`)
    console.log('\n  If you see "This page isn\'t working" or api.prod.whoop.com error:')
    console.log('  → Add this exact Redirect URI in the WHOOP Developer Dashboard (your app → Redirect URIs):')
    console.log(`\n      ${redirectUri}\n`)
    if (port !== 3000) {
      console.log('  (Port 3000 was in use; this run is using port ' + port + '.)')
    }
    console.log('  Then open the URL above again.\n')
  })
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

startServer(3000)
