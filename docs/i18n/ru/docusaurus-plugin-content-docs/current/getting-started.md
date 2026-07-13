---
id: getting-started
sidebar_position: 2
---

# Быстрый старт

## Базовые URL

- Production API (v1): `https://api.neome.uk/api/v1`
- Production API (v2): `https://api.neome.uk/api/v2`
- Локальный API (Axum): `http://localhost:3000/api/v1`

## 1. Получить токен

Аутентификация происходит через Neo ID. Подробнее — в разделе [Аутентификация](./authentication).

Краткий сценарий:

```bash
# 1. Получить ссылку для входа
curl -X POST https://api.neome.uk/api/v1/auth/neo-id/login \
  -H "Content-Type: application/json" \
  -d '{"redirect_url":"https://yourapp.com/callback","state":"random_state"}'

# Ответ:
# { "login_url": "https://id.neome.uk/..." }
```

Пользователь открывает `login_url`, авторизуется, и Neo ID редиректит обратно с `access_token`.

```bash
# 2. Обменять токен Neo ID на API-токены
curl -X POST https://api.neome.uk/api/v1/auth/neo-id/callback \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<neo_id_token>"}'

# Ответ:
# { "accessToken": "eyJ...", "refreshToken": "a3f..." }
```

## 2. Сделать запрос

Передавайте `accessToken` в заголовке `Authorization`:

```bash
curl https://api.neome.uk/api/v1/auth/profile \
  -H "Authorization: Bearer eyJ..."
```

## 3. Обновить токен

Время жизни access token — **15 минут**:

```bash
curl -X POST https://api.neome.uk/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"a3f..."}'
```

## Поиск

```bash
# v1 — поиск по ключевым словам
curl "https://api.neome.uk/api/v1/search?query=матрица"

# v2 — фильтрованный поиск
curl "https://api.neome.uk/api/v2/search?keyword=матрица&genre=1&order=RATING"
```

## Детали медиа

```bash
# v1 — старый формат
curl https://api.neome.uk/api/v1/movie/326

# v2 — чистый ответ (без дублей полей)
curl https://api.neome.uk/api/v2/movie/kp_326
```

## Жанры и категории

```bash
# Список всех жанров
curl https://api.neome.uk/api/v1/genres

# Фильмы по жанру (genre_id из /genres)
curl "https://api.neome.uk/api/v1/category/1?films&order=RATING"

# Сериалы по жанру
curl "https://api.neome.uk/api/v1/category/1?tv&order=RATING"
```

## Важно про URL документации

- На Vercel документация доступна на `/` через rewrite.
- Локально документация запускается отдельно через Docusaurus (обычно `/docs`) и не отдается Axum API-сервером.
