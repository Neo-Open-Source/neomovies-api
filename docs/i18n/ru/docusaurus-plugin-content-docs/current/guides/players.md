---
id: players
sidebar_position: 2
---

# Видеоплееры

API предоставляет HTML-страницы с iframe для встраивания видеоплееров.

## Доступные плееры

| Плеер | Эндпоинт |
|-------|----------|
| Alloha | `GET /api/v1/players/alloha/kp/{kp_id}` |
| Lumex | `GET /api/v1/players/lumex/kp/{kp_id}` |
| Vibix | `GET /api/v1/players/vibix/kp/{kp_id}` |
| HDVB | `GET /api/v1/players/hdvb/kp/{kp_id}` |
| Collaps | `GET /api/v1/players/collaps/kp/{kp_id}` |

## Пример

```bash
GET /api/v1/players/alloha/kp/326
```

Ответ — HTML-страница с `Content-Type: text/html`:

```html
<!DOCTYPE html>
<html>
  <body style="margin:0">
    <iframe src="https://alloha.tv/..." width="100%" height="100%" ...></iframe>
  </body>
</html>
```

## Сериалы (Collaps)

Для сериалов можно указать сезон и эпизод:

```bash
GET /api/v1/players/collaps/kp/77044?season=1&episode=3
```

## Коды ответов

| Код | Причина |
|-----|---------|
| 200 | HTML iframe |
| 404 | Видео не найдено у плеера |
| 500 | Плеер не настроен (отсутствует env-переменная) |

## Встраивание в приложение

```html
<iframe
  src="https://api.neomovies.ru/api/v1/players/alloha/kp/326"
  width="100%"
  height="500"
  frameborder="0"
  allowfullscreen
></iframe>
```
