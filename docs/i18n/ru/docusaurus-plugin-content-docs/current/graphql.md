---
sidebar_position: 5
---

# GraphQL API

NeoWatch API предоставляет полноценный GraphQL endpoint наряду с REST. GraphQL позволяет запрашивать только нужные поля и объединять несколько запросов в один.

## Endpoint

```
POST https://api.neome.uk/graphql
```

Интерактивный GraphQL Playground доступен по тому же URL (GET-запрос открывает UI).

## Аутентификация

GraphQL использует тот же JWT-токен, что и REST. Передавайте его в заголовке:

```http
Authorization: Bearer <access_token>
```

Запросы без токена работают для публичных данных (медиа, поиск, жанры). Мутации и персональные данные (избранное, прогресс) требуют авторизации.

## Основные типы

### MediaType

```graphql
enum MediaType { movie  tv }
```

### MediaDetail (union)

Запрос `media` возвращает `MovieDetail | TVDetail`. Используйте inline fragments для специфичных полей:

```graphql
... on MovieDetail { runtime budget }
... on TVDetail    { numberOfSeasons seasons { name } }
```

### Язык

Все запросы принимают аргумент `language: String`. Поддерживаемые значения:

| Код      | Язык        |
|----------|-------------|
| `ru-RU`  | Русский (по умолчанию) |
| `en-US`  | English     |
| `uk-UA`  | Украинский  |
| `ro-RO`  | Română      |
| `be-BY`  | Беларуская  |

### Пагинация

Список-запросы возвращают:

```graphql
type PaginatedMedia {
  items:        [MediaItem!]!
  page:         Int!
  totalPages:   Int!
  totalResults: Int!
}
```

## Публичные запросы

| Запрос | Описание |
|---|---|
| `health` | Статус API |
| `media(type, id, language)` | Детальная страница фильма/сериала |
| `mediaCredits(type, id, language)` | Актёры и съёмочная группа |
| `recommendations(type, id, page, language)` | Рекомендации TMDB |
| `similar(type, id, page, language)` | Похожие |
| `relatedByCast(type, id, page, language)` | Связанные по актёрам |
| `relatedByStudio(type, id, page, language)` | Связанные по студии |
| `mediaCollection(id, language)` | Коллекция фильмов (напр. MCU) |
| `season(tvId, season, language)` | Детали сезона |
| `episode(tvId, season, episode, language)` | Детали эпизода |
| `movieList(list, page, language)` | Список фильмов (popular/top_rated/upcoming) |
| `tvList(list, page, language)` | Список сериалов (popular/top_rated) |
| `trending(type, page, language)` | Трендовые |
| `search(q, type, genre, year, ...)` | Поиск |
| `genres(language)` | Все жанры |
| `person(id, language)` | Персона |
| `personCredits(id, page, language)` | Фильмография |
| `categories(language)` | Категории для browse |
| `categoryCollection(slug, page, language)` | Контент категории |
| `player(provider, kpId, tmdbId, imdbId, ...)` | Плеер |
| `cdnPlayer(cdnId, kpId, imdbId, ...)` | CDN-плеер |
| `torrentSearch(q, imdbId)` | Поиск торрентов |
| `supporters` | Список поддержавших проект |

## Запросы (требуют токен)

| Запрос | Описание |
|---|---|
| `favorites(page, language)` | Список избранного |
| `watchLater` | Список «смотреть позже» |
| `syncProgress` | Прогресс просмотра |
| `loginUrl(redirectUri, codeChallenge, codeChallengeMethod, state)` | URL для OAuth авторизации |

## Мутации (требуют токен)

| Мутация | Описание |
|---|---|
| `refreshTokens(refreshToken)` | Обновить токены |
| `updateProfile(name, avatar)` | Обновить профиль |
| `logout` | Выйти |
| `deleteAccount` | Удалить аккаунт |
| `addFavorite(mediaId, mediaType)` | Добавить в избранное |
| `removeFavorite(mediaId, mediaType)` | Убрать из избранного |
| `addToWatchLater(mediaId)` | Добавить в «смотреть позже» |
| `removeFromWatchLater(mediaId)` | Убрать из «смотреть позже» |
| `upsertProgress(mediaId, mediaType, season, episode, progress)` | Сохранить прогресс |
| `deleteProgress(mediaId, mediaType, season, episode)` | Удалить прогресс |
| `batchSyncProgress(items)` | Пакетная синхронизация |

## Преимущества перед REST

- **Один запрос** — вместо 3–4 REST-запросов один GraphQL
- **Только нужные поля** — нет лишних данных
- **Introspection** — клиенты могут автоматически узнать схему
- **Типобезопасность** — codegen для TypeScript/Kotlin/Swift

## Следующие шаги

- [Примеры запросов](./graphql-examples) — готовые запросы для копирования
- [Аутентификация](./authentication) — как получить токен
