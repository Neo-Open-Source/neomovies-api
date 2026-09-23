---
sidebar_position: 6
---

# GraphQL Query Examples

All examples can be run directly in the [Playground](/graphql).

## Movie Detail

```graphql
query GetMovie($id: Int!, $language: String) {
  media(type: movie, id: $id, language: $language) {
    ... on MovieDetail {
      tmdbId
      title
      originalTitle
      overview
      poster
      backdrop
      logo
      releaseDate
      genres { id name }
      voteAverage
      imdbRating
      imdbVotes
      runtime
      certification
      tagline
      status
      trailers
      productionCompanies { id name logo }
      collection { id name poster }
      credits {
        cast { id name character profile order }
        crew { id name job department profile }
      }
    }
  }
}
```

**Variables:**
```json
{ "id": 245891, "language": "en-US" }
```

---

## TV Show Detail

```graphql
query GetTV($id: Int!, $language: String) {
  media(type: tv, id: $id, language: $language) {
    ... on TVDetail {
      tmdbId
      title
      originalTitle
      overview
      poster
      backdrop
      logo
      releaseDate
      genres { id name }
      voteAverage
      imdbRating
      certification
      numberOfSeasons
      numberOfEpisodes
      status
      tagline
      networks { id name logo }
      productionCompanies { id name logo }
      seasons {
        id
        name
        seasonNumber
        episodeCount
        poster
        airDate
      }
      trailers
      credits {
        cast { id name character profile order }
      }
    }
  }
}
```

**Variables:**
```json
{ "id": 1396, "language": "en-US" }
```

---

## Season Detail

```graphql
query GetSeason($tvId: Int!, $season: Int!, $language: String) {
  season(tvId: $tvId, season: $season, language: $language) {
    id
    name
    seasonNumber
    overview
    poster
    airDate
    episodes {
      id
      name
      overview
      still
      episodeNumber
      seasonNumber
      airDate
      voteAverage
      runtime
    }
  }
}
```

**Variables:**
```json
{ "tvId": 1396, "season": 1, "language": "en-US" }
```

---

## Full Detail Page in One Request

Instead of 4 separate REST calls — one GraphQL query:

```graphql
query DetailPage($type: MediaType!, $id: Int!, $language: String) {
  media(type: $type, id: $id, language: $language) {
    ... on MovieDetail {
      tmdbId title overview poster backdrop logo
      voteAverage imdbRating certification runtime
      genres { name }
      trailers
      credits { cast { id name character profile order } }
    }
    ... on TVDetail {
      tmdbId title overview poster backdrop logo
      voteAverage imdbRating certification
      numberOfSeasons numberOfEpisodes
      genres { name }
      trailers
      credits { cast { id name character profile order } }
      seasons { id name seasonNumber episodeCount poster }
    }
  }

  similar: similar(type: $type, id: $id, language: $language) {
    items {
      tmdbId title poster backdrop voteAverage releaseDate genres { name }
    }
  }

  relatedByCast: relatedByCast(type: $type, id: $id, language: $language) {
    items {
      tmdbId title poster voteAverage releaseDate
    }
  }
}
```

---

## Search

```graphql
query Search($q: String, $type: SearchType, $language: String, $page: Int) {
  search(q: $q, type: $type, language: $language, page: $page) {
    page
    totalPages
    totalResults
    items {
      ... on MediaItem {
        tmdbId
        title
        poster
        releaseDate
        voteAverage
        genres { name }
      }
      ... on PersonSearchItem {
        tmdbId
        name
        profile
        department
      }
    }
  }
}
```

**Variables:**
```json
{ "q": "Spider-Man", "type": "multi", "language": "en-US", "page": 1 }
```

### Filtered Search (no text query)

```graphql
query SearchFiltered($genre: String, $yearFrom: Int, $ratingFrom: Float, $language: String) {
  search(
    genre: $genre
    yearFrom: $yearFrom
    ratingFrom: $ratingFrom
    sortBy: "vote_average.desc"
    language: $language
  ) {
    items {
      ... on MediaItem {
        tmdbId title poster voteAverage releaseDate
      }
    }
    totalResults
  }
}
```

**Variables:**
```json
{ "genre": "28", "yearFrom": 2020, "ratingFrom": 7.5, "language": "en-US" }
```

---

## Trending

```graphql
query Trending($type: MediaType, $language: String, $page: Int) {
  trending(type: $type, language: $language, page: $page) {
    items {
      tmdbId
      title
      poster
      backdrop
      voteAverage
      releaseDate
      mediaType
      genres { name }
    }
    page
    totalPages
    totalResults
  }
}
```

---

## Person & Filmography

```graphql
query PersonPage($id: Int!, $language: String) {
  person(id: $id, language: $language) {
    tmdbId
    name
    profile
    department
  }

  personCredits(id: $id, language: $language) {
    items {
      tmdbId
      title
      poster
      releaseDate
      voteAverage
      mediaType
      role
      creditType
    }
    totalResults
  }
}
```

---

## Favorites (requires token)

```graphql
query Favorites($language: String, $page: Int) {
  favorites(language: $language, page: $page) {
    items {
      tmdbId
      title
      poster
      backdrop
      voteAverage
      mediaType
      mediaId
      createdAt
    }
    page
    totalPages
    totalResults
  }
}
```

**Header:**
```http
Authorization: Bearer <your_access_token>
```

---

## Watch Progress (requires token)

### Get progress

```graphql
query SyncProgress {
  syncProgress {
    mediaId
    mediaType
    season
    episode
    progress
    updatedAt
    title
    poster
    backdrop
    episodeName
    episodeStill
  }
}
```

### Save progress

```graphql
mutation UpsertProgress(
  $mediaId: Int!
  $mediaType: MediaType
  $season: Int
  $episode: Int
  $progress: Float!
) {
  upsertProgress(
    mediaId: $mediaId
    mediaType: $mediaType
    season: $season
    episode: $episode
    progress: $progress
  ) {
    mediaId
    progress
    updatedAt
  }
}
```

**Variables (movie):**
```json
{ "mediaId": 245891, "mediaType": "movie", "progress": 0.75 }
```

**Variables (TV episode):**
```json
{ "mediaId": 1396, "mediaType": "tv", "season": 2, "episode": 3, "progress": 0.42 }
```

### Batch sync

```graphql
mutation BatchSync($items: [SyncProgressInput!]!) {
  batchSyncProgress(items: $items) {
    count
    items {
      mediaId
      mediaType
      progress
      updatedAt
    }
  }
}
```

---

## Player

```graphql
query Player(
  $provider: PlayerProvider!
  $tmdbId: Int
  $kpId: Int
  $imdbId: String
  $season: Int
  $episode: Int
) {
  player(
    provider: $provider
    tmdbId: $tmdbId
    kpId: $kpId
    imdbId: $imdbId
    season: $season
    episode: $episode
  ) {
    provider
    url
    type
  }
}
```

**Variables:**
```json
{ "provider": "alloha", "tmdbId": 245891 }
```

---

## Health Check

```graphql
query Health {
  health {
    status
    version
    timestamp
  }
}
```
