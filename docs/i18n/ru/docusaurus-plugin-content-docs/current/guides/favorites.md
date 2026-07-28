---
sidebar_position: 5
---

# Избранное

Управление избранным пользователя. Требуется аутентификация.

## Список избранного

```http
GET /api/v1/favorites
Authorization: Bearer <token>
```

## Добавить в избранное

```http
POST /api/v1/favorites/550
Authorization: Bearer <token>
```

## Удалить из избранного

```http
DELETE /api/v1/favorites/550?mediaType=movie
Authorization: Bearer <token>
```

## Проверить избранное

```http
GET /api/v1/favorites/550/check?mediaType=movie
Authorization: Bearer <token>
```

Ответ:
```json
{
  "success": true,
  "data": {
    "isFavorite": true
  }
}
```
