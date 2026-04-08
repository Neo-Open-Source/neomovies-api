---
id: getting-started
sidebar_position: 2
---

# Быстрый старт

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

Пользователь переходит по `login_url`, авторизуется, и Neo ID редиректит обратно с `access_token`.

```bash
# 2. Обменять токен Neo ID на JWT
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

Access token живёт **15 минут**. Обновляйте через refresh token:

```bash
curl -X POST https://api.neomovies.ru/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"a3f..."}'
```

## Поиск фильмов

```bash
curl "https://api.neomovies.ru/api/v1/search?query=матрица"
```

## Детали фильма

```bash
# По числовому ID Кинопоиска
curl https://api.neomovies.ru/api/v1/movie/326

# Или с префиксом
curl https://api.neomovies.ru/api/v1/movie/kp_326
```
