# Neo Movies API

REST API для поиска и получения информации о фильмах, использующий TMDB API.

## Особенности

- Поиск фильмов
- Информация о фильмах
- Популярные фильмы
- Топ рейтинговые фильмы
- Предстоящие фильмы
- Swagger документация
- Поддержка русского языка

## Установка

1. Клонируйте репозиторий:
```bash
git clone https://gitlab.com/foxixus/neomovies-api.git
cd neomovies-api
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env`:
```bash
touch .env
```

4. Добавьте ваш TMDB Access Token в `.env` файл:
```

TMDB_ACCESS_TOKEN=your_tmdb_access_token
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret_key
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
LUMEX_URL=your_lumex_player_url
ALLOHA_TOKEN=your_alloha_token

```

## Запуск

Для разработки:
```bash
npm run dev
```

Для продакшена:
```bash
npm start
```

## Развертывание на Vercel

1. Установите Vercel CLI:
```bash
npm i -g vercel
```

2. Войдите в ваш аккаунт Vercel:
```bash
vercel login
```

3. Разверните приложение:
```bash
vercel
```

4. Добавьте переменные окружения в Vercel:
- Перейдите в настройки проекта на Vercel
- Добавьте `TMDB_ACCESS_TOKEN`, `MONGODB_URI`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `LUMEX_URL`, `ALLOHA_TOKEN` в раздел Environment Variables

## API Endpoints

- `GET /health` - Проверка работоспособности API
- `GET /movies/search?query=<search_term>&page=<page_number>` - Поиск фильмов
- `GET /movies/:id` - Получить информацию о фильме
- `GET /movies/popular` - Получить список популярных фильмов
- `GET /movies/top-rated` - Получить список топ рейтинговых фильмов
- `GET /movies/upcoming` - Получить список предстоящих фильмов
- `GET /movies/:id/external-ids` - Получить внешние ID фильма

## Документация API

После запуска API, документация Swagger доступна по адресу:
```
http://localhost:3000/api-docs
