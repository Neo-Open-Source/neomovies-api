---
id: sync-progress
sidebar_position: 4
---

# Sync Progress

Cross-device watch progress synchronization with last-write-wins conflict resolution. All endpoints require authentication.

Progress is tracked per episode for TV series (via `season` + `episode` fields) and per movie (no season/episode).

## Get Progress

Returns all progress for the current user, optionally filtered by media:

```bash
GET /api/v1/sync/progress
Authorization: Bearer <token>

# Filter by specific media
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

## Upsert Progress

Last write wins — the server compares `updatedAt` timestamps and keeps the newer one:

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

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mediaId` | string | yes | Kinopoisk ID (e.g. `kp_258687`) |
| `mediaType` | string | yes | `movie` or `tv` |
| `season` | integer | no | Required for TV series |
| `episode` | integer | no | Required for TV series |
| `progress` | float | yes | Watched seconds |
| `duration` | float | yes | Total duration in seconds |
| `status` | string | yes | `watching`, `completed`, `paused`, or `dropped` |
| `updatedAt` | string | yes | ISO 8601 timestamp |

Response:

```json
{
  "success": true,
  "data": {
    "saved": true,
    "item": { ... }
  }
}
```

If the server already has a newer version (based on `updatedAt`), `saved` will be `false` and `item` will be `null`.

## Batch Sync

Push local changes and pull the full server state in one request:

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

Response:

```json
{
  "success": true,
  "data": {
    "saved": 1,
    "items": [ ... ]
  }
}
```

`items` contains the authoritative state from the server after conflict resolution.

## Delete Progress

```bash
DELETE /api/v1/sync/progress?mediaId=kp_258687&season=1&episode=3
Authorization: Bearer <token>
```

## Conflict Resolution

The sync system uses a **last-write-wins** strategy:

1. Client sends `updatedAt` with each upsert
2. Server compares it against the stored document's `updatedAt`
3. If client's timestamp is newer → document is updated, `saved: true`
4. If server's timestamp is newer or equal → document is kept, `saved: false`
5. The batch endpoint resolves all conflicts and returns the canonical server state

This approach works well for low-frequency conflicts. For real-time collaboration, a CRDT-based strategy would be more appropriate.
