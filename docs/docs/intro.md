---
sidebar_position: 1
---

# Introduction

Welcome to the **NeoWatch API** documentation.

NeoWatch API provides movie and TV show data, streaming players, user features like favorites and watch tracking.

## Base URL

```
https://api.neome.uk
```

## Features

- 🎬 **Movies & TV Shows** - Full metadata from TMDB
- 🔍 **Search** - Text search and advanced filtering
- 📺 **Players** - Multiple streaming providers (Alloha, Collaps, CDN)
- ⭐ **Favorites** - User favorites management
- 📌 **Watch Later** - Watch later list
- 🔄 **Sync** - Cross-device watch progress sync
- 🔐 **Authentication** - Neo ID SSO (OAuth 2.0 + OIDC)

## Response Format

All responses follow a standard envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

Errors:

```json
{
  "success": false,
  "error": "error message"
}
```

## Language Support

All content endpoints accept `?language=` parameter:

| Code | Language |
|------|----------|
| `ru-RU` | Russian (default) |
| `en-US` | English |
| `uk-UA` | Ukrainian |
| `ro-RO` | Romanian |
| `be-BY` | Belarusian |

## Pagination

List endpoints accept `?page=` and return:

```json
{
  "items": [],
  "page": 1,
  "totalPages": 10,
  "totalResults": 200
}
```

## Quick Start

Check out the [Authentication](/docs/authentication) guide to get started.
