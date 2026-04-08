---
id: getting-started
sidebar_position: 2
---

# Быстрый старт

## Базовые URL

- Production API: `https://api.neomovies.ru/api/v1`
- Локальный API (Axum): `http://localhost:3000/api/v1`

## 1. Получить токен

Аутентификация происходит через Neo ID. Подробнее — в разделе [Аутентификация](./authentication).

Краткий сценарий:

```bash
# 1. Получить ссылку для входа
curl -X POST https://api.neomovies.ru/api/v1/auth/neo-id/login \
  -H "Content-Type: application/json" \
  -d '{"redirect_url":"https://yourapp.com/callback","state":"random_state"}'

# Ответ:
# { "login_url": "https://id.neomovies.ru/..." }
```

Пользователь открывает `login_url`, авторизуется, и Neo ID редиректит обратно с `access_token`.

```bash
# 2. Обменять токен Neo ID на API-токены
curl -X POST https://api.neomovies.ru/api/v1/auth/neo-id/callback \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<neo_id_token>"}'

# Ответ:
# { "accessToken": "eyJ...", "refreshToken": "a3f..." }
```

## 2. Сделать запрос

Передавайте `accessToken` в заголовке `Authorization`:

```bash
curl https://api.neomovies.ru/api/v1/auth/profile \
  -H "Authorization: Bearer eyJ..."
```

## 3. Обновить токен

Время жизни access token — **15 минут**:

```bash
curl -X POST https://api.neomovies.ru/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"a3f..."}'
```

## Поиск

```bash
curl "https://api.neomovies.ru/api/v1/search?query=матрица"
```

## Детали медиа

```bash
# По числовому ID Кинопоиска
curl https://api.neomovies.ru/api/v1/movie/326

# Или с префиксом
curl https://api.neomovies.ru/api/v1/movie/kp_326
```

## Важно про URL документации

- На Vercel документация доступна на `/` через rewrite.
- Локально документация запускается отдельно через Docusaurus (обычно `/docs`) и не отдается Axum API-сервером.
