---
sidebar_position: 2
---

# Authentication

NeoWatch API uses Neo ID SSO for authentication via OAuth 2.0 + OpenID Connect.

## OAuth Flow

### 1. Get Authorization URL

```http
GET /api/v1/auth/login?redirect_uri=https://neome.uk/auth/callback
```

Response:
```json
{
  "success": true,
  "data": {
    "url": "https://id.neome.uk/api/v1/oauth2/authorize?..."
  }
}
```

Redirect the user to this URL.

### 2. Callback

After authorization, Neo ID redirects to your `redirect_uri` with a `code` parameter:

```
https://neome.uk/auth/callback?code=...
```

### 3. Exchange Code for Tokens

```http
GET /api/v1/auth/callback?code=...&redirect_uri=https://neome.uk/auth/callback
```

Sets `neo_id_access` and `neo_id_refresh` cookies and redirects to frontend.

### 4. Mobile Callback

For mobile apps:

```http
GET /api/v1/auth/mobile-callback?code=...
```

Returns tokens in JSON instead of cookies.

## Using Tokens

Include the access token in the header:

```http
Authorization: Bearer <access_token>
```

## Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "..."
}
```

## Profile

### Get Profile

```http
GET /api/v1/auth/profile
Authorization: Bearer <token>
```

### Update Profile

```http
PUT /api/v1/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Name",
  "avatar": "https://..."
}
```

## Token Management

### List Active Tokens

```http
GET /api/v1/auth/refresh-tokens
Authorization: Bearer <token>
```

### Revoke Token

```http
POST /api/v1/auth/refresh-tokens/revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "refreshToken": "..."
}
```

### Revoke All Tokens

```http
POST /api/v1/auth/refresh-tokens/revoke-all
Authorization: Bearer <token>
```

## Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

## Delete Account

```http
DELETE /api/v1/auth/account
Authorization: Bearer <token>
```
