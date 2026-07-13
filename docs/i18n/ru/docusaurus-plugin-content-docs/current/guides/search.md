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
# По ключевому слову (или используйте query=)
GET /api/v2/search?keyword=матрица
GET /api/v2/search?query=матрица

# По жанру (ID или название, через запятую)
GET /api/v2/search?genres=1&order=RATING
GET /api/v2/search?genres=драма,комедия

# По стране (ID или название, через запятую)
GET /api/v2/search?genres=1&countries=США

# По году
GET /api/v2/search?yearFrom=2000&yearTo=2010&order=YEAR

# По рейтингу
GET /api/v2/search?ratingFrom=7&ratingTo=10

# По типу
GET /api/v2/search?type=FILM
GET /api/v2/search?type=TV_SERIES

# Комбинированный
GET /api/v2/search?query=star&genres=2&countries=США&yearFrom=2010&order=RATING&page=1
```

### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `query` | string | Ключевое слово (алиас `keyword`) |
| `keyword` | string | Ключевое слово |
| `genres` | string | ID или названия жанров через запятую (напр. `1`, `3,5`, `драма,комедия`) |
| `countries` | string | ID или названия стран через запятую (напр. `1`, `США,Россия`) |
| `yearFrom` | integer | Год начала |
| `yearTo` | integer | Год конца |
| `ratingFrom` | float | Мин. рейтинг |
| `ratingTo` | float | Макс. рейтинг |
| `type` | string | `FILM`, `TV_SERIES`, `TV_SHOW`, `MINI_SERIES`, `ALL` |
| `order` | string | `RATING`, `YEAR`, `NUM_VOTE`, `RATING_KO` |
| `page` | integer | Номер страницы |

:::note
Названия жанров и стран автоматически конвертируются в ID через API фильтров Kinopoisk. Можно передавать в любом регистре (напр. `драма`, `Драма`).
:::

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
