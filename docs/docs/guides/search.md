---
id: search
sidebar_position: 1
---

# Media Search

Search is powered by the Kinopoisk API and returns results in Russian.

## Basic Search

```bash
GET /api/v1/search?query=matrix
```

```json
{
  "success": true,
  "data": {
    "keyword": "matrix",
    "pagesCount": 5,
    "films": [
      {
        "filmId": 326,
        "nameRu": "Матрица",
        "nameEn": "The Matrix",
        "year": "1999",
        "rating": "8.5",
        "posterUrl": "https://..."
      }
    ]
  }
}
```

## Pagination

```bash
GET /api/v1/search?query=matrix&page=2
```

## Errors

An empty or whitespace-only query returns `400`:

```bash
GET /api/v1/search?query=
# { "error": "query parameter is required" }
```

## Popular and Top Rated

```bash
# Popular films
GET /api/v1/movies/popular

# Top rated
GET /api/v1/movies/top-rated

# Both support ?page=N
```
