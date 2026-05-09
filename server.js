import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import fs from 'fs'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 4895
const TMDB_BASE = 'https://api.themoviedb.org/3'
const DATA_DIR = path.join(__dirname, 'data')
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json')

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

// ─── Profiles ─────────────────────────────────────────────────────────────────
let _profilesCache = null

function loadProfiles() {
  if (_profilesCache) return _profilesCache
  try { _profilesCache = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')) }
  catch { _profilesCache = [] }
  return _profilesCache
}

function saveProfiles(profiles) {
  _profilesCache = profiles
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2))
}

function findProfile(profileId) {
  if (!profileId) return null
  return loadProfiles().find(p => p.id === profileId) || null
}

// Auto-seed a default profile from env vars on first run
;(function seedIfEmpty() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY
  if (!token) return
  const profiles = loadProfiles()
  if (profiles.length > 0) return
  const seed = {
    id: 'default',
    name: 'Principal',
    tmdbReadAccessToken: process.env.TMDB_READ_ACCESS_TOKEN || null,
    tmdbApiKey: process.env.TMDB_API_KEY || null,
    tmdbAccountId: process.env.TMDB_ACCOUNT_ID || null
  }
  saveProfiles([seed])
  console.log('[profiles] Perfil "Principal" creado desde variables de entorno')
})()

