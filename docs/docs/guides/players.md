---
id: players
sidebar_position: 2
---

# Video Players

The API provides HTML pages with iframes for embedding video players.

## Available Players

| Player | Endpoint |
|--------|----------|
| Alloha | `GET /api/v1/players/alloha/kp/{kp_id}` |
| Lumex | `GET /api/v1/players/lumex/kp/{kp_id}` |
| Vibix | `GET /api/v1/players/vibix/kp/{kp_id}` |
| HDVB | `GET /api/v1/players/hdvb/kp/{kp_id}` |
| Collaps | `GET /api/v1/players/collaps/kp/{kp_id}` |

## Example

```bash
GET /api/v1/players/alloha/kp/326
```

Response — an HTML page with `Content-Type: text/html`:

```html
<!DOCTYPE html>
<html>
  <body style="margin:0">
    <iframe src="https://alloha.tv/..." width="100%" height="100%" ...></iframe>
  </body>
</html>
```

## TV Shows (Collaps)

For TV shows you can specify season and episode:

```bash
GET /api/v1/players/collaps/kp/77044?season=1&episode=3
```

## Response Codes

| Code | Reason |
|------|--------|
| 200 | HTML iframe |
| 404 | Video not found at the player |
| 500 | Player not configured (missing env variable) |

## Embedding in Your App

```html
<iframe
  src="https://api.neomovies.ru/api/v1/players/alloha/kp/326"
  width="100%"
  height="500"
  frameborder="0"
  allowfullscreen
></iframe>
```
