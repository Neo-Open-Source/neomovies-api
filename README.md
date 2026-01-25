# NeoMovies API

REST API для NeoMovies: поиск, детали фильмов/сериалов, категории, плееры, торренты, реакции и избранное.

## Документация

- **VitePress**: исходники в `docs/`.
- **OpenAPI JSON**: `GET /openapi.json`.

На Vercel:

- `/` — документация (VitePress)
- `/api/v1/*` — API (Go serverless)

## Локальный запуск

1. Создай `.env`:

```bash
cp .env.example .env
```

2. Заполни минимум:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `KPAPI_KEY`
- `JWT_SECRET`

3. Запусти:

```bash
go mod download
go run main.go
```

Проверка:

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/openapi.json
```

## Переменные окружения

Смотри `.env.example` и `/docs/guide/configuration`.