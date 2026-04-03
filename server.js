import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 4895
const TMDB_BASE = 'https://api.themoviedb.org/3'

// ─── TMDB Auth ───────────────────────────────────────────────────────────────
// Supports Bearer token (API Read Access Token, recommended) or classic api_key
function tmdbConfig() {
  if (process.env.TMDB_READ_ACCESS_TOKEN) {
    return {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
        accept: 'application/json'
      },
      params: {}
    }
  }
  return {
    headers: { accept: 'application/json' },
    params: {
      api_key: process.env.TMDB_API_KEY,
      session_id: process.env.TMDB_SESSION_ID
    }
  }
}

// Convenience wrapper for TMDB GET requests
const tmdb = {
  get: (endpoint, extra = {}) => {
    const { headers, params } = tmdbConfig()
    return axios.get(`${TMDB_BASE}${endpoint}`, {
      headers,
      params: { ...params, ...extra },
      timeout: 10000
    })
  }
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
const cache = new Map()

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) { cache.delete(key); return null }
  return entry.data
}

function setCached(key, data, ttlMs = 30 * 60 * 1000) {
  cache.set(key, { data, expires: Date.now() + ttlMs })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchAllPages(endpoint, extraParams = {}) {
  const first = await tmdb.get(endpoint, { ...extraParams, language: 'es-ES', page: 1 })
  const { results, total_pages } = first.data

  if (total_pages <= 1) return results

  const pages = Array.from({ length: total_pages - 1 }, (_, i) => i + 2)
  const CONCURRENCY = 5
  const all = [...results]

  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const chunk = pages.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map(p => tmdb.get(endpoint, { ...extraParams, language: 'es-ES', page: p }).then(r => r.data.results))
    )
    settled.forEach(s => { if (s.status === 'fulfilled') all.push(...s.value) })
  }

  return all
}

// Auto-resolve account ID (caches after first fetch)
let resolvedAccountId = process.env.TMDB_ACCOUNT_ID || null

async function getAccountId() {
  if (resolvedAccountId) return resolvedAccountId
  const res = await tmdb.get('/account')
  resolvedAccountId = String(res.data.id)
  return resolvedAccountId
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.static(path.join(__dirname, 'client/dist')))

// ─── Routes ───────────────────────────────────────────────────────────────────

// Watchlist — movies
app.get('/api/watchlist/movies', async (req, res) => {
  try {
    const cached = getCached('watchlist_movies')
    if (cached) return res.json(cached)

    const accountId = await getAccountId()
    const items = await fetchAllPages(`/account/${accountId}/watchlist/movies`)
    const result = { results: items, total: items.length }
    setCached('watchlist_movies', result)
    res.json(result)
  } catch (err) {
    console.error('[/api/watchlist/movies]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Watchlist — TV series
app.get('/api/watchlist/tv', async (req, res) => {
  try {
    const cached = getCached('watchlist_tv')
    if (cached) return res.json(cached)

    const accountId = await getAccountId()
    const items = await fetchAllPages(`/account/${accountId}/watchlist/tv`)
    const result = { results: items, total: items.length }
    setCached('watchlist_tv', result)
    res.json(result)
  } catch (err) {
    console.error('[/api/watchlist/tv]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Watch providers batch (Spain = ES)
// Body: { items: [{ type: 'movie'|'tv', id: number }] }
app.post('/api/providers/batch', async (req, res) => {
  try {
    const { items = [] } = req.body
    const CHUNK = 20
    const results = {}

    // Serve cached hits immediately
    const uncached = items.filter(({ type, id }) => {
      const hit = getCached(`prov_${type}_${id}`)
      if (hit !== null) { results[`${type}_${id}`] = hit; return false }
      return true
    })

    // Fetch uncached in chunks to respect TMDB rate limits
    for (let i = 0; i < uncached.length; i += CHUNK) {
      const chunk = uncached.slice(i, i + CHUNK)
      const settled = await Promise.allSettled(
        chunk.map(async ({ type, id }) => {
          const r = await tmdb.get(`/${type}/${id}/watch/providers`)
          const esData = r.data.results?.ES || {}
          setCached(`prov_${type}_${id}`, esData, 6 * 60 * 60 * 1000)
          return { key: `${type}_${id}`, data: esData }
        })
      )
      settled.forEach(s => {
        if (s.status === 'fulfilled') results[s.value.key] = s.value.data
      })
    }

    res.json(results)
  } catch (err) {
    console.error('[/api/providers/batch]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Available subscription providers in Spain
app.get('/api/providers/list', async (req, res) => {
  try {
    const cached = getCached('providers_list')
    if (cached) return res.json(cached)

    const r = await tmdb.get('/watch/providers/movie', { watch_region: 'ES', language: 'es-ES' })
    const providers = (r.data.results || [])
      .filter(p => p.display_priority < 60)
      .sort((a, b) => a.display_priority - b.display_priority)

    setCached('providers_list', providers, 24 * 60 * 60 * 1000)
    res.json(providers)
  } catch (err) {
    console.error('[/api/providers/list]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Multi-search
app.get('/api/search', async (req, res) => {
  try {
    const { query = '' } = req.query
    if (!query.trim()) return res.json({ results: [] })

    const r = await tmdb.get('/search/multi', {
      query,
      language: 'es-ES',
      include_adult: false
    })

    const results = (r.data.results || []).filter(
      item => item.media_type === 'movie' || item.media_type === 'tv'
    )
    res.json({ results })
  } catch (err) {
    console.error('[/api/search]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Jellyfin library → map of tmdbId → { name, type, jellyfinId }
app.get('/api/jellyfin/library', async (req, res) => {
  try {
    const cached = getCached('jellyfin_library')
    if (cached) return res.json(cached)

    const baseUrl = (process.env.JELLYFIN_URL || '').replace(/\/$/, '')
    const apiKey = process.env.JELLYFIN_API_KEY

    if (!baseUrl || !apiKey) return res.json({})

    // Resolve userId
    let userId = process.env.JELLYFIN_USER_ID
    if (!userId) {
      const usersRes = await axios.get(`${baseUrl}/Users`, {
        params: { api_key: apiKey },
        timeout: 8000
      })
      userId = usersRes.data?.[0]?.Id
    }
    if (!userId) return res.json({})

    const r = await axios.get(`${baseUrl}/Users/${userId}/Items`, {
      params: {
        api_key: apiKey,
        Fields: 'ProviderIds',
        IncludeItemTypes: 'Movie,Series',
        Recursive: true,
        Limit: 10000,
        EnableImages: false
      },
      timeout: 15000
    })

    const tmdbMap = {}
    for (const item of r.data.Items || []) {
      const tmdbId = item.ProviderIds?.Tmdb
      if (tmdbId) {
        tmdbMap[String(tmdbId)] = {
          name: item.Name,
          type: item.Type,
          jellyfinId: item.Id
        }
      }
    }

    setCached('jellyfin_library', tmdbMap, 10 * 60 * 1000)
    res.json(tmdbMap)
  } catch (err) {
    // Never crash if Jellyfin is down
    console.error('[/api/jellyfin/library]', err.message)
    res.json({})
  }
})

// Invalidate all caches (useful after adding new watchlist items)
app.post('/api/cache/clear', (_req, res) => {
  cache.clear()
  resolvedAccountId = process.env.TMDB_ACCOUNT_ID || null
  res.json({ ok: true, message: 'Cache cleared' })
})

// SPA catch-all
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MyWatchlist Hub → http://0.0.0.0:${PORT}`)
})
