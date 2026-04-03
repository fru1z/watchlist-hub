# MyWatchlist Hub

Interfaz unificada que combina tu Watchlist de TMDB con la disponibilidad en plataformas de streaming (España) y tu biblioteca local de Jellyfin.

![Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Stack](https://img.shields.io/badge/Node-Express-339933?logo=node.js&logoColor=white)
![Stack](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Stack](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

---

## Características

- **Watchlist de TMDB** — carga automática de todas las páginas de películas y series
- **Disponibilidad en streaming** — iconos de plataformas de España (Netflix, Disney+, Max, Prime…) via JustWatch/TMDB
- **Integración Jellyfin** — detecta qué títulos tienes en local comparando el `ProviderIds.Tmdb`
- **Filtro por suscripciones** — muestra solo lo disponible en tus plataformas contratadas
- **Buscador** — búsqueda multi con debounce sobre el catálogo completo de TMDB
- **Caché en memoria** — evita peticiones repetidas a TMDB y Jellyfin
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

Edita `.env` con tus credenciales (ver sección [Variables de entorno](#variables-de-entorno)).

### 2. Crear la red externa de Docker (si no existe)

```bash
docker network create nginx_network
```

### 3. Construir y arrancar

```bash
docker compose up -d --build
```

La app queda disponible en `http://localhost:4895`.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `TMDB_READ_ACCESS_TOKEN` | Sí* | API Read Access Token (JWT). Obtenlo en [tmdb.org/settings/api](https://www.themoviedb.org/settings/api) |
| `TMDB_API_KEY` | Sí* | API Key clásica v3. Alternativa al token anterior |
| `TMDB_SESSION_ID` | Si usas `TMDB_API_KEY` | Session ID de tu cuenta TMDB |
| `TMDB_ACCOUNT_ID` | No | ID numérico de tu cuenta. Se detecta automáticamente con el token |
| `JELLYFIN_URL` | No | URL de tu servidor Jellyfin, ej: `http://192.168.1.100:8096` |
| `JELLYFIN_API_KEY` | No | API Key de Jellyfin (Dashboard → Claves de API) |
| `JELLYFIN_USER_ID` | No | ID de usuario de Jellyfin. Si se omite, se usa el primer usuario |
| `PORT` | No | Puerto del servidor. Por defecto `4895` |

> **\* Autenticación TMDB:** usa `TMDB_READ_ACCESS_TOKEN` (recomendado, no necesita session_id ni account_id manual) **o** la combinación `TMDB_API_KEY` + `TMDB_SESSION_ID`.

### Cómo obtener el API Read Access Token de TMDB

1. Accede a [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
2. En la sección **API Read Access Token** copia el token JWT (empieza por `eyJ…`)
3. Pégalo en `TMDB_READ_ACCESS_TOKEN` en tu `.env`

---

## Uso

### Primer acceso

Al abrir la app por primera vez aparece un modal para seleccionar tus plataformas de streaming contratadas en España. La selección se guarda en `localStorage` del navegador.

### Filtrado

El botón **Filtrar** del header activa/desactiva el filtrado por plataformas. Cuando está activo:
- Solo se muestran títulos disponibles en tus plataformas seleccionadas
- Los títulos presentes en Jellyfin siempre se muestran independientemente
- El contador de las pestañas refleja los títulos visibles, no el total

### Actualizar datos

El botón de recarga (↺) del header limpia la caché del servidor y recarga todos los datos desde TMDB y Jellyfin.

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
│            React + Tailwind CSS                 │
└────────────────────┬────────────────────────────┘
                     │ /api/*
┌────────────────────▼────────────────────────────┐
│            Express API Gateway                  │
│              (server.js :4895)                  │
│                                                 │
│  • Caché en memoria (30 min watchlist)          │
│  • Paginación automática TMDB                   │
│  • Batch de providers (20 req concurrentes)     │
└──────────┬──────────────────────┬───────────────┘
           │                      │
┌──────────▼──────────┐  ┌───────▼───────────────┐
│     TMDB API v3     │  │   Jellyfin API        │
│  Watchlist + JustW. │  │  /Users/{id}/Items    │
└─────────────────────┘  └───────────────────────┘
```

### Match Jellyfin ↔ TMDB

Jellyfin devuelve `ProviderIds.Tmdb` en cada elemento de la biblioteca. El servidor construye un mapa `{ tmdbId → item }` y lo compara directamente con el ID de cada entrada de la Watchlist de TMDB. No hay búsqueda por título, por lo que el match es exacto y no genera falsos positivos.

### Caché

| Recurso | TTL |
|---|---|
| Watchlist (películas y series) | 30 minutos |
| Providers por título | 6 horas |
| Lista de plataformas (España) | 24 horas |
| Biblioteca Jellyfin | 10 minutos |

---

## Nginx

Pega el bloque del archivo `nginx-location.conf` dentro de tu `server {}`:

```nginx
location /watchlist/ {
    proxy_pass         http://mywatchlist-hub:4895/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

---

## Estructura del proyecto

```
watchlist/
├── server.js               # API Gateway (Express)
├── package.json
├── Dockerfile              # Multistage: build React → servidor Node
├── docker-compose.yml
├── .env.example
├── nginx-location.conf
└── client/
    ├── src/
    │   ├── App.jsx         # Componente principal y estado global
    │   ├── index.css
    │   └── components/
    │       ├── PlatformSetup.jsx  # Modal de selección de plataformas
    │       ├── SearchBar.jsx      # Búsqueda con debounce
    │       ├── MediaCard.jsx      # Tarjeta de película/serie
    │       └── MediaGrid.jsx      # Grid con skeleton y filtrado
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```
