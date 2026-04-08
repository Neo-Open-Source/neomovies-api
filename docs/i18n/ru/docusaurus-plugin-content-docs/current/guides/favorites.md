---
id: favorites
sidebar_position: 3
---

# Избранное

Управление списком избранных фильмов и сериалов. Все эндпоинты требуют авторизации.

## Получить список

```bash
GET /api/v1/favorites
Authorization: Bearer <token>
```

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "media_id": "kp_326",
      "media_type": "movie",
      "title": "Матрица",
      "poster_url": "https://...",
      "rating": 8.5,
      "year": 1999,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Добавить в избранное

Операция идемпотентна — повторный вызов не создаёт дубликат.

```bash
POST /api/v1/favorites/326?type=movie
Authorization: Bearer <token>
```

Параметр `type` — `movie` или `tv` (по умолчанию `movie`).

## Удалить из избранного

```bash
DELETE /api/v1/favorites/326?type=movie
Authorization: Bearer <token>
```

## Проверить наличие

```bash
GET /api/v1/favorites/326/check?type=movie
Authorization: Bearer <token>
```

```json
{
  "success": true,
  "data": { "isFavorite": true }
}
```

## Ошибки

```bash
# Неверный тип
POST /api/v1/favorites/326?type=anime
# { "error": "type must be movie or tv" }
```
