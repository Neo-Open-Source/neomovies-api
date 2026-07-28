---
sidebar_position: 6
---

# Синхронизация прогресса

Синхронизация прогресса просмотра между устройствами. Требуется аутентификация.

## Получить весь прогресс

```http
GET /api/v1/sync/progress
Authorization: Bearer <token>
```

## Обновить прогресс

```http
PUT /api/v1/sync/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "mediaId": 550,
  "mediaType": "movie",
  "progress": 45.5
}
```

Для сериалов:

```http
PUT /api/v1/sync/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "mediaId": 1396,
  "mediaType": "tv",
  "season": 1,
  "episode": 3,
  "progress": 78
}
```

## Удалить прогресс

```http
DELETE /api/v1/sync/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "mediaId": 550,
  "mediaType": "movie"
}
```

## Пакетное обновление

```http
POST /api/v1/sync/progress/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "mediaId": 550, "mediaType": "movie", "progress": 100 },
    { "mediaId": 1396, "mediaType": "tv", "season": 1, "episode": 4, "progress": 15 }
  ]
}
```
