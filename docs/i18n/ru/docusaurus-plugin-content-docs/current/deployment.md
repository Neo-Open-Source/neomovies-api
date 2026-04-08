---
id: deployment
sidebar_position: 4
---

# Deployment

NeoMovies API v2 деплоится на Vercel как набор Rust serverless-функций (`api/*.rs`) и одновременно собирает документацию Docusaurus (`docs/`).

## Требования

- [Rust](https://rustup.rs) (stable)
- [Node.js](https://nodejs.org/) 18+
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- MongoDB Atlas
- Kinopoisk API key

## 1. Локальная проверка

```bash
cp .env.example .env
cargo check
cargo test --lib
```

## 2. Локальный запуск API

```bash
cargo run --bin server
```

API будет доступен по `http://localhost:3000`.

Порт можно задать через:

- `LOCAL_SERVER_PORT` (приоритетный)
- `PORT`

Пример:

```bash
LOCAL_SERVER_PORT=3001 cargo run --bin server
```

## 3. Деплой на Vercel

```bash
vercel deploy --prod
```

`vercel.json` содержит:

- `buildCommand`: `npm --prefix docs ci && npm --prefix docs run build`
- rewrites для docs (`/`) и API (`/api/v1/*`)

## Переменные окружения

| Переменная | Обязательная | Описание |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JWT signing secret |
| `MONGO_DB_NAME` | — | DB name (default: `neomovies`) |
| `KPAPI_KEY` | ✅ | Kinopoisk API key |
| `KPAPI_BASE_URL` | — | KP API base URL |
| `NEO_ID_URL` | ✅ | Neo ID base URL |
| `NEO_ID_API_KEY` | ✅ | Neo ID API key |
| `NEO_ID_SITE_ID` | ✅ | Neo ID site ID |
| `ALLOHA_TOKEN` | — | Alloha token |
| `LUMEX_URL` | — | Lumex embed base URL |
| `VIBIX_HOST` | — | Vibix host |
| `VIBIX_TOKEN` | — | Vibix token |
| `HDVB_TOKEN` | — | HDVB token |
| `COLLAPS_API_HOST` | — | Collaps API host |
| `COLLAPS_TOKEN` | — | Collaps token |
| `REDAPI_BASE_URL` | — | Torrent API base URL |

## Маршруты после деплоя

- `/` — документация
- `/api/v1/*` — REST API
