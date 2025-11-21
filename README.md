# NeoMovies API

Полнофункциональный REST API для поиска и получения информации о фильмах и сериалах с интеграцией Kinopoisk и TMDB.

## Особенности

- **Двойная интеграция**: Kinopoisk API для русского контента + TMDB для международного
- **Умное переключение**: автоматический выбор источника по языку запроса
- **Коллекции Kinopoisk**: популярные, топ-рейтинговые фильмы/сериалы из официальных коллекций
- **Унифицированный формат**: единый ответ для контента из разных источников
- **Русские плееры**: Alloha, Lumex, Vibix, HDVB, Vidsrc, Vidlink
- **Поиск торрентов**: интеграция с RedAPI для поиска торрентов
- **Система реакций**: лайки, дизлайки, избранное с сохранением в БД
- **Аутентификация**: JWT + Google OAuth
- **Интерактивная документация**: Swagger/OpenAPI
- **Высокая производительность**: Go + горутины + кэширование

## 🛠 Быстрый старт

### Локальная разработка
1. **Клонирование репозитория**
```bash
git clone https://gitlab.com/foxixus/neomovies-api.git
cd neomovies-api
```

2. **Создание .env файла**
```bash
cp .env.example .env
# Заполните необходимые переменные
```

3. **Установка зависимостей**
```bash
go mod download
```

4. **Запуск**
```bash
go run main.go
```

API будет доступен на `http://localhost:3000`

### Деплой на Vercel

1. **Подключите репозиторий к Vercel**
2. **Настройте переменные окружения** (см. список ниже)
3. **Деплой произойдет автоматически**

## ⚙️ Переменные окружения

```bash
# Обязательные
MONGO_URI=mongodb://localhost:27017/neomovies
MONGO_DB_NAME=neomovies
TMDB_ACCESS_TOKEN=your_tmdb_access_token
JWT_SECRET=your_jwt_secret_key

# Kinopoisk API
KPAPI_KEY=your_kp_api_key
KPAPI_BASE_URL=https://kinopoiskapiunofficial.tech/api

# Сервис
PORT=3000
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
NODE_ENV=development

# Email (Gmail)
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password

# Русские плееры
LUMEX_URL=https://p.lumex.space
ALLOHA_TOKEN=your_alloha_token
VIBIX_HOST=https://vibix.org
VIBIX_TOKEN=your_vibix_token
HDVB_TOKEN=your_hdvb_token

# Торренты (RedAPI)
REDAPI_BASE_URL=http://redapi.cfhttp.top
REDAPI_KEY=your_redapi_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URL=http://localhost:3000/api/v1/auth/google/callback
```

## 📋 API Endpoints

### 🔓 Публичные маршруты (старые)

