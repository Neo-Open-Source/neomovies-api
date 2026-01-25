# API — обзор

## Базовый URL

- Локально: `http://localhost:3000`
- На Vercel: домен проекта

## Префиксы

- REST API: `/api/v1/*`
- OpenAPI JSON: `/openapi.json`

## Авторизация

Некоторые маршруты требуют:

```http
Authorization: Bearer <JWT>
```

JWT парсится middleware и поддерживает разные названия claim для user id:

- `unified_id`
- `UnifiedID`
- `user_id`

## Унифицированные ID

Для части методов используются префиксные идентификаторы:

- `kp_<id>`
- `tmdb_<id>`
