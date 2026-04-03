import { useState } from 'react'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

function ProviderBadge({ provider }) {
  return (
    <div className="group relative">
      <img
        src={`${TMDB_IMG}/original${provider.logo_path}`}
        alt={provider.provider_name}
        loading="lazy"
        className="h-7 w-7 rounded-lg object-cover shadow-sm transition-transform group-hover:scale-110"
      />
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-10">
        {provider.provider_name}
      </div>
    </div>
  )
}

function JellyfinBadge() {
  return (
    <div className="group relative">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 shadow-sm shadow-teal-500/40 transition-transform group-hover:scale-110">
        {/* Jellyfin "play" icon */}
        <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-10">
        En Jellyfin
      </div>
    </div>
  )
}

export default function MediaCard({ item, providers, isInJellyfin, type }) {
  const [imgError, setImgError] = useState(false)

  const title = item.title || item.name || 'Sin título'
  const year = (item.release_date || item.first_air_date || '').slice(0, 4)
  const posterUrl = item.poster_path && !imgError
    ? `${TMDB_IMG}/w342${item.poster_path}`
    : null

  // Merge flatrate + free, deduplicate by provider_id
  const flatrate = providers?.flatrate || []
  const free = providers?.free || []
  const allProviders = [...flatrate, ...free].filter(
    (p, i, arr) => arr.findIndex(x => x.provider_id === p.provider_id) === i
  )

  const tmdbUrl = `https://www.themoviedb.org/${type}/${item.id}`

  return (
    <a
      href={tmdbUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-xl bg-gray-900 ring-1 ring-white/5 transition-all duration-300 hover:scale-[1.03] hover:ring-white/15 hover:shadow-2xl hover:shadow-black/60"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full bg-gray-800 overflow-hidden">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <svg className="h-10 w-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <span className="text-xs text-gray-500 leading-snug line-clamp-2">{title}</span>
          </div>
        )}

        {/* Gradient for readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-gray-900/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Jellyfin "Local" chip */}
        {isInJellyfin && (
          <div className="absolute left-2 top-2 rounded-full bg-teal-500/90 px-2 py-0.5 text-xs font-semibold text-white shadow backdrop-blur-sm">
            Local
          </div>
        )}

        {/* Rating */}
        {item.vote_average > 0 && (
          <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-xs font-medium text-yellow-400 backdrop-blur-sm">
            <span>★</span>
            <span>{item.vote_average.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Info row */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3
            className="truncate text-sm font-semibold leading-tight text-white"
            title={title}
          >
            {title}
          </h3>
          {year && <p className="mt-0.5 text-xs text-gray-500">{year}</p>}
        </div>

        {/* Platform icons */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {allProviders.slice(0, 4).map(p => (
            <ProviderBadge key={p.provider_id} provider={p} />
          ))}
          {allProviders.length > 4 && (
            <span className="text-xs text-gray-500">+{allProviders.length - 4}</span>
          )}
          {isInJellyfin && <JellyfinBadge />}
          {allProviders.length === 0 && !isInJellyfin && providers && (
            <span className="text-xs text-gray-600 italic">Sin streaming</span>
          )}
          {!providers && (
            <div className="flex gap-1">
              {[1, 2].map(i => (
                <div key={i} className="h-7 w-7 animate-pulse rounded-lg bg-gray-800" />
              ))}
            </div>
          )}
        </div>
      </div>
    </a>
  )
}
