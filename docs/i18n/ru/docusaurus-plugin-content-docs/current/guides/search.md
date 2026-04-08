---
id: search
sidebar_position: 1
---

# Поиск медиа

Поиск работает через Kinopoisk API и возвращает унифицированный формат ответа:

```json
{
  "success": true,
  "data": {
    "results": [],
    "total": 0,
    "pages": 0
  }
}
```

## Базовый поиск

```bash
GET /api/v1/search?query=матрица
```

Пример элемента из `data.results`:

```json
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
```

## Пагинация

```bash
GET /api/v1/search?query=матрица&page=2
```

## Популярное и топ

```bash
# Популярные
GET /api/v1/movies/popular?page=1

# Топ-250
GET /api/v1/movies/top-rated?page=1
```

Оба эндпоинта возвращают тот же формат `SearchResponse` в `data`.

## Детали фильма/сериала

```bash
GET /api/v1/movie/326
GET /api/v1/movie/kp_326
```

## Ошибки

Пустой или пробельный запрос вернет `400`:

```bash
GET /api/v1/search?query=
# { "error": "query parameter is required" }
```
