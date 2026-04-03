import { useState, useEffect, useCallback } from 'react'
import PlatformSetup from './components/PlatformSetup'
import SearchBar from './components/SearchBar'
import MediaGrid from './components/MediaGrid'

const STORAGE_PLATFORMS = 'mwh_platforms'
const STORAGE_FILTER = 'mwh_filter_enabled'

export default function App() {
  const [activeTab, setActiveTab] = useState('movies')
  const [movies, setMovies] = useState([])
  const [tvShows, setTvShows] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [jellyfinMap, setJellyfinMap] = useState({})
  const [providersMap, setProvidersMap] = useState({})
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [showSetup, setShowSetup] = useState(false)
  const [filterEnabled, setFilterEnabled] = useState(false)
  const [loading, setLoading] = useState({ movies: true, tv: true })
  const [error, setError] = useState(null)

  // Load persisted settings
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PLATFORMS)
    if (!saved) {
      setShowSetup(true)
    } else {
      setSelectedPlatforms(JSON.parse(saved))
      setFilterEnabled(localStorage.getItem(STORAGE_FILTER) === 'true')
    }
  }, [])

  // Fetch providers for a list of items (batched, updates map progressively)
  const fetchProviders = useCallback(async (items) => {
    const BATCH = 50
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH)
      try {
        const res = await fetch('/api/providers/batch', {
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
  }, [])

  // Fetch Jellyfin library (non-blocking)
  useEffect(() => {
    fetch('/api/jellyfin/library')
      .then(r => r.json())
      .then(setJellyfinMap)
      .catch(() => {})
  }, [])

  // Fetch watchlists
  useEffect(() => {
    fetch('/api/watchlist/movies')
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

    fetch('/api/watchlist/tv')
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
  }, [fetchProviders])

  const handleSearchResults = useCallback((results) => {
    setSearchResults(results)
    if (results.length) {
      fetchProviders(results.map(r => ({ type: r.media_type, id: r.id })))
    }
  }, [fetchProviders])

  const handlePlatformSave = (platforms) => {
    setSelectedPlatforms(platforms)
    localStorage.setItem(STORAGE_PLATFORMS, JSON.stringify(platforms))
    setShowSetup(false)
  }

  const toggleFilter = () => {
    const next = !filterEnabled
    setFilterEnabled(next)
    localStorage.setItem(STORAGE_FILTER, String(next))
  }

  const clearCache = async () => {
    await fetch('/api/cache/clear', { method: 'POST' })
    window.location.reload()
  }

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
    { id: 'movies', label: 'Películas', count: filteredCount(movies, 'movie') },
    { id: 'tv', label: 'Series', count: filteredCount(tvShows, 'tv') }
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {showSetup && (
        <PlatformSetup
          initialPlatforms={selectedPlatforms}
          onSave={handlePlatformSave}
          onSkip={() => setShowSetup(false)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
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

            {/* Search (grows to fill) */}
            <div className="flex-1">
              <SearchBar onResults={handleSearchResults} />
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
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Search results view */}
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
            <MediaGrid
              items={searchResults}
              jellyfinMap={jellyfinMap}
              providersMap={providersMap}
              selectedPlatforms={selectedPlatforms}
              filterEnabled={filterEnabled}
            />
          </section>
        ) : (
          <>
            {/* Tabs */}
            <div className="mb-8 flex items-center gap-1 rounded-xl bg-white/5 p-1 w-fit">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs leading-none ${
                      activeTab === tab.id
                        ? 'bg-violet-500/30 text-violet-300'
                        : 'bg-white/5 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'movies' ? (
              <MediaGrid
                items={movies}
                jellyfinMap={jellyfinMap}
                providersMap={providersMap}
                selectedPlatforms={selectedPlatforms}
                filterEnabled={filterEnabled}
                loading={loading.movies}
                type="movie"
              />
            ) : (
              <MediaGrid
                items={tvShows}
                jellyfinMap={jellyfinMap}
                providersMap={providersMap}
                selectedPlatforms={selectedPlatforms}
                filterEnabled={filterEnabled}
                loading={loading.tv}
                type="tv"
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
