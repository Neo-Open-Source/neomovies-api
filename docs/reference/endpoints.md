# Эндпоинты

Список основных маршрутов (актуально по `api/index.go`).

## System

- `GET /api/v1/health`

## Search

- `GET /api/v1/search/multi`
- `GET /api/v1/search?query=...&source=kp|tmdb&page=...`

## Categories

- `GET /api/v1/categories`
- `GET /api/v1/categories/{id}/movies`
- `GET /api/v1/categories/{id}/media?type=movie|tv&page=...&language=...`

## Movies

- `GET /api/v1/movies/search`
- `GET /api/v1/movies/popular`
- `GET /api/v1/movies/top-rated`
- `GET /api/v1/movies/upcoming`
- `GET /api/v1/movies/{id}`
- `GET /api/v1/movies/{id}/recommendations`
- `GET /api/v1/movies/{id}/similar`
- `GET /api/v1/movies/{id}/external-ids`

## TV

- `GET /api/v1/tv/search`
- `GET /api/v1/tv/popular`
- `GET /api/v1/tv/top-rated`
- `GET /api/v1/tv/on-the-air`
- `GET /api/v1/tv/airing-today`
- `GET /api/v1/tv/{id}`
- `GET /api/v1/tv/{id}/recommendations`
- `GET /api/v1/tv/{id}/similar`
- `GET /api/v1/tv/{id}/external-ids`

## Unified

- `GET /api/v1/movie/{id}`
- `GET /api/v1/tv/{id}`

## Players

- `GET /api/v1/players/alloha/{id_type}/{id}`
- `GET /api/v1/players/lumex/{id_type}/{id}`
- `GET /api/v1/players/vibix/{id_type}/{id}`
- `GET /api/v1/players/hdvb/{id_type}/{id}`
- `GET /api/v1/players/collaps/{id_type}/{id}`
- `GET /api/v1/players/vidsrc/{media_type}/{imdb_id}`
- `GET /api/v1/players/vidlink/movie/{imdb_id}`
- `GET /api/v1/players/vidlink/tv/{tmdb_id}`

## Torrents

- `GET /api/v1/torrents/search/by-title`
- `GET /api/v1/torrents/search`
- `GET /api/v1/torrents/search/{imdbId}`
- `GET /api/v1/torrents/movies`
- `GET /api/v1/torrents/series`
- `GET /api/v1/torrents/anime`
- `GET /api/v1/torrents/seasons`

## Reactions

- `GET /api/v1/reactions/{mediaType}/{mediaId}/counts`
- `GET /api/v1/reactions/{mediaType}/{mediaId}/my-reaction` (JWT)
- `POST /api/v1/reactions/{mediaType}/{mediaId}` (JWT)
- `DELETE /api/v1/reactions/{mediaType}/{mediaId}` (JWT)
- `GET /api/v1/reactions/my` (JWT)

## Favorites (JWT)

- `GET /api/v1/favorites`
- `POST /api/v1/favorites/{id}`
- `DELETE /api/v1/favorites/{id}`
- `GET /api/v1/favorites/{id}/check`

## Support

- `GET /api/v1/support/list`
