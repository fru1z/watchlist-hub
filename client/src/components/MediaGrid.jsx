import MediaCard from './MediaCard'

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl bg-gray-900 ring-1 ring-white/5">
      <div className="aspect-[2/3] bg-gray-800" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded-md bg-gray-800" />
        <div className="h-3 w-1/3 rounded-md bg-gray-800" />
        <div className="flex gap-1.5 pt-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-7 w-7 rounded-lg bg-gray-800" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MediaGrid({
  items,
  jellyfinMap,
  providersMap,
  selectedPlatforms,
  filterEnabled,
  loading,
  type
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  // Resolve effective media type for each item
  const mediaTypeOf = item => item.media_type || type || 'movie'
  const providerKeyOf = item => `${mediaTypeOf(item)}_${item.id}`

  // Apply platform filter only when enabled and platforms are selected
  let displayItems = items
  if (filterEnabled && selectedPlatforms.length > 0) {
    displayItems = items.filter(item => {
      // Always show items available locally
      if (jellyfinMap[String(item.id)]) return true

      const prov = providersMap[providerKeyOf(item)]
      // If providers not yet loaded, include item (optimistic)
      if (prov === undefined) return true

      const flatrateIds = (prov.flatrate || []).map(p => p.provider_id)
      const freeIds = (prov.free || []).map(p => p.provider_id)
      return selectedPlatforms.some(id => flatrateIds.includes(id) || freeIds.includes(id))
    })
  }

  if (displayItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="mb-4 rounded-2xl bg-white/5 p-6">
          <svg className="h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        </div>
        <p className="font-medium text-gray-400">
          {filterEnabled
            ? 'Nada disponible en tus plataformas'
            : 'Tu watchlist está vacía'}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {filterEnabled
            ? 'Desactiva el filtro para ver toda la lista'
            : 'Añade contenido desde TMDB para verlo aquí'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {displayItems.map(item => (
        <MediaCard
          key={`${mediaTypeOf(item)}_${item.id}`}
          item={item}
          providers={providersMap[providerKeyOf(item)]}
          isInJellyfin={!!jellyfinMap[String(item.id)]}
          type={mediaTypeOf(item)}
        />
      ))}
    </div>
  )
}
