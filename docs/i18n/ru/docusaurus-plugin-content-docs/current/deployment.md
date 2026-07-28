---
sidebar_position: 3
---

# Развёртывание

## Локальная разработка

```bash
git clone https://github.com/anomalyco/neowatch-api-ts.git
cd neowatch-api-ts
cp .env.example .env
bun install
bun run db:generate
bun run db:migrate
bun run dev
```

Сервер будет доступен на `http://localhost:3000`.

### Документация

```bash
# Local docs dev server
cd docs && bun start

# Build docs
cd docs && bun run build
```

## Vercel

Проект настроен для деплоя на Vercel через `vercel.json`.

1. Подключите репозиторий к [Vercel](https://vercel.com)
2. Установите переменные окружения (см. `.env.example`)
3. Настройте команду сборки: `bun run build`
4. Настройте выходную директорию: `docs/build`

### Переменные окружения Vercel

| Переменная | Описание |
|-----------|----------|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `TMDB_API_KEY` | TMDB API v3 ключ |
| `TMDB_ACCESS_TOKEN` | TMDB API v4 токен доступа |
| `NEO_ID_CLIENT_ID` | Neo ID OAuth client ID |
| `NEO_ID_CLIENT_SECRET` | Neo ID OAuth client secret |
| `NEO_ID_REDIRECT_URI` | OAuth callback URL |

## Railway

```bash
railway login
railway up
```

## Fly.io

```bash
flyctl launch
flyctl deploy
```
