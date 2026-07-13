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

## v1 — Поиск по ключевым словам

```bash
GET /api/v1/search?query=матрица&page=1
```

## v2 — Фильтрованный поиск

Продвинутый поиск с фильтрами. Работает через Kinopoisk v2.2 API.

```bash
# По ключевому слову
GET /api/v2/search?keyword=матрица

# По жанру
GET /api/v2/search?genre=1&order=RATING

# По году
GET /api/v2/search?yearFrom=2000&yearTo=2010&order=YEAR

# По рейтингу
GET /api/v2/search?ratingFrom=7&ratingTo=10

# По типу
GET /api/v2/search?type=FILM
GET /api/v2/search?type=TV_SERIES

# Комбинированный
GET /api/v2/search?keyword=star&genre=2&yearFrom=2010&order=RATING&page=1
```

### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `keyword` | string | Ключевое слово |
| `genre` | string | ID жанра (из `/api/v1/genres`) |
| `yearFrom` | integer | Год начала |
| `yearTo` | integer | Год конца |
| `ratingFrom` | float | Мин. рейтинг |
| `ratingTo` | float | Макс. рейтинг |
| `type` | string | `FILM`, `TV_SERIES`, `TV_SHOW`, `MINI_SERIES`, `ALL` |
| `order` | string | `RATING`, `YEAR`, `NUM_VOTE`, `RATING_KO` |
| `page` | integer | Номер страницы |

## Коллекции

```bash
# Популярные фильмы
GET /api/v1/movies/popular

# Топ-250
GET /api/v1/movies/top-rated

# Топ-250 сериалов
GET /api/v1/tv/top-rated

# Все поддерживают ?page=N
```

## Детали медиа

```bash
# v1 (legacy)
GET /api/v1/movie/kp_326

# v2 (чистый ответ — без дублей, жанры строками, все страны)
GET /api/v2/movie/kp_326
```

## Жанры

```bash
# Список всех жанров
GET /api/v1/genres

# Ответ:
# { "success": true, "data": [
#   { "id": 1, "name": "триллер" },
#   { "id": 2, "name": "драма" },
#   ...
# ]}
```

## Фильмы по жанру

```bash
# Всё в жанре
GET /api/v1/category/1?order=RATING

# Только фильмы
GET /api/v1/category/1?films&order=RATING

# Только сериалы
GET /api/v1/category/1?tv&order=RATING

# Пагинация
GET /api/v1/category/1?films&page=2
```

## Ошибки

Пустой или пробельный запрос вернет `400` на v1:

```bash
GET /api/v1/search?query=
# { "error": "query parameter is required" }
```
