---
id: authentication
sidebar_position: 3
---

# Аутентификация

NeoMovies API использует **Neo ID SSO** как единственный способ входа. Email/пароль и OAuth (Google и др.) не поддерживаются.

## Схема

```
Client → POST /auth/neo-id/login → получить login_url
Client → Редирект на Neo ID → пользователь входит
Neo ID → Редирект обратно с access_token
Client → POST /auth/neo-id/callback → получить JWT + refresh token
```

## JWT Access Token

- Алгоритм: **HS256**
- Время жизни: **15 минут**
- Передаётся в заголовке: `Authorization: Bearer <token>`

Payload токена:

```json
{
  "sub": "507f1f77bcf86cd799439011",
  "neo_id": "neo_abc123",
  "email": "user@example.com",
  "is_admin": false,
  "iat": 1700000000,
  "exp": 1700000900
}
```

## Refresh Token

- Время жизни: **30 дней**
- Хранится в MongoDB
- При обновлении старый токен удаляется (rotation)

## Защищённые эндпоинты

Все эндпоинты, требующие авторизации, возвращают `401` если:

- Заголовок `Authorization` отсутствует или некорректен
- JWT истёк или подпись невалидна
- Пользователь удалён из базы

```bash
# Пример ошибки
{
  "error": "unauthorized"
}
```

## Управление сессиями

| Эндпоинт | Описание |
|----------|----------|
| `POST /auth/refresh` | Обновить токены |
| `POST /auth/refresh-tokens/revoke` | Отозвать конкретный refresh token |
| `POST /auth/refresh-tokens/revoke-all` | Отозвать все refresh tokens |
| `DELETE /auth/delete-account` | Удалить аккаунт и все данные |
