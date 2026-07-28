---
sidebar_position: 4
---

# Search

The search endpoint supports both text search and advanced filtering via TMDB discover.

## Text Search

```http
GET /api/v1/search?q=batman
```

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "tmdbId": 268,
        "title": "Batman",
        "originalTitle": "Batman",
        "overview": "...",
        "poster": "https://image.tmdb.org/t/p/w500/...",
        "releaseDate": "1989-06-23",
        "genres": null,
        "genreIds": [28, 80],
        "voteAverage": 7.1,
        "voteCount": 4682
      }
    ],
    "page": 1,
    "totalPages": 5,
    "totalResults": 100
  }
}
```

## Filter by Type

Search only movies or TV shows:

```http
GET /api/v1/search?q=batman&type=movie
GET /api/v1/search?q=breaking&type=tv
```

## Advanced Search (Discover)

When `q` is omitted, search uses TMDB's discover endpoint:

```http
GET /api/v1/search?genre=28&year=2024&rating=7&sort_by=vote_average.desc
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Text search query |
| `type` | string | `movie`, `tv`, or `multi` (default) |
| `genre` | string | Genre ID(s) comma-separated |
| `year` | number | Release year |
| `yearFrom` | number | Release year start |
| `yearTo` | number | Release year end |
| `rating` | number | Minimum rating |
| `ratingFrom` | number | Rating start |
| `ratingTo` | number | Rating end |
| `keyword` | string | Keyword ID |
| `country` | string | Language code (e.g. `en`) |
| `sort_by` | string | Sort method (e.g. `popularity.desc`) |
| `page` | number | Page number |
