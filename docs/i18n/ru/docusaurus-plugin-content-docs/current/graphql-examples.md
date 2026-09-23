---
sidebar_position: 6
---

# Примеры GraphQL запросов

Все примеры можно запустить прямо в [Playground](/graphql).

## Детали фильма

```graphql
query GetMovie($id: Int!, $language: String) {
  media(type: movie, id: $id, language: $language) {
    ... on MovieDetail {
      tmdbId title originalTitle overview
      poster backdrop logo
      releaseDate genres { id name }
      voteAverage imdbRating imdbVotes
      runtime certification tagline status
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

**Переменные:**
```json
{ "id": 245891, "language": "ru-RU" }
```

---

## Детали сериала

```graphql
query GetTV($id: Int!, $language: String) {
  media(type: tv, id: $id, language: $language) {
    ... on TVDetail {
      tmdbId title originalTitle overview
      poster backdrop logo
      releaseDate genres { id name }
      voteAverage imdbRating certification
      numberOfSeasons numberOfEpisodes
      status tagline
      networks { id name logo }
      productionCompanies { id name logo }
      seasons { id name seasonNumber episodeCount poster airDate }
      trailers
      credits { cast { id name character profile order } }
    }
  }
}
```

**Переменные:**
```json
{ "id": 1396, "language": "ru-RU" }
```

---

## Страница сезона

```graphql
query GetSeason($tvId: Int!, $season: Int!, $language: String) {
  season(tvId: $tvId, season: $season, language: $language) {
    id name seasonNumber overview poster airDate
    episodes {
      id name overview still
      episodeNumber seasonNumber airDate
      voteAverage runtime
    }
  }
}
```

**Переменные:**
```json
{ "tvId": 1396, "season": 1, "language": "ru-RU" }
```

---

## Полная страница за один запрос

Вместо 4 REST-запросов — один GraphQL:

```graphql
query DetailPage($type: MediaType!, $id: Int!, $language: String) {
  media(type: $type, id: $id, language: $language) {
    ... on MovieDetail {
      tmdbId title overview poster backdrop logo
      voteAverage imdbRating certification runtime
      genres { name } trailers
      credits { cast { id name character profile order } }
    }
    ... on TVDetail {
      tmdbId title overview poster backdrop logo
      voteAverage imdbRating certification
      numberOfSeasons numberOfEpisodes
      genres { name } trailers
      credits { cast { id name character profile order } }
      seasons { id name seasonNumber episodeCount poster }
    }
  }

  similar: similar(type: $type, id: $id, language: $language) {
    items { tmdbId title poster backdrop voteAverage releaseDate genres { name } }
  }

  relatedByCast: relatedByCast(type: $type, id: $id, language: $language) {
    items { tmdbId title poster voteAverage releaseDate }
  }
}
```

---

## Поиск

```graphql
query Search($q: String, $type: SearchType, $language: String, $page: Int) {
  search(q: $q, type: $type, language: $language, page: $page) {
    page totalPages totalResults
    items {
      ... on MediaItem {
        tmdbId title poster releaseDate voteAverage genres { name }
      }
      ... on PersonSearchItem {
        tmdbId name profile department
      }
    }
  }
}
```

**Переменные:**
```json
{ "q": "Человек-паук", "type": "multi", "language": "ru-RU", "page": 1 }
```

### Поиск с фильтрами

```graphql
query SearchFiltered($genre: String, $yearFrom: Int, $ratingFrom: Float, $language: String) {
  search(genre: $genre, yearFrom: $yearFrom, ratingFrom: $ratingFrom, sortBy: "vote_average.desc", language: $language) {
    items {
      ... on MediaItem { tmdbId title poster voteAverage releaseDate }
    }
    totalResults
  }
}
```

---

## Прогресс просмотра (требует токен)

### Получить прогресс

```graphql
query SyncProgress {
  syncProgress {
    mediaId mediaType season episode progress updatedAt
    title poster backdrop episodeName episodeStill
  }
}
```

### Сохранить прогресс

```graphql
mutation UpsertProgress($mediaId: Int!, $mediaType: MediaType, $season: Int, $episode: Int, $progress: Float!) {
  upsertProgress(mediaId: $mediaId, mediaType: $mediaType, season: $season, episode: $episode, progress: $progress) {
    mediaId progress updatedAt
  }
}
```

**Переменные (кино):** `{ "mediaId": 245891, "mediaType": "movie", "progress": 0.75 }`

**Переменные (сериал):** `{ "mediaId": 1396, "mediaType": "tv", "season": 2, "episode": 3, "progress": 0.42 }`

---

## Плеер

```graphql
query Player($provider: PlayerProvider!, $tmdbId: Int, $season: Int, $episode: Int) {
  player(provider: $provider, tmdbId: $tmdbId, season: $season, episode: $episode) {
    provider url type
  }
}
```

**Переменные:** `{ "provider": "alloha", "tmdbId": 245891 }`