```http
# Система
GET  /api/v1/health                          # Проверка состояния

# Аутентификация
POST /api/v1/auth/register                   # Регистрация (отправка кода)
POST /api/v1/auth/verify                     # Подтверждение email кодом
POST /api/v1/auth/resend-code               # Повторная отправка кода
POST /api/v1/auth/login                      # Авторизация
GET  /api/v1/auth/google/login               # Начало авторизации через Google (redirect)
GET  /api/v1/auth/google/callback            # Коллбек Google OAuth (возвращает JWT)

# Поиск и категории
GET  /search/multi                           # Мультипоиск
GET  /api/v1/categories                      # Список категорий
GET  /api/v1/categories/{id}/movies          # Фильмы по категории

# Фильмы
GET  /api/v1/movies/search                   # Поиск фильмов
GET  /api/v1/movies/popular                  # Популярные
GET  /api/v1/movies/top-rated                # Топ-рейтинговые
GET  /api/v1/movies/upcoming                 # Предстоящие
GET  /api/v1/movies/now-playing              # В прокате
GET  /api/v1/movies/{id}                     # Детали фильма (устар.)
GET  /api/v1/movies/{id}/recommendations     # Рекомендации
GET  /api/v1/movies/{id}/similar             # Похожие

# Сериалы
GET  /api/v1/tv/search                       # Поиск сериалов
GET  /api/v1/tv/popular                      # Популярные
GET  /api/v1/tv/top-rated                    # Топ-рейтинговые
GET  /api/v1/tv/on-the-air                   # В эфире
GET  /api/v1/tv/airing-today                 # Сегодня в эфире
GET  /api/v1/tv/{id}                         # Детали сериала (устар.)
### 🔓 Публичные маршруты (унифицированные)

```http
# Единый формат ID: SOURCE_ID = kp_123 | tmdb_456
GET  /api/v1/movie/{SOURCE_ID}               # Детали фильма (унифицированный ответ)
GET  /api/v1/tv/{SOURCE_ID}                  # Детали сериала (унифицированный ответ, с seasons[])
GET  /api/v1/search?query=...&source=kp|tmdb # Мультипоиск (унифицированные элементы)
```

Примеры:

```http
GET /api/v1/movie/tmdb_550
GET /api/v1/movie/kp_666
GET /api/v1/tv/tmdb_1399
GET /api/v1/search?query=matrix&source=tmdb
```

Схема ответа см. раздел «Unified responses» ниже.

## Unified responses

Пример карточки:

```json
{
  "success": true,
  "data": {
    "id": "550",
    "sourceId": "tmdb_550",
    "title": "Fight Club",
    "originalTitle": "Fight Club",
    "description": "…",
    "releaseDate": "1999-10-15",
    "endDate": null,
    "type": "movie",
    "genres": [{ "id": "drama", "name": "Drama" }],
    "rating": 8.8,
    "posterUrl": "https://image.tmdb.org/t/p/w500/...jpg",
    "backdropUrl": "https://image.tmdb.org/t/p/w1280/...jpg",
    "director": "",
    "cast": [],
    "duration": 139,
    "country": "US",
    "language": "en",
    "budget": 63000000,
    "revenue": 100853753,
    "imdbId": "0137523",
    "externalIds": { "kp": null, "tmdb": 550, "imdb": "0137523" },
    "seasons": []
  },
  "source": "tmdb",
  "metadata": { "fetchedAt": "...", "apiVersion": "3.0", "responseTime": 12 }
}
```

Пример мультипоиска:

```json
{
  "success": true,
  "data": [
    {
      "id": "550",
      "sourceId": "tmdb_550",
      "title": "Fight Club",
      "type": "movie",
      "releaseDate": "1999-10-15",
      "posterUrl": "https://image.tmdb.org/t/p/w500/...jpg",
      "rating": 8.8,
      "description": "…",
      "externalIds": { "kp": null, "tmdb": 550, "imdb": "" }
    }
  ],
  "source": "tmdb",
  "pagination": { "page": 1, "totalPages": 5, "totalResults": 42, "pageSize": 20 },
  "metadata": { "fetchedAt": "...", "apiVersion": "3.0", "responseTime": 20, "query": "fight" }
}
```
GET  /api/v1/tv/{id}/recommendations         # Рекомендации
GET  /api/v1/tv/{id}/similar                 # Похожие

# Плееры (новый формат с типом ID)
GET  /api/v1/players/alloha/{id_type}/{id}    # Alloha плеер (kp/301 или imdb/tt0133093)
GET  /api/v1/players/lumex/{id_type}/{id}     # Lumex плеер (kp/301 или imdb/tt0133093)
GET  /api/v1/players/vibix/{id_type}/{id}     # Vibix плеер (kp/301 или imdb/tt0133093)
GET  /api/v1/players/hdvb/{id_type}/{id}      # HDVB плеер (kp/301 или imdb/tt0133093)
GET  /api/v1/players/vidsrc/{media_type}/{imdb_id}  # Vidsrc (только IMDB)
GET  /api/v1/players/vidlink/movie/{imdb_id}       # Vidlink фильмы (только IMDB)
GET  /api/v1/players/vidlink/tv/{tmdb_id}          # Vidlink сериалы (только TMDB)

# Торренты
GET  /api/v1/torrents/search/{imdbId}        # Поиск торрентов

# Реакции (публичные)
GET  /api/v1/reactions/{mediaType}/{mediaId}/counts    # Счетчики реакций

# Изображения
GET  /api/v1/images/{size}/{path}            # Прокси TMDB изображений
```

### 🔒 Приватные маршруты (требуют JWT)

