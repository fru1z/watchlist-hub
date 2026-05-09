import { useState } from 'react'

const COLORS = [
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-indigo-500 to-violet-600',
]

export function profileColor(id) {
  if (!id) return COLORS[0]
  const hash = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return COLORS[hash % COLORS.length]
}

export function ProfileAvatar({ profile, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
  return (
    <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${profileColor(profile?.id)} font-bold text-white shadow`}>
      {(profile?.name?.[0] || '?').toUpperCase()}
    </div>
  )
}

export default function ProfileManager({ profiles, activeProfileId, onSwitch, onAdd, onDelete, onClose }) {
  const [showForm, setShowForm] = useState(profiles.length === 0)
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const handleAdd = async () => {
    if (!name.trim() || !token.trim()) {
      setFormError('Nombre y token son obligatorios')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), tmdbReadAccessToken: token.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onAdd(data)
      setName('')
      setToken('')
      setShowForm(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await fetch(`/api/profiles/${id}`, { method: 'DELETE' })
      onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gray-900 shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/20">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Perfiles</h2>
              <p className="text-xs text-gray-400">Cada perfil usa su propia cuenta de TMDB</p>
            </div>
          </div>
          {profiles.length > 0 && (
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Profile list */}
        {profiles.length > 0 && (
          <div className="max-h-60 overflow-y-auto px-6 py-4 space-y-2">
            {profiles.map(profile => {
              const isActive = profile.id === activeProfileId
              return (
                <div
                  key={profile.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                    isActive ? 'bg-violet-500/15 ring-1 ring-violet-500/30' : 'bg-white/5'
                  }`}
                >
                  <ProfileAvatar profile={profile} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
                    <p className="text-xs text-gray-500">ID {profile.tmdbAccountId || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => { onSwitch(profile.id); onClose() }}
                        className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        Usar
                      </button>
                    )}
                    {isActive && (
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-300">
                        Activo
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(profile.id)}
                      disabled={deletingId === profile.id || profiles.length === 1}
                      title={profiles.length === 1 ? 'No se puede eliminar el único perfil' : 'Eliminar'}
                      className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add form */}
        {showForm ? (
          <div className="border-t border-white/5 px-6 py-5 space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Nuevo perfil</p>

            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre (ej: Fernando)"
              maxLength={30}
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none ring-1 ring-white/10 focus:ring-violet-500/50 transition-all"
            />

            <div className="space-y-1">
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="TMDB Read Access Token"
                className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none ring-1 ring-white/10 focus:ring-violet-500/50 transition-all font-mono"
              />
              <p className="text-xs text-gray-600">
                En tmdb.org → Ajustes → API → Read Access Token
              </p>
            </div>

            {formError && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 border border-red-500/20">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              {profiles.length > 0 && (
                <button onClick={() => { setShowForm(false); setFormError(null) }} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                  Cancelar
                </button>
              )}
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:brightness-110 disabled:opacity-60"
              >
                {saving && (
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {saving ? 'Verificando…' : 'Guardar perfil'}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-white/5 px-6 py-4">
            <button
              onClick={() => setShowForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-sm text-gray-500 transition-colors hover:border-white/20 hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Añadir perfil
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
