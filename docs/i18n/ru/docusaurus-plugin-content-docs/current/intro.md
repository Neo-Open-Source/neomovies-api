---
id: intro
slug: /
sidebar_position: 1
---

# NeoMovies API v2

NeoMovies API v2 — это serverless REST API на Rust, задеплоенный на Vercel.

## Ключевые особенности

- **Аутентификация** — только через [Neo ID SSO](https://id.neomovies.ru)
- **Медиаданные** — только Kinopoisk API (TMDB и IMDb не используются)
- **База данных** — MongoDB (пользователи, избранное, refresh-токены)
- **Деплой** — Vercel Serverless Functions (Rust)
- **CORS** — разрешён для всех источников (`*`)

## Базовый URL

```
https://api.neomovies.ru/api/v1
```

## Формат ответов

Все эндпоинты возвращают JSON. Успешные ответы оборачиваются в конверт:

```json
{
  "success": true,
  "data": { ... }
}
```

Ошибки:

```json
{
  "error": "описание ошибки"
}
```

## HTTP-коды

| Код | Значение |
|-----|----------|
| 200 | Успех |
| 400 | Неверный запрос |
| 401 | Не авторизован |
| 404 | Не найдено |
| 500 | Внутренняя ошибка |
| 502 | Ошибка внешнего сервиса |
