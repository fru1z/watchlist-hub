import { useState, useCallback, useRef } from 'react'

export default function SearchBar({ onResults }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  const handleChange = useCallback((e) => {
    const value = e.target.value
    setQuery(value)
    clearTimeout(debounceRef.current)

    if (!value.trim()) {
      onResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(value.trim())}`)
        const data = await res.json()
        onResults(data.results || [])
      } catch (err) {
        console.error('search error:', err)
        onResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [onResults])

  const clear = () => {
    setQuery('')
    onResults([])
    clearTimeout(debounceRef.current)
    setLoading(false)
  }

  return (
    <div className="relative w-full max-w-sm">
      {/* Left icon */}
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        {loading ? (
          <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </span>

      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Buscar películas o series…"
        className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-violet-500/50 focus:bg-white/10 focus:ring-1 focus:ring-violet-500/30"
      />

      {query && (
        <button
          onClick={clear}
          className="absolute inset-y-0 right-2.5 flex items-center text-gray-500 transition-colors hover:text-white"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  )
}
