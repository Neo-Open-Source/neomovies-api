---
sidebar_position: 7
---

# Плееры

Стриминг видео от различных провайдеров.

## Alloha Player

Возвращает URL для встраивания в iframe:

```http
GET /api/v1/player/alloha/tmdb/550
```

Ответ:
```json
{
  "success": true,
  "data": {
    "provider": "Alloha",
    "url": "/api/v1/player/alloha/proxy?tmdb=550",
    "type": "iframe"
  }
}
```

Для сериалов добавьте season и episode:

```http
GET /api/v1/player/alloha/tmdb/1396?season=1&episode=1
```

URL можно использовать как src для iframe:

```html
<iframe src="/api/v1/player/alloha/proxy?tmdb=550" allowfullscreen></iframe>
```

## Collaps Player

```http
GET /api/v1/player/collaps/kp/263531
```

## CDN Player

```http
GET /api/v1/player/cdn/12345
```

По IMDb ID:

```http
GET /api/v1/player/cdn/imdb/tt0137523
```

## HLS Proxy

Прокси для HLS-потоков с перезаписью URL:

```http
GET /api/v1/player/hls/proxy?url=https://example.com/stream.m3u8
```
