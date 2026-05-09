import { useState, useEffect, useCallback, useRef } from 'react'
import PlatformSetup from './components/PlatformSetup'
import ListManager from './components/ListManager'
import ProfileManager, { ProfileAvatar } from './components/ProfileManager'
import SearchBar from './components/SearchBar'
import MediaGrid from './components/MediaGrid'

const STORAGE_ACTIVE_PROFILE = 'mwh_active_profile'

// Per-profile localStorage key
const pkey = (profileId, key) => `mwh_${key}_${profileId || 'default'}`

export default function App() {
  // ── Profiles ──────────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState([])
  const [activeProfileId, setActiveProfileId] = useState(
    () => localStorage.getItem(STORAGE_ACTIVE_PROFILE) || null
  )
  const [showProfileManager, setShowProfileManager] = useState(false)
  const [profilesLoaded, setProfilesLoaded] = useState(false)

  // ── Data ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('movies')
  const [movies, setMovies] = useState([])
  const [tvShows, setTvShows] = useState([])
  const [lists, setLists] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [jellyfinMap, setJellyfinMap] = useState({})
  const [providersMap, setProvidersMap] = useState({})

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [showSetup, setShowSetup] = useState(false)
  const [showListManager, setShowListManager] = useState(false)
  const [filterEnabled, setFilterEnabled] = useState(false)
  const [loading, setLoading] = useState({ movies: true, tv: true })
  const [error, setError] = useState(null)

  // ── Load profiles on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/profiles')
      .then(r => r.json())
      .then(data => {
        setProfiles(data)
        setProfilesLoaded(true)

        if (data.length === 0) {
          setShowProfileManager(true)
          return
        }

        // Validate stored active profile
        const stored = localStorage.getItem(STORAGE_ACTIVE_PROFILE)
        const valid = data.find(p => p.id === stored)
        const selectedId = valid ? stored : data[0].id

        if (selectedId !== stored) {
          localStorage.setItem(STORAGE_ACTIVE_PROFILE, selectedId)
        }
        setActiveProfileId(selectedId)
      })
      .catch(() => setProfilesLoaded(true))
  }, [])

  // ── Jellyfin (shared across profiles) ────────────────────────────────────
  useEffect(() => {
    fetch('/api/jellyfin/library')
      .then(r => r.json())
      .then(setJellyfinMap)
      .catch(() => {})
  }, [])

  // ── Providers batch ───────────────────────────────────────────────────────
  const fetchProviders = useCallback(async (items) => {
    const BATCH = 50
    const profile = activeProfileId ? `?profile=${activeProfileId}` : ''
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH)
      try {
        const res = await fetch(`/api/providers/batch${profile}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch })
        })
        const data = await res.json()
        setProvidersMap(prev => ({ ...prev, ...data }))
      } catch (err) {
        console.error('providers/batch error:', err)
      }
    }
  }, [activeProfileId])

  // ── Reset + reload settings when profile changes ──────────────────────────
  useEffect(() => {
    if (!activeProfileId) return

    setMovies([])
    setTvShows([])
    setProvidersMap({})
    setLoading({ movies: true, tv: true })
    setActiveTab('movies')
    setSearchResults([])
    setError(null)
    fetchedListIds.current.clear()

    const savedPlatforms = localStorage.getItem(pkey(activeProfileId, 'platforms'))
    if (savedPlatforms) {
      setSelectedPlatforms(JSON.parse(savedPlatforms))
      setFilterEnabled(localStorage.getItem(pkey(activeProfileId, 'filter')) === 'true')
      setShowSetup(false)
    } else {
      setSelectedPlatforms([])
      setFilterEnabled(false)
      setShowSetup(true)
    }

    const savedListIds = JSON.parse(localStorage.getItem(pkey(activeProfileId, 'lists')) || '[]')
    setLists(savedListIds.map(id => ({ id, name: `Lista ${id}`, movies: [], tv: [], loading: true, error: null })))
  }, [activeProfileId])

  // ── Fetch watchlists when profile is set ─────────────────────────────────
  useEffect(() => {
    if (!activeProfileId) return

    const q = `?profile=${activeProfileId}`

    fetch(`/api/watchlist/movies${q}`)
      .then(r => r.json())
      .then(data => {
        const items = data.results || []
        setMovies(items)
        setLoading(prev => ({ ...prev, movies: false }))
        if (items.length) fetchProviders(items.map(m => ({ type: 'movie', id: m.id })))
      })
      .catch(err => {
        setError('Error al cargar películas: ' + err.message)
        setLoading(prev => ({ ...prev, movies: false }))
      })

    fetch(`/api/watchlist/tv${q}`)
      .then(r => r.json())
      .then(data => {
        const items = data.results || []
        setTvShows(items)
        setLoading(prev => ({ ...prev, tv: false }))
        if (items.length) fetchProviders(items.map(t => ({ type: 'tv', id: t.id })))
      })
      .catch(err => {
        setError('Error al cargar series: ' + err.message)
        setLoading(prev => ({ ...prev, tv: false }))
      })
  }, [activeProfileId, fetchProviders])

  // ── TMDB Lists ────────────────────────────────────────────────────────────
  const fetchedListIds = useRef(new Set())

  const doFetchList = useCallback(async (listId) => {
    if (fetchedListIds.current.has(listId)) return
    fetchedListIds.current.add(listId)
    try {
      const q = activeProfileId ? `?profile=${activeProfileId}` : ''
      const res = await fetch(`/api/list/${listId}${q}`)
      if (!res.ok) throw new Error(res.status === 404 ? 'Lista no encontrada' : `Error ${res.status}`)
      const data = await res.json()
      setLists(prev => prev.map(l => l.id === listId
        ? { ...l, name: data.name, movies: data.movies, tv: data.tv, loading: false, error: null }
        : l
      ))
      const items = [
        ...data.movies.map(m => ({ type: 'movie', id: m.id })),
        ...data.tv.map(t => ({ type: 'tv', id: t.id }))
      ]
      if (items.length) fetchProviders(items)
    } catch (err) {
      fetchedListIds.current.delete(listId)
      setLists(prev => prev.map(l => l.id === listId
        ? { ...l, loading: false, error: err.message }
        : l
      ))
    }
  }, [fetchProviders, activeProfileId])

  useEffect(() => {
    lists.filter(l => l.loading && !l.error).forEach(l => doFetchList(l.id))
  }, [lists, doFetchList])

  const addList = useCallback((id) => {
    const key = pkey(activeProfileId, 'lists')
    const savedIds = JSON.parse(localStorage.getItem(key) || '[]')
    if (savedIds.includes(id)) return
    localStorage.setItem(key, JSON.stringify([...savedIds, id]))
    setLists(prev => [...prev, { id, name: `Lista ${id}`, movies: [], tv: [], loading: true, error: null }])
  }, [activeProfileId])

  const removeList = useCallback((id) => {
    const key = pkey(activeProfileId, 'lists')
    const savedIds = JSON.parse(localStorage.getItem(key) || '[]')
    localStorage.setItem(key, JSON.stringify(savedIds.filter(x => x !== id)))
    setLists(prev => prev.filter(l => l.id !== id))
    fetchedListIds.current.delete(id)
    setActiveTab(prev => prev.startsWith(`list_${id}_`) ? 'movies' : prev)
  }, [activeProfileId])

  // ── Profile actions ───────────────────────────────────────────────────────
  const switchProfile = useCallback((id) => {
    localStorage.setItem(STORAGE_ACTIVE_PROFILE, id)
    setActiveProfileId(id)
  }, [])

  const addProfile = useCallback((profile) => {
    setProfiles(prev => {
      const next = [...prev, profile]
      if (!activeProfileId) {
        localStorage.setItem(STORAGE_ACTIVE_PROFILE, profile.id)
        setActiveProfileId(profile.id)
      }
      return next
    })
  }, [activeProfileId])

  const deleteProfile = useCallback((id) => {
    setProfiles(prev => {
      const next = prev.filter(p => p.id !== id)
      if (id === activeProfileId) {
        const nextProfile = next[0]
        if (nextProfile) {
          localStorage.setItem(STORAGE_ACTIVE_PROFILE, nextProfile.id)
          setActiveProfileId(nextProfile.id)
        } else {
          localStorage.removeItem(STORAGE_ACTIVE_PROFILE)
          setActiveProfileId(null)
          setShowProfileManager(true)
        }
      }
      return next
    })
  }, [activeProfileId])

  // ── Platform & filter ─────────────────────────────────────────────────────
  const handlePlatformSave = (platforms) => {
    setSelectedPlatforms(platforms)
    localStorage.setItem(pkey(activeProfileId, 'platforms'), JSON.stringify(platforms))
    setShowSetup(false)
  }

  const toggleFilter = () => {
    const next = !filterEnabled
    setFilterEnabled(next)
    localStorage.setItem(pkey(activeProfileId, 'filter'), String(next))
  }

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearchResults = useCallback((results) => {
    setSearchResults(results)
    if (results.length) fetchProviders(results.map(r => ({ type: r.media_type, id: r.id })))
  }, [fetchProviders])

  // ── Cache clear ───────────────────────────────────────────────────────────
  const clearCache = async () => {
    const q = activeProfileId ? `?profile=${activeProfileId}` : ''
    await fetch(`/api/cache/clear${q}`, { method: 'POST' })
    window.location.reload()
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const filteredCount = (items, type) => {
    if (!filterEnabled || selectedPlatforms.length === 0) return items.length
    return items.filter(item => {
      if (jellyfinMap[String(item.id)]) return true
      const prov = providersMap[`${type}_${item.id}`]
      if (prov === undefined) return true
      const ids = [...(prov.flatrate || []), ...(prov.free || [])].map(p => p.provider_id)
      return selectedPlatforms.some(id => ids.includes(id))
    }).length
  }

  const tabs = [
    { id: 'movies', label: 'Watchlist', sublabel: 'Películas', count: filteredCount(movies, 'movie') },
    { id: 'tv', label: 'Watchlist', sublabel: 'Series', count: filteredCount(tvShows, 'tv') },
    ...lists.flatMap(list => [
      { id: `list_${list.id}_movie`, label: list.loading ? `Lista ${list.id}` : list.name, sublabel: 'Películas', count: filteredCount(list.movies, 'movie'), loading: list.loading, error: list.error },
      { id: `list_${list.id}_tv`, label: list.loading ? `Lista ${list.id}` : list.name, sublabel: 'Series', count: filteredCount(list.tv, 'tv'), loading: list.loading, error: list.error }
    ])
  ]

  const renderGrid = () => {
    if (activeTab === 'movies') return <MediaGrid items={movies} jellyfinMap={jellyfinMap} providersMap={providersMap} selectedPlatforms={selectedPlatforms} filterEnabled={filterEnabled} loading={loading.movies} type="movie" />
    if (activeTab === 'tv') return <MediaGrid items={tvShows} jellyfinMap={jellyfinMap} providersMap={providersMap} selectedPlatforms={selectedPlatforms} filterEnabled={filterEnabled} loading={loading.tv} type="tv" />
    const m = activeTab.match(/^list_(.+)_(movie|tv)$/)
    if (m) {
      const list = lists.find(l => l.id === m[1])
      if (!list) return null
      const mediaType = m[2]
      return <MediaGrid items={mediaType === 'movie' ? list.movies : list.tv} jellyfinMap={jellyfinMap} providersMap={providersMap} selectedPlatforms={selectedPlatforms} filterEnabled={filterEnabled} loading={list.loading} type={mediaType} />
    }
    return null
  }

  const activeProfile = profiles.find(p => p.id === activeProfileId) || null

  // ── Render ────────────────────────────────────────────────────────────────
  if (!profilesLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <svg className="h-8 w-8 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {showProfileManager && (
        <ProfileManager
          profiles={profiles}
          activeProfileId={activeProfileId}
          onSwitch={switchProfile}
          onAdd={addProfile}
          onDelete={deleteProfile}
          onClose={() => setShowProfileManager(false)}
        />
      )}
      {showSetup && activeProfileId && (
        <PlatformSetup
          initialPlatforms={selectedPlatforms}
          onSave={handlePlatformSave}
          onSkip={() => setShowSetup(false)}
          profileId={activeProfileId}
        />
      )}
      {showListManager && (
        <ListManager
          lists={lists}
          onAdd={addList}
          onRemove={removeList}
          onClose={() => setShowListManager(false)}
          profileId={activeProfileId}
        />
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-gray-950/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center gap-4">

            {/* Logo */}
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/25">
                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              </div>
              <span className="hidden sm:block text-base font-bold tracking-tight">
                My<span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Watchlist</span> Hub
              </span>
            </div>

            {/* Search */}
            <div className="flex-1">
              <SearchBar onResults={handleSearchResults} profileId={activeProfileId} />
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={toggleFilter}
                title={filterEnabled ? 'Desactivar filtro de plataformas' : 'Activar filtro de plataformas'}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  filterEnabled
                    ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2M9 16h6" />
                </svg>
                <span className="hidden sm:inline">{filterEnabled ? 'Filtro ON' : 'Filtrar'}</span>
              </button>

              <button
                onClick={() => setShowListManager(true)}
                title="Gestionar listas de TMDB"
                className={`rounded-full p-2 transition-colors ${
                  lists.length > 0
                    ? 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                </svg>
              </button>

              <button
                onClick={() => setShowSetup(true)}
                title="Configurar plataformas"
                className="rounded-full bg-white/5 p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              <button
                onClick={clearCache}
                title="Recargar datos desde TMDB"
                className="rounded-full bg-white/5 p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Profile switcher */}
              <button
                onClick={() => setShowProfileManager(true)}
                title={activeProfile ? `Perfil: ${activeProfile.name}` : 'Gestionar perfiles'}
                className="ml-1 rounded-full transition-opacity hover:opacity-80"
              >
                <ProfileAvatar profile={activeProfile} size="sm" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Search results */}
        {searchResults.length > 0 ? (
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Resultados de búsqueda
                <span className="ml-2 text-sm font-normal text-gray-500">({searchResults.length})</span>
              </h2>
              <button
                onClick={() => setSearchResults([])}
                className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Limpiar
              </button>
            </div>
            <MediaGrid items={searchResults} jellyfinMap={jellyfinMap} providersMap={providersMap} selectedPlatforms={selectedPlatforms} filterEnabled={filterEnabled} />
          </section>
        ) : (
          <>
            {/* Tabs */}
            <div className="mb-8 overflow-x-auto pb-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 w-fit min-w-full sm:min-w-0">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 flex-col items-start rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`max-w-[9rem] truncate text-xs ${activeTab === tab.id ? 'text-white' : 'text-gray-300'}`}>
                        {tab.label}
                      </span>
                      {tab.loading ? (
                        <svg className="h-3 w-3 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : tab.error ? (
                        <span className="text-xs text-red-400">!</span>
                      ) : tab.count > 0 ? (
                        <span className={`rounded-full px-1.5 py-0.5 text-xs leading-none ${
                          activeTab === tab.id ? 'bg-violet-500/30 text-violet-300' : 'bg-white/5 text-gray-500'
                        }`}>
                          {tab.count}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs font-normal text-gray-500">{tab.sublabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {renderGrid()}
          </>
        )}
      </main>
    </div>
  )
}
