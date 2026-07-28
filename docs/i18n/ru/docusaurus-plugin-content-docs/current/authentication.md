---
sidebar_position: 2
---

# Аутентификация

NeoWatch API использует Neo ID SSO для аутентификации через OAuth 2.0 + OpenID Connect.

## OAuth Flow

### 1. Получить URL авторизации

```http
GET /api/v1/auth/login?redirect_uri=https://neome.uk/auth/callback
```

Ответ:
```json
{
  "success": true,
  "data": {
    "url": "https://id.neome.uk/api/v1/oauth2/authorize?..."
  }
}
```

Перенаправьте пользователя по этому URL.

### 2. Callback

После авторизации Neo ID перенаправляет на ваш `redirect_uri` с параметром `code`:

```
https://neome.uk/auth/callback?code=...
```

### 3. Обменять код на токены

```http
GET /api/v1/auth/callback?code=...&redirect_uri=https://neome.uk/auth/callback
```

Устанавливает куки `neo_id_access` и `neo_id_refresh` и перенаправляет на фронтенд.

### 4. Mobile Callback

Для мобильных приложений:

```http
GET /api/v1/auth/mobile-callback?code=...
```

Возвращает токены в JSON вместо кук.

## Использование токенов

Укажите токен доступа в заголовке:

```http
Authorization: Bearer <access_token>
```

## Обновление токена

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "..."
}
```

## Профиль

### Получить профиль

```http
GET /api/v1/auth/profile
Authorization: Bearer <token>
```

### Обновить профиль

```http
PUT /api/v1/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Новое имя",
  "avatar": "https://..."
}
```

## Управление токенами

### Список активных токенов

```http
GET /api/v1/auth/refresh-tokens
Authorization: Bearer <token>
```

### Отозвать токен

```http
POST /api/v1/auth/refresh-tokens/revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "refreshToken": "..."
}
```

### Отозвать все токены

```http
POST /api/v1/auth/refresh-tokens/revoke-all
Authorization: Bearer <token>
```

## Выход

```http
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

## Удаление аккаунта

```http
DELETE /api/v1/auth/account
Authorization: Bearer <token>
```
