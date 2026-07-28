---
sidebar_position: 4
---

# Поиск

Эндпоинт поиска поддерживает как текстовый поиск, так и расширенную фильтрацию через TMDB discover.

## Текстовый поиск

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
        "title": "Бэтмен",
        "poster": "https://image.tmdb.org/t/p/w500/...",
        "releaseDate": "1989-06-23",
        "voteAverage": 7.1
      }
    ],
    "page": 1,
    "totalPages": 5,
    "totalResults": 100
  }
}
```

## Фильтр по типу

Поиск только фильмов или сериалов:

```http
GET /api/v1/search?q=batman&type=movie
GET /api/v1/search?q=breaking&type=tv
```

## Расширенный поиск (Discover)

Если `q` опущен, поиск использует TMDB discover:

```http
GET /api/v1/search?genre=28&year=2024&rating=7&sort_by=vote_average.desc
```

### Параметры

| Параметр | Тип | Описание |
|----------|-----|---------|
| `q` | string | Текстовый запрос |
| `type` | string | `movie`, `tv` или `multi` (по умолчанию) |
| `genre` | string | ID жанра(ов) через запятую |
| `year` | number | Год выпуска |
| `yearFrom` | number | Начало периода |
| `yearTo` | number | Конец периода |
| `rating` | number | Минимальный рейтинг |
| `ratingFrom` | number | Начало рейтинга |
| `ratingTo` | number | Конец рейтинга |
| `keyword` | string | ID ключевого слова |
| `country` | string | Код языка (например `en`) |
| `sort_by` | string | Сортировка (например `popularity.desc`) |
| `page` | number | Номер страницы |
