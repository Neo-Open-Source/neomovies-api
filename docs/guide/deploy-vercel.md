# Деплой на Vercel

На Vercel проект деплоится как **комбинация**:

- **Документация (VitePress)**: доступна на `/`
- **API (Go serverless)**: доступен на `/api/v1/*`
- **OpenAPI JSON**: `GET /openapi.json`

## Переменные окружения

Добавь в Vercel Environment Variables значения из `.env.example`.

Минимум для работы:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `KPAPI_KEY`
- `JWT_SECRET`

## Проверка после деплоя

- Открой `/` — должна открыться документация
- Открой `/api/v1/health` — должен отвечать API
