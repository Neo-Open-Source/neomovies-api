# Конфигурация

API читает переменные окружения из окружения и (локально) из `.env`.

## База данных

- `MONGO_URI`
- `MONGO_DB_NAME`

В коде поддерживаются альтернативные имена для URI (`MONGODB_URI`, `DATABASE_URL`, `MONGO_URL`).

## Источники данных

### Kinopoisk (обязательно для большинства роутов)

- `KPAPI_KEY`
- `KPAPI_BASE_URL` (по умолчанию: `https://kinopoiskapiunofficial.tech/api`)

### TMDB (опционально)

- `TMDB_ACCESS_TOKEN`

Если токен не задан — часть функционала, завязанная на TMDB, будет недоступна/ограничена.

## JWT

- `JWT_SECRET`

Используется для защищённых роутов (избранное, мои реакции).

## Плееры и торренты

- `ALLOHA_TOKEN`
- `LUMEX_URL`
- `VIBIX_HOST`, `VIBIX_TOKEN`
- `HDVB_TOKEN`
- `COLLAPS_API_HOST`, `COLLAPS_TOKEN`
- `VEOVEO_HOST`, `VEOVEO_TOKEN`
- `REDAPI_BASE_URL`, `REDAPI_KEY`

## Прочее

- `PORT` (по умолчанию `3000`)
- `BASE_URL`
- `FRONTEND_URL`
- `NODE_ENV`
