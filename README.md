# MyWatchlist Hub

Interfaz unificada que combina tu Watchlist de TMDB con la disponibilidad en plataformas de streaming (España) y tu biblioteca local de Jellyfin. Soporta múltiples perfiles para que lo pueda usar más de una persona.

![Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Stack](https://img.shields.io/badge/Node-Express-339933?logo=node.js&logoColor=white)
![Stack](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Stack](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

---

## Características

- **Múltiples perfiles** — cada usuario gestiona su propia cuenta de TMDB desde la interfaz, sin tocar el servidor
- **Watchlist de TMDB** — carga automática de todas las páginas de películas y series por perfil
- **Listas de TMDB** — añade cualquier lista pública o privada como fuente adicional con sus propias pestañas
- **Disponibilidad en streaming** — iconos de plataformas de España (Netflix, Disney+, Max, Prime…) via JustWatch/TMDB
- **Filtro por suscripciones** — muestra solo lo disponible en tus plataformas; con el filtro activo las tarjetas solo muestran tus plataformas contratadas
- **Integración Jellyfin** — detecta qué títulos tienes en local comparando el `ProviderIds.Tmdb`; los títulos locales siempre se muestran
- **Buscador** — búsqueda multi con debounce sobre el catálogo completo de TMDB
- **Caché en memoria** — evita peticiones repetidas; scoped por perfil en watchlists y listas
- **Persistencia de perfiles** — `profiles.json` montado como volumen Docker; las preferencias de plataformas y listas se guardan en `localStorage` del navegador
- **Diseño oscuro** — estilo Netflix/JustWatch, responsive desde móvil

---

## Requisitos previos

- Docker + Docker Compose
- Cuenta en [TMDB](https://www.themoviedb.org) con contenido en la Watchlist
- *(Opcional)* Servidor Jellyfin accesible en red local

---

## Instalación

### 1. Clonar y configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con las credenciales del primer perfil (ver sección [Variables de entorno](#variables-de-entorno)).

### 2. Crear directorio de datos persistentes

```bash
mkdir -p data
```

### 3. Construir y arrancar

```bash
npm install --package-lock-only && cd client && npm install --package-lock-only

sh build-and-run.sh
```

La app queda disponible en `http://localhost:4895`.

> En el primer arranque, si `TMDB_READ_ACCESS_TOKEN` está definido en `.env`, se crea automáticamente un perfil **"Principal"**. Los siguientes perfiles se añaden desde la propia interfaz.

---

## Variables de entorno

Estas variables configuran el **primer perfil** (seed) y la integración con Jellyfin, que es compartida por todos los perfiles.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `TMDB_READ_ACCESS_TOKEN` | Sí* | API Read Access Token (JWT). Primer perfil. Ver [cómo obtenerlo](#cómo-obtener-el-read-access-token-de-tmdb) |
| `TMDB_API_KEY` | Sí* | API Key clásica v3. Alternativa al token anterior |
| `TMDB_SESSION_ID` | Si usas `TMDB_API_KEY` | Session ID de la cuenta TMDB |
| `TMDB_ACCOUNT_ID` | No | ID numérico de cuenta. Se detecta automáticamente con el token |
| `JELLYFIN_URL` | No | URL del servidor Jellyfin, ej: `http://192.168.1.100:8096` |
| `JELLYFIN_API_KEY` | No | API Key de Jellyfin (Dashboard → Claves de API) |
| `JELLYFIN_USER_ID` | No | ID de usuario de Jellyfin. Si se omite, se usa el primer usuario |
| `PORT` | No | Puerto del servidor. Por defecto `4895` |

> **\* Autenticación TMDB:** usa `TMDB_READ_ACCESS_TOKEN` (recomendado) **o** la combinación `TMDB_API_KEY` + `TMDB_SESSION_ID`. Los perfiles adicionales se configuran exclusivamente desde la interfaz.

### Cómo obtener el Read Access Token de TMDB

1. Accede a [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
2. En la sección **API Read Access Token** copia el token JWT (empieza por `eyJ…`)
3. Pégalo en `TMDB_READ_ACCESS_TOKEN` en tu `.env`

---

## Uso

### Perfiles

Cada persona tiene su propio perfil con su cuenta de TMDB. Los perfiles se gestionan desde el avatar en la esquina superior derecha del header.

- **Añadir perfil:** nombre + TMDB Read Access Token. El token se valida contra la API antes de guardarse; nunca se envía al navegador.
- **Cambiar de perfil:** botón "Usar" en el listado de perfiles. Los datos (watchlist, listas, plataformas) cambian automáticamente.
- **Eliminar perfil:** icono de papelera. No se puede eliminar el único perfil existente.

Los perfiles se almacenan en `data/profiles.json`, montado como volumen Docker para persistir entre reinicios.

### Listas de TMDB

Además de la Watchlist personal, puedes añadir cualquier lista de TMDB (pública o privada) como fuente adicional. Se accede desde el icono de lista en el header.

- Introduce el **ID numérico** o la **URL completa** de la lista (ej: `https://www.themoviedb.org/list/8311706`)
- Se muestra una previsualización antes de confirmar
- Cada lista añade dos pestañas propias: **Películas** y **Series**
- Las listas son por perfil y se guardan en el `localStorage` del navegador

### Pestañas

| Pestaña | Contenido |
|---|---|
| Watchlist — Películas | Películas de tu watchlist de TMDB |
| Watchlist — Series | Series de tu watchlist de TMDB |
| [Nombre lista] — Películas | Películas de una lista añadida |
| [Nombre lista] — Series | Series de una lista añadida |

### Filtrado por plataformas

El botón **Filtrar** del header activa el filtrado por suscripciones. Cuando está activo:

- Solo se muestran títulos disponibles en tus plataformas seleccionadas
- Las tarjetas solo muestran los logos de **tus** plataformas (no todas las disponibles)
- Los títulos presentes en Jellyfin se muestran siempre
- El contador de las pestañas refleja los títulos visibles, no el total

Las plataformas seleccionadas son **por perfil** y se guardan en `localStorage`.

### Actualizar datos

El botón ↺ del header limpia la caché del servidor (scoped al perfil activo) y recarga todos los datos desde TMDB y Jellyfin.

### Desarrollo local (sin Docker)

```bash
# Instalar dependencias
npm install
cd client && npm install && cd ..

# Terminal 1 — backend en :4895
npm run dev:server

# Terminal 2 — frontend en :5173 (proxy /api → :4895)
npm run dev:client
```

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                   Navegador                     │
│     React 18 + Tailwind CSS                     │
│  localStorage: plataformas, listas, perfil      │
└────────────────────┬────────────────────────────┘
                     │ /api/*?profile=<id>
┌────────────────────▼────────────────────────────┐
│            Express API Gateway                  │
│              (server.js :4895)                  │
│                                                 │
│  • Perfiles → data/profiles.json (volumen)      │
│  • Caché en memoria scoped por perfil           │
│  • Paginación automática TMDB                   │
│  • Batch de providers (20 req concurrentes)     │
└──────────┬──────────────────────┬───────────────┘
           │                      │
┌──────────▼──────────┐  ┌───────▼───────────────┐
│     TMDB API v3     │  │   Jellyfin API        │
│  Watchlist · Listas │  │  /Users/{id}/Items    │
│  Providers · Search │  │  (compartido)         │
└─────────────────────┘  └───────────────────────┘
```

### Seguridad de credenciales

Los tokens TMDB se almacenan únicamente en `data/profiles.json` en el servidor. Los endpoints `GET /api/profiles` nunca devuelven tokens al cliente. Al crear un perfil, el token se valida contra `/account` de TMDB antes de persistirse.

### Match Jellyfin ↔ TMDB

Jellyfin devuelve `ProviderIds.Tmdb` en cada elemento. El servidor construye un mapa `{ tmdbId → item }` y lo compara directamente con los IDs de TMDB. El match es exacto, no hay búsqueda por título.

### Caché

| Recurso | TTL | Scope |
|---|---|---|
| Watchlist (películas y series) | 30 min | Por perfil |
| Listas de TMDB | 30 min | Por perfil |
| Providers por título | 6 horas | Global |
| Lista de plataformas (España) | 24 horas | Global |
| Biblioteca Jellyfin | 10 min | Global |

---

## Persistencia de datos

| Dato | Dónde se guarda |
|---|---|
| Perfiles y tokens TMDB | `data/profiles.json` (servidor, volumen Docker) |
| Plataformas seleccionadas | `localStorage` del navegador (por perfil) |
| Listas añadidas | `localStorage` del navegador (por perfil) |
| Perfil activo | `localStorage` del navegador |
| Filtro activado/desactivado | `localStorage` del navegador (por perfil) |



