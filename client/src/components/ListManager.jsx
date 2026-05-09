import { useState } from 'react'

function parseListId(value) {
  const urlMatch = value.match(/\/list\/(\d+)/)
  if (urlMatch) return urlMatch[1]
  const trimmed = value.trim()
  return /^\d+$/.test(trimmed) ? trimmed : null
}

export default function ListManager({ lists, onAdd, onRemove, onClose, profileId }) {
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState(null) // { loading, id, name, total, error }

  const handleSearch = async () => {
    const id = parseListId(input)
    if (!id) {
      setPreview({ error: 'ID inválido. Usa el número o la URL completa de TMDB.' })
      return
    }
    if (lists.some(l => l.id === id)) {
      setPreview({ error: 'Esta lista ya está añadida.' })
      return
    }
    setPreview({ loading: true, id })
    try {
      const q = profileId ? `?profile=${profileId}` : ''
      const res = await fetch(`/api/list/${id}${q}`)
      if (!res.ok) throw new Error(res.status === 404 ? 'Lista no encontrada' : `Error ${res.status}`)
      const data = await res.json()
      setPreview({ id, name: data.name, total: data.total, loading: false })
    } catch (err) {
      setPreview({ error: err.message, loading: false })
    }
  }

  const handleAdd = () => {
    if (!preview?.name) return
    onAdd(preview.id)
    setInput('')
    setPreview(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-gray-900 shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/20">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Listas de TMDB</h2>
              <p className="text-xs text-gray-400">Añade listas públicas o privadas por ID o URL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Add list */}
        <div className="border-b border-white/5 px-6 py-5 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setPreview(null) }}
              onKeyDown={handleKeyDown}
              placeholder="ID numérico o URL de lista TMDB"
              className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none ring-1 ring-white/10 focus:ring-violet-500/50 transition-all"
            />
            <button
              onClick={handleSearch}
              disabled={!input.trim()}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:bg-white/15 hover:text-white disabled:opacity-40"
            >
              Buscar
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <div className={`rounded-xl px-4 py-3 text-sm ${
              preview.error
                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                : preview.loading
                ? 'bg-white/5 border border-white/10 text-gray-400'
                : 'bg-emerald-500/10 border border-emerald-500/20'
            }`}>
              {preview.loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Buscando lista…
                </span>
              ) : preview.error ? (
                preview.error
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-emerald-300">{preview.name}</p>
                    <p className="text-xs text-emerald-400/70 mt-0.5">{preview.total} elementos · ID {preview.id}</p>
                  </div>
                  <button
                    onClick={handleAdd}
                    className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:brightness-110"
                  >
                    Añadir
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Saved lists */}
        <div className="max-h-72 overflow-y-auto px-6 py-4 space-y-2">
          {lists.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600">No hay listas añadidas todavía</p>
          ) : (
            lists.map(list => (
              <div
                key={list.id}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-200">
                    {list.loading ? (
                      <span className="text-gray-500">Cargando lista {list.id}…</span>
                    ) : list.error ? (
                      <span className="text-red-400">Error — ID {list.id}</span>
                    ) : (
                      list.name
                    )}
                  </p>
                  {!list.loading && !list.error && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {list.movies.length} películas · {list.tv.length} series · ID {list.id}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemove(list.id)}
                  className="ml-3 shrink-0 rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  title="Eliminar lista"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end border-t border-white/5 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:brightness-110"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
