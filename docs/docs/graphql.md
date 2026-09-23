---
sidebar_position: 5
---

# GraphQL API

NeoWatch API provides a full GraphQL endpoint alongside REST. GraphQL lets you request only the fields you need and combine multiple queries into one round-trip.

## Endpoint

```
POST https://api.neome.uk/graphql
```

An interactive GraphQL Playground is available in these places:

- **Docs site**: [GraphQL Playground](/graphql) (this site, embedded GraphiQL)
- **API**: `GET https://neowatch-api-ts.vercel.app/graphql` with `Accept: text/html`

## Authentication

GraphQL uses the same JWT access token as REST. Pass it in the request header:

```http
Authorization: Bearer <access_token>
```

Queries without a token work for public data (media, search, genres). Mutations and personal data (favorites, progress) require authorization.

## Core Types

### MediaType

```graphql
enum MediaType { movie  tv }
```

### MediaDetail (union)

The `media` query returns `MovieDetail | TVDetail`. Use inline fragments to access type-specific fields:

```graphql
... on MovieDetail { runtime budget }
... on TVDetail    { numberOfSeasons seasons { name } }
```

### Language

All queries accept a `language: String` argument. Supported values:

| Code     | Language              |
|----------|-----------------------|
| `ru-RU`  | Russian (default)     |
| `en-US`  | English               |
| `uk-UA`  | Ukrainian             |
| `ro-RO`  | Romanian              |
| `be-BY`  | Belarusian            |

### Pagination

List queries return:

```graphql
type PaginatedMedia {
  items:        [MediaItem!]!
  page:         Int!
  totalPages:   Int!
  totalResults: Int!
}
```

## Public Queries

| Query | Description |
|---|---|
| `health` | API status |
| `media(type, id, language)` | Full movie/TV detail page |
| `mediaCredits(type, id, language)` | Cast and crew |
| `recommendations(type, id, page, language)` | TMDB recommendations |
| `similar(type, id, page, language)` | Similar titles |
| `relatedByCast(type, id, page, language)` | Related by cast |
| `relatedByStudio(type, id, page, language)` | Related by studio |
| `mediaCollection(id, language)` | Movie collection (e.g. MCU) |
| `season(tvId, season, language)` | Season details |
| `episode(tvId, season, episode, language)` | Episode details |
| `movieList(list, page, language)` | Movie list (popular/top_rated/upcoming) |
| `tvList(list, page, language)` | TV list (popular/top_rated) |
| `trending(type, page, language)` | Trending titles |
| `search(q, type, genre, year, ...)` | Search |
| `genres(language)` | All genres |
| `person(id, language)` | Person details |
| `personCredits(id, page, language)` | Filmography |
| `categories(language)` | Browse categories |
| `categoryCollection(slug, page, language)` | Category content |
| `player(provider, kpId, tmdbId, imdbId, ...)` | Video player |
| `cdnPlayer(cdnId, kpId, imdbId, ...)` | CDN player |
| `torrentSearch(q, imdbId)` | Torrent search |
| `supporters` | Project supporters |

## Authenticated Queries

| Query | Description |
|---|---|
| `favorites(page, language)` | User favorites list |
| `watchLater` | Watch later list |
| `syncProgress` | Watch progress |
| `me` | Current user profile (from JWT / Neo ID) |
| `loginUrl(redirectUri, codeChallenge, codeChallengeMethod, state)` | OAuth authorization URL |

## Mutations (require token)

| Mutation | Description |
|---|---|
| `refreshTokens(refreshToken)` | Refresh access tokens |
| `updateProfile(name, avatar)` | Update user profile |
| `logout` | Sign out |
| `deleteAccount` | Delete account |
| `addFavorite(mediaId, mediaType)` | Add to favorites |
| `removeFavorite(mediaId, mediaType)` | Remove from favorites |
| `addToWatchLater(mediaId)` | Add to watch later |
| `removeFromWatchLater(mediaId)` | Remove from watch later |
| `upsertProgress(mediaId, mediaType, season, episode, progress)` | Save watch progress |
| `deleteProgress(mediaId, mediaType, season, episode)` | Delete progress entry |
| `batchSyncProgress(items)` | Batch progress sync |

## Why GraphQL over REST?

- **One request** — instead of 3–4 REST calls (details + credits + recommendations) you send one GraphQL query
- **Only the fields you need** — no over-fetching
- **Introspection** — clients can auto-discover the schema
- **Type safety** — codegen for TypeScript, Kotlin, Swift

## Next Steps

- [Query Examples](./graphql-examples) — ready-to-use queries
- [Authentication](./authentication) — how to get a token
