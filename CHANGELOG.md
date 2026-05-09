# Changelog

## [0.1.0] — 2026-05-09

### Added

#### Sistema de perfiles
- Soporte para múltiples perfiles, cada uno con su propio TMDB Read Access Token.
- Creación de perfiles desde la UI con validación del token contra la API de TMDB antes de guardar.
- Eliminación de perfiles (con protección para no borrar el único perfil existente).
- Cambio de perfil activo desde el header sin recargar la página.
- Avatar de perfil con color único generado a partir del ID, visible en el header.
- Perfil "Principal" creado automáticamente al arrancar si no existe ninguno y hay credenciales en las variables de entorno.
- Perfiles almacenados en `data/profiles.json` (servidor); tokens nunca expuestos en la API pública.

#### Configuración por perfil
- Plataformas seleccionadas y estado del filtro guardados por perfil en `localStorage`.
- Cache del servidor invalidada por perfil al borrarla o al eliminar un perfil.
- Al cambiar de perfil, la UI resetea estado (watchlist, listas, filtros) y carga la configuración del nuevo perfil.

#### Listas de TMDB
- Añadir listas públicas o privadas de TMDB mediante ID numérico o URL completa.
- Vista previa de la lista (nombre y número de elementos) antes de confirmar la adición.
- Cada lista aparece como tabs separados (Películas / Series) junto a la watchlist principal.
- Listas persistidas por perfil en `localStorage`; recuperadas automáticamente al iniciar.
- Eliminación de listas con limpieza del tab activo si era el de la lista borrada.
- Soporte de paginación para listas con más de una página de resultados.

#### API (servidor)
- Nuevos endpoints REST para perfiles: `GET /api/profiles`, `POST /api/profiles`, `DELETE /api/profiles/:id`.
- Nuevo endpoint `GET /api/list/:listId` para obtener el contenido de una lista de TMDB.
- Todos los endpoints de watchlist, providers y listas aceptan el parámetro `?profile=` para seleccionar las credenciales del perfil.
- Cache del servidor organizada por perfil; el endpoint `POST /api/cache/clear` acepta `?profile=` para limpiar solo la del perfil activo.

---

## [0.0.0] — inicial

### Features base

- Watchlist de películas y series sincronizada desde una cuenta de TMDB (vía variables de entorno).
- Detección de disponibilidad en plataformas de streaming para España (TMDB Watch Providers).
- Filtro de contenido por plataformas seleccionadas, activable/desactivable desde el header.
- Integración con Jellyfin: marca visualmente qué títulos están disponibles en la biblioteca local.
- Búsqueda multi en TMDB (películas y series) con resultados en tiempo real.
- Cache en memoria del servidor con expiración por TTL y botón de recarga manual.
- UI con tabs Películas / Series y diseño dark con Tailwind CSS.
- Configuración de plataformas guardada en `localStorage` (global, sin perfiles).
