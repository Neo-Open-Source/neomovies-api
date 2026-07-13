---
id: search
sidebar_position: 1
---

# Media Search

Search is powered by the Kinopoisk API and returns results in Russian.

## v1 — Keyword Search

```bash
GET /api/v1/search?query=matrix&page=1
```

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "kp_326",
        "title": "Матрица",
        "originalTitle": "The Matrix",
        "year": 1999,
        "rating": 8.5,
        "posterUrl": "/api/v1/images/kp_small/326",
        "genres": [{ "id": "фантастика", "name": "фантастика" }],
        "description": "...",
        "type": "movie",
        "externalIds": { "kp": 326, "tmdb": null, "imdb": "tt0133093" }
      }
    ],
    "total": 1,
    "pages": 1
  }
}
```

## v2 — Filtered Search

Advanced search with multiple filters. Powered by the Kinopoisk v2.2 API.

```bash
# By keyword (or use query= instead)
GET /api/v2/search?keyword=matrix
GET /api/v2/search?query=matrix

# By genre (ID or name, comma-separated)
GET /api/v2/search?genres=1&order=RATING
GET /api/v2/search?genres=драма,комедия

# By country (ID or name, comma-separated)
GET /api/v2/search?genres=1&countries=США

# By year range
GET /api/v2/search?yearFrom=2000&yearTo=2010&order=YEAR

# By rating
GET /api/v2/search?ratingFrom=7&ratingTo=10

# By type
GET /api/v2/search?type=FILM
GET /api/v2/search?type=TV_SERIES

# Combined
GET /api/v2/search?query=star&genres=2&countries=США&yearFrom=2010&order=RATING&page=1
```

### Parameters

| Param | Type | Description |
|-------|------|-------------|
| `query` | string | Search keyword (alias for `keyword`) |
| `keyword` | string | Search keyword |
| `genres` | string | Genre IDs or names, comma-separated (e.g. `1`, `3,5`, `драма,комедия`) |
| `countries` | string | Country IDs or names, comma-separated (e.g. `1`, `США,Россия`) |
| `yearFrom` | integer | Start year |
| `yearTo` | integer | End year |
| `ratingFrom` | float | Minimum rating |
| `ratingTo` | float | Maximum rating |
| `type` | string | `FILM`, `TV_SERIES`, `TV_SHOW`, `MINI_SERIES`, or `ALL` |
| `order` | string | `RATING`, `YEAR`, `NUM_VOTE`, `RATING_KO` |
| `page` | integer | Page number (default: 1) |

:::note
Genre and country names are resolved to IDs automatically via the Kinopoisk filters API. You can pass names in any case (e.g. `драма`, `Драма`, `DRAMA`).
:::

## Errors

An empty or whitespace-only query returns `400` on v1:

```bash
GET /api/v1/search?query=
# { "error": "query parameter is required" }
```

## Collections

```bash
# Popular films
GET /api/v1/movies/popular

# Top rated
GET /api/v1/movies/top-rated

# Top rated TV
GET /api/v1/tv/top-rated

# All support ?page=N
```

## Media Details

```bash
# v1 (legacy)
GET /api/v1/movie/kp_326

# v2 (cleaner response — no duplicate fields, genres as strings, all countries)
GET /api/v2/movie/kp_326
```

## Genres

```bash
# List all available genres
GET /api/v1/genres

# Response:
# { "success": true, "data": [
#   { "id": 1, "name": "триллер" },
#   { "id": 2, "name": "драма" },
#   ...
# ]}
```

## Films by Genre

```bash
# All media in genre
GET /api/v1/category/1?order=RATING

# Movies only
GET /api/v1/category/1?films&order=RATING

# TV series only
GET /api/v1/category/1?tv&order=RATING

# Pagination
GET /api/v1/category/1?films&page=2
```
