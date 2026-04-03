import { useState, useEffect, useCallback, memo } from 'react'

const TMDB_IMG = 'https://image.tmdb.org/t/p/original'

const FEATURED_IDS = [8, 119, 337, 1899, 350, 149, 1773, 64, 35, 531]
const DEFAULT_PLATFORMS = [8, 119, 337, 1899, 350]

// Memoized: only re-renders when its own isSelected changes
const ProviderButton = memo(function ProviderButton({ provider, isSelected, onToggle }) {
  return (
    <button
      onClick={() => onToggle(provider.provider_id)}
      title={provider.provider_name}
      className={`group relative aspect-square overflow-hidden rounded-xl transition-all duration-200 ${
        isSelected
          ? 'scale-95 ring-2 ring-violet-500 ring-offset-2 ring-offset-gray-900'
          : 'opacity-40 hover:opacity-70 hover:scale-95'
      }`}
    >
      <img
        src={`${TMDB_IMG}${provider.logo_path}`}
        alt={provider.provider_name}
        className="h-full w-full object-cover"
      />
      {isSelected && (
        <div className="absolute inset-0 flex items-center justify-center bg-violet-600/40">
          <svg className="h-6 w-6 drop-shadow-lg text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  )
})

export default function PlatformSetup({ onSave, onSkip, initialPlatforms }) {
  const [providers, setProviders] = useState([])
  const [selected, setSelected] = useState(
    () => new Set(initialPlatforms?.length > 0 ? initialPlatforms : DEFAULT_PLATFORMS)
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/providers/list')
      .then(r => r.json())
      .then(data => {
        const sorted = [...data].sort((a, b) => {
          const ai = FEATURED_IDS.indexOf(a.provider_id)
          const bi = FEATURED_IDS.indexOf(b.provider_id)
          if (ai !== -1 && bi !== -1) return ai - bi
          if (ai !== -1) return -1
          if (bi !== -1) return 1
          return a.display_priority - b.display_priority
        })
        setProviders(sorted.slice(0, 30))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Stable reference: ProviderButton's memo comparison won't be broken by parent re-renders
  const toggle = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = () => setSelected(new Set(providers.map(p => p.provider_id)))
  const clearAll = () => setSelected(new Set())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-gray-900 shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="border-b border-white/5 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/20">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82V15.18a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">¿Qué plataformas tienes?</h2>
              <p className="text-xs text-gray-400">
                Selecciona tus suscripciones en España para filtrar la watchlist
              </p>
            </div>
          </div>
        </div>

        {/* Provider grid */}
        <div className="max-h-[28rem] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-gray-800" />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No se pudieron cargar las plataformas. Comprueba tu configuración de TMDB.
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {providers.map(provider => (
                <ProviderButton
                  key={provider.provider_id}
                  provider={provider}
                  isSelected={selected.has(provider.provider_id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {selected.size} seleccionada{selected.size !== 1 ? 's' : ''}
            </span>
            {providers.length > 0 && (
              <>
                <button onClick={selectAll} className="text-xs text-gray-500 underline hover:text-gray-300 transition-colors">
                  Todas
                </button>
                <button onClick={clearAll} className="text-xs text-gray-500 underline hover:text-gray-300 transition-colors">
                  Ninguna
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onSkip}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:text-white"
            >
              Saltar
            </button>
            <button
              onClick={() => onSave(Array.from(selected))}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-500/40 hover:brightness-110"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
