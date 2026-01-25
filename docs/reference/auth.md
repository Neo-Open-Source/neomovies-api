# Аутентификация

## JWT

Для защищённых эндпоинтов передавай JWT:

```http
Authorization: Bearer <token>
```

## Что защищено

По коду (`api/index.go` / `main.go`) JWT требуется для:

- `GET /api/v1/favorites`
- `POST /api/v1/favorites/{id}`
- `DELETE /api/v1/favorites/{id}`
- `GET /api/v1/favorites/{id}/check`

- `GET /api/v1/reactions/{mediaType}/{mediaId}/my-reaction`
- `POST /api/v1/reactions/{mediaType}/{mediaId}`
- `DELETE /api/v1/reactions/{mediaType}/{mediaId}`
- `GET /api/v1/reactions/my`
