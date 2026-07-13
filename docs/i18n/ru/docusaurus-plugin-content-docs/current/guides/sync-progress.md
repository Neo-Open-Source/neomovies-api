---
id: sync-progress
sidebar_position: 4
---

# Синхронизация прогресса

Кроссплатформенная синхронизация прогресса просмотра с разрешением конфликтов по принципу last-write-wins. Все эндпоинты требуют аутентификации.

Прогресс отслеживается посерийно для сериалов (через `season` + `episode`) и целиком для фильмов (без season/episode).

## Получить прогресс

Возвращает весь прогресс текущего пользователя, опционально фильтруя по медиа:

```bash
GET /api/v1/sync/progress
Authorization: Bearer <token>

# Фильтр по конкретному фильму/сериалу
GET /api/v1/sync/progress?mediaId=kp_258687
Authorization: Bearer <token>
```

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "userId": "...",
      "mediaId": "kp_258687",
      "mediaType": "tv",
      "season": 1,
      "episode": 3,
      "progress": 450.0,
      "duration": 2640.0,
      "status": "watching",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

## Сохранить прогресс

Last write wins — сервер сравнивает `updatedAt` и сохраняет более новый:

```bash
PUT /api/v1/sync/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "mediaId": "kp_258687",
  "mediaType": "tv",
  "season": 1,
  "episode": 3,
  "progress": 450.0,
  "duration": 2640.0,
  "status": "watching",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `mediaId` | string | да | Kinopoisk ID (например `kp_258687`) |
| `mediaType` | string | да | `movie` или `tv` |
| `season` | integer | нет | Обязателен для сериалов |
| `episode` | integer | нет | Обязателен для сериалов |
| `progress` | float | да | Просмотренные секунды |
| `duration` | float | да | Полная длительность в секундах |
| `status` | string | да | `watching`, `completed`, `paused`, `dropped` |
| `updatedAt` | string | да | ISO 8601 timestamp |

Ответ:

```json
{
  "success": true,
  "data": {
    "saved": true,
    "item": { ... }
  }
}
```

Если на сервере уже есть более новая версия (по `updatedAt`), то `saved` будет `false`, а `item` — `null`.

## Пакетная синхронизация

Отправить локальные изменения и получить полное состояние сервера за один запрос:

```bash
POST /api/v1/sync/progress/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "mediaId": "kp_258687",
      "mediaType": "tv",
      "season": 1,
      "episode": 3,
      "progress": 450.0,
      "duration": 2640.0,
      "status": "watching",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

Ответ:

```json
{
  "success": true,
  "data": {
    "saved": 1,
    "items": [ ... ]
  }
}
```

`items` содержит авторитетное состояние сервера после разрешения конфликтов.

## Удалить прогресс

```bash
DELETE /api/v1/sync/progress?mediaId=kp_258687&season=1&episode=3
Authorization: Bearer <token>
```

## Разрешение конфликтов

Синхронизация использует стратегию **last-write-wins**:

1. Клиент отправляет `updatedAt` с каждым upsert
2. Сервер сравнивает его с сохранённым документом
3. Если время клиента новее → документ обновляется, `saved: true`
4. Если время сервера новее или равно → документ сохраняется, `saved: false`
5. Batch-эндпоинт разрешает все конфликты и возвращает каноническое состояние сервера

Этот подход хорошо работает при редких конфликтах. Для реального времени потребовалась бы CRDT-стратегия.