```http
# Профиль
GET  /api/v1/auth/profile                    # Профиль пользователя
PUT  /api/v1/auth/profile                    # Обновление профиля

# Избранное
GET  /api/v1/favorites                       # Список избранного
POST /api/v1/favorites/{id}                  # Добавить в избранное
DELETE /api/v1/favorites/{id}                # Удалить из избранного

# Реакции (приватные)
GET  /api/v1/reactions/{mediaType}/{mediaId}/my-reaction # Моя реакция
POST /api/v1/reactions/{mediaType}/{mediaId}           # Установить реакцию
DELETE /api/v1/reactions/{mediaType}/{mediaId}         # Удалить реакцию
GET  /api/v1/reactions/my                              # Все мои реакции
```

## 📖 Примеры использования

### Регистрация и верификация

```bash
# 1. Регистрация
curl -X POST https://api.neomovies.ru/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'

# Ответ: {"success": true, "message": "Registered. Check email for verification code."}

# 2. Подтверждение email (код из письма)
curl -X POST https://api.neomovies.ru/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "code": "123456"
  }'

# 3. Авторизация
curl -X POST https://api.neomovies.ru/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Поиск (унифицированный)

```bash
# Мультипоиск (источник обязателен)
curl "https://api.neomovies.ru/api/v1/search?query=matrix&source=tmdb&page=1"

# Детали по униф. ID
curl "https://api.neomovies.ru/api/v1/movie/tmdb_550"
curl "https://api.neomovies.ru/api/v1/tv/kp_61365"
```

### Поиск торрентов

```bash
# Поиск торрентов для фильма "Побег из Шоушенка"
curl "https://api.neomovies.ru/api/v1/torrents/search/tt0111161?type=movie&quality=1080p"
```

## 🎨 Документация API

Интерактивная документация доступна по адресу:

**🔗 https://api.neomovies.ru/**

## ☁️ Деплой на Vercel

1. **Подключите репозиторий к Vercel**
2. **Настройте Environment Variables в Vercel Dashboard:**
3. **Деплой автоматически запустится!**

## 🏗 Архитектура

```
├── main.go                 # Точка входа приложения
├── api/
│   └── index.go           # Vercel serverless handler
├── pkg/                   # Публичные пакеты (совместимо с Vercel)
│   ├── config/           # Конфигурация с поддержкой альтернативных env vars
│   ├── database/         # Подключение к MongoDB
│   ├── middleware/       # JWT, CORS, логирование
│   ├── models/          # Структуры данных
│   ├── services/        # Бизнес-логика
│   └── handlers/        # HTTP обработчики
├── vercel.json          # Конфигурация Vercel
└── go.mod              # Go модули
```

## 🔧 Технологии

- **Go 1.21** - основной язык
- **Gorilla Mux** - HTTP роутер
- **MongoDB** - база данных
- **JWT** - аутентификация
- **TMDB API** - данные о фильмах (международный контент)
- **Kinopoisk API Unofficial** - данные о русском контенте
- **Gmail SMTP** - email уведомления
- **Vercel** - деплой и хостинг

## 🌍 Kinopoisk API интеграция

API автоматически переключается между TMDB и Kinopoisk в зависимости от языка запроса:

- **Русский язык (`lang=ru`)** → Kinopoisk API
  - Русские названия фильмов
  - Рейтинги Кинопоиска
  - Поддержка Kinopoisk ID
  
- **Английский язык (`lang=en`)** → TMDB API
  - Международные названия
  - Рейтинги IMDB/TMDB
  - Поддержка IMDB/TMDB ID

### Формат ID в плеерах

Все русские плееры поддерживают два типа идентификаторов:

```bash
# По Kinopoisk ID (приоритет для русского контента)
GET /api/v1/players/alloha/kp/301

# По IMDB ID (fallback)
GET /api/v1/players/alloha/imdb/tt0133093

# Примеры для других плееров
GET /api/v1/players/lumex/kp/301
GET /api/v1/players/vibix/kp/301
GET /api/v1/players/hdvb/kp/301
```

## 🚀 Производительность

По сравнению с Node.js версией:
- **3x быстрее** обработка запросов
- **50% меньше** потребление памяти
- **Конкурентность** благодаря горутинам
- **Типобезопасность** предотвращает ошибки

## 🤝 Contribution

1. Форкните репозиторий
2. Создайте feature-ветку (`git checkout -b feature/amazing-feature`)
3. Коммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Пушните в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Apache License 2.0 - подробности в файле [LICENSE](LICENSE)

---

Made with <3 by Foxix