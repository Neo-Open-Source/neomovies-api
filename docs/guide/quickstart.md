# Быстрый старт

## Требования

- Go (версия из `go.mod`)
- MongoDB
- API ключ Kinopoisk (`KPAPI_KEY`)

## Локальный запуск

1. Скопируй переменные окружения:

```bash
cp .env.example .env
```

2. Заполни минимум:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `KPAPI_KEY`
- `JWT_SECRET`

3. Установи зависимости и запусти:

```bash
go mod download
go run main.go
```

## Проверка

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/openapi.json
```
