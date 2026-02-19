# NeoMovies API

<div align="center" style="padding: 8px 10px; background: #c6f3ff; border: 1px solid #9bdde9; border-radius: 8px; font-weight: 700;">
  <img src="docs/public/pride_flag.avif" alt="Pride flag" width="18" height="18" style="vertical-align: text-bottom; border-radius: 3px;" />
  Trans Rights are Human Rights! We support trans people,femboys and all LGBTQIA+ people.
</div>

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
