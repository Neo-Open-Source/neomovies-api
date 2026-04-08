---
id: authentication
sidebar_position: 3
---

# Authentication

NeoMovies API uses **Neo ID SSO** as the only authentication method. Email/password and OAuth (Google, etc.) are not supported.

## Flow

```
Client → POST /auth/neo-id/login → get login_url
Client → Redirect to Neo ID → user authenticates
Neo ID → Redirect back with access_token
Client → POST /auth/neo-id/callback → get JWT + refresh token
```

## JWT Access Token

- Algorithm: **HS256**
- Lifetime: **15 minutes**
- Passed in header: `Authorization: Bearer <token>`

Token payload:

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

- Lifetime: **30 days**
- Stored in MongoDB
- Old token is deleted on refresh (rotation)

## Protected Endpoints

All endpoints requiring authorization return `401` if:

- The `Authorization` header is missing or malformed
- The JWT is expired or has an invalid signature
- The user has been deleted from the database

```json
{ "error": "unauthorized" }
```

## Session Management

| Endpoint | Description |
|----------|-------------|
| `POST /auth/refresh` | Refresh tokens |
| `POST /auth/refresh-tokens/revoke` | Revoke a specific refresh token |
| `POST /auth/refresh-tokens/revoke-all` | Revoke all refresh tokens |
| `DELETE /auth/delete-account` | Delete account and all data |