// ─── TMDB Auth ────────────────────────────────────────────────────────────────
function tmdbConfigForProfile(profile) {
  const token = profile?.tmdbReadAccessToken
  if (token) {
    return {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
      params: {}
    }
  }
  const apiKey = profile?.tmdbApiKey
  if (apiKey) {
    return {
      headers: { accept: 'application/json' },
      params: { api_key: apiKey, session_id: profile?.tmdbSessionId }
    }
  }
  // Fallback to env vars (backward compat)
  if (process.env.TMDB_READ_ACCESS_TOKEN) {
    return {
      headers: { Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`, accept: 'application/json' },
      params: {}
    }
  }
  return {
    headers: { accept: 'application/json' },
    params: { api_key: process.env.TMDB_API_KEY, session_id: process.env.TMDB_SESSION_ID }
  }
}

function makeTmdb(profile) {
  return {
    get: (endpoint, extra = {}) => {
      const { headers, params } = tmdbConfigForProfile(profile)
      return axios.get(`${TMDB_BASE}${endpoint}`, {
        headers, params: { ...params, ...extra }, timeout: 10000
      })
    }
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
async function fetchAllPages(tmdb, endpoint, extraParams = {}) {
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

const resolvedAccountIds = new Map()

async function getAccountId(profileId, profile, tmdb) {
  if (profile?.tmdbAccountId) return String(profile.tmdbAccountId)
  if (resolvedAccountIds.has(profileId)) return resolvedAccountIds.get(profileId)
  const res = await tmdb.get('/account')
  const id = String(res.data.id)
  resolvedAccountIds.set(profileId, id)
  return id
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.static(path.join(__dirname, 'client/dist')))

function profileFromReq(req) {
  const profileId = req.query.profile || null
  const profile = findProfile(profileId)
  const tmdb = makeTmdb(profile)
  return { profileId: profileId || 'default', profile, tmdb }
}

// ─── Routes: Profiles ─────────────────────────────────────────────────────────

// List profiles (tokens never exposed)
app.get('/api/profiles', (_req, res) => {
  const profiles = loadProfiles()
  res.json(profiles.map(({ id, name, tmdbAccountId }) => ({
    id, name, tmdbAccountId: tmdbAccountId || null
  })))
})

// Create profile (validates token against TMDB /account)
app.post('/api/profiles', async (req, res) => {
  try {
    const { name, tmdbReadAccessToken } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' })
    if (!tmdbReadAccessToken?.trim()) return res.status(400).json({ error: 'El token de acceso es obligatorio' })

    const testTmdb = makeTmdb({ tmdbReadAccessToken: tmdbReadAccessToken.trim() })
    const accountRes = await testTmdb.get('/account')
    const resolvedAccountId = String(accountRes.data.id)

    const profiles = loadProfiles()
    const newProfile = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      tmdbReadAccessToken: tmdbReadAccessToken.trim(),
      tmdbAccountId: resolvedAccountId
    }
    saveProfiles([...profiles, newProfile])

    const { tmdbReadAccessToken: _t, ...safeProfile } = newProfile
    res.json(safeProfile)
  } catch (err) {
    console.error('[POST /api/profiles]', err.message)
    res.status(400).json({ error: 'Token inválido o sin acceso a TMDB. Comprueba el Read Access Token.' })
  }
})

// Delete profile
app.delete('/api/profiles/:id', (req, res) => {
  const { id } = req.params
  const profiles = loadProfiles()
  saveProfiles(profiles.filter(p => p.id !== id))
  for (const key of cache.keys()) {
    if (key.endsWith(`_${id}`)) cache.delete(key)
  }
  resolvedAccountIds.delete(id)
  res.json({ ok: true })
})

// ─── Routes: Watchlist ────────────────────────────────────────────────────────

app.get('/api/watchlist/movies', async (req, res) => {
  try {
    const { profileId, profile, tmdb } = profileFromReq(req)
    const cacheKey = `watchlist_movies_${profileId}`
    const cached = getCached(cacheKey)
    if (cached) return res.json(cached)

    const accountId = await getAccountId(profileId, profile, tmdb)
    const items = await fetchAllPages(tmdb, `/account/${accountId}/watchlist/movies`)
    const result = { results: items, total: items.length }
    setCached(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('[/api/watchlist/movies]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/watchlist/tv', async (req, res) => {
  try {
    const { profileId, profile, tmdb } = profileFromReq(req)
    const cacheKey = `watchlist_tv_${profileId}`
    const cached = getCached(cacheKey)
    if (cached) return res.json(cached)

    const accountId = await getAccountId(profileId, profile, tmdb)
    const items = await fetchAllPages(tmdb, `/account/${accountId}/watchlist/tv`)
    const result = { results: items, total: items.length }
    setCached(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('[/api/watchlist/tv]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Routes: Providers ────────────────────────────────────────────────────────

// Providers are public data — cache is shared across profiles
app.post('/api/providers/batch', async (req, res) => {
  try {
    const { tmdb } = profileFromReq(req)
    const { items = [] } = req.body
    const CHUNK = 20
    const results = {}

    const uncached = items.filter(({ type, id }) => {
      const hit = getCached(`prov_${type}_${id}`)
      if (hit !== null) { results[`${type}_${id}`] = hit; return false }
      return true
    })

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

app.get('/api/providers/list', async (req, res) => {
  try {
    const cached = getCached('providers_list')
    if (cached) return res.json(cached)

    const { tmdb } = profileFromReq(req)
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

// ─── Routes: TMDB Lists ───────────────────────────────────────────────────────

app.get('/api/list/:listId', async (req, res) => {
  try {
    const { listId } = req.params
    if (!/^\d+$/.test(listId)) return res.status(400).json({ error: 'Invalid list ID' })

    const { profileId, tmdb } = profileFromReq(req)
    const cacheKey = `list_${listId}_${profileId}`
    const cached = getCached(cacheKey)
    if (cached) return res.json(cached)

    const first = await tmdb.get(`/list/${listId}`, { language: 'es-ES', page: 1 })
    const { name, description, items: firstItems = [], total_pages = 1 } = first.data

    let allItems = [...firstItems]
    if (total_pages > 1) {
      const pages = Array.from({ length: total_pages - 1 }, (_, i) => i + 2)
      const CONCURRENCY = 5
      for (let i = 0; i < pages.length; i += CONCURRENCY) {
        const chunk = pages.slice(i, i + CONCURRENCY)
        const settled = await Promise.allSettled(
          chunk.map(p => tmdb.get(`/list/${listId}`, { language: 'es-ES', page: p }).then(r => r.data.items || []))
        )
        settled.forEach(s => { if (s.status === 'fulfilled') allItems.push(...s.value) })
      }
    }

    const typeOf = item => item.media_type || (item.title && !item.name ? 'movie' : 'tv')
    const movies = allItems.filter(i => typeOf(i) === 'movie').map(i => ({ ...i, media_type: 'movie' }))
    const tv = allItems.filter(i => typeOf(i) === 'tv').map(i => ({ ...i, media_type: 'tv' }))

    const result = { id: listId, name, description, movies, tv, total: allItems.length }
    setCached(cacheKey, result, 30 * 60 * 1000)
    res.json(result)
  } catch (err) {
    const status = err.response?.status || 500
    console.error(`[/api/list/${req.params.listId}]`, err.message)
    res.status(status).json({ error: err.message })
  }
})

// ─── Routes: Search & Jellyfin ────────────────────────────────────────────────

app.get('/api/search', async (req, res) => {
  try {
    const { query = '' } = req.query
    if (!query.trim()) return res.json({ results: [] })

    const { tmdb } = profileFromReq(req)
    const r = await tmdb.get('/search/multi', { query, language: 'es-ES', include_adult: false })
    const results = (r.data.results || []).filter(
      item => item.media_type === 'movie' || item.media_type === 'tv'
    )
    res.json({ results })
  } catch (err) {
    console.error('[/api/search]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/jellyfin/library', async (req, res) => {
  try {
    const cached = getCached('jellyfin_library')
    if (cached) return res.json(cached)

    const baseUrl = (process.env.JELLYFIN_URL || '').replace(/\/$/, '')
    const apiKey = process.env.JELLYFIN_API_KEY
    if (!baseUrl || !apiKey) return res.json({})

    let userId = process.env.JELLYFIN_USER_ID
    if (!userId) {
      const usersRes = await axios.get(`${baseUrl}/Users`, { params: { api_key: apiKey }, timeout: 8000 })
      userId = usersRes.data?.[0]?.Id
    }
    if (!userId) return res.json({})

    const r = await axios.get(`${baseUrl}/Users/${userId}/Items`, {
      params: { api_key: apiKey, Fields: 'ProviderIds', IncludeItemTypes: 'Movie,Series', Recursive: true, Limit: 10000, EnableImages: false },
      timeout: 15000
    })

    const tmdbMap = {}
    for (const item of r.data.Items || []) {
      const tmdbId = item.ProviderIds?.Tmdb
      if (tmdbId) tmdbMap[String(tmdbId)] = { name: item.Name, type: item.Type, jellyfinId: item.Id }
    }

    setCached('jellyfin_library', tmdbMap, 10 * 60 * 1000)
    res.json(tmdbMap)
  } catch (err) {
    console.error('[/api/jellyfin/library]', err.message)
    res.json({})
  }
})

// ─── Routes: Cache ────────────────────────────────────────────────────────────

app.post('/api/cache/clear', (req, res) => {
  const profileId = req.query.profile
  if (profileId) {
    for (const key of cache.keys()) {
      if (key.endsWith(`_${profileId}`)) cache.delete(key)
    }
    resolvedAccountIds.delete(profileId)
  } else {
    cache.clear()
    resolvedAccountIds.clear()
  }
  res.json({ ok: true })
})

// ─── SPA catch-all ────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MyWatchlist Hub → http://0.0.0.0:${PORT}`)
})
