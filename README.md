# Neo Movies API

API для поиска фильмов и сериалов с поддержкой русского языка.

## Деплой на AlwaysData

1. Создайте аккаунт на [AlwaysData](https://www.alwaysdata.com)

2. Настройте SSH ключ:
   ```bash
   # Создайте SSH ключ если его нет
   ssh-keygen -t rsa -b 4096
   
   # Скопируйте публичный ключ
   cat ~/.ssh/id_rsa.pub
   ```
   Добавьте ключ в настройках AlwaysData (SSH Keys)

3. Подключитесь по SSH:
   ```bash
   # Замените username на ваш логин
   ssh username@ssh-username.alwaysdata.net
   ```

4. Установите Go:
   ```bash
   # Создайте директорию для Go
   mkdir -p $HOME/go/bin
   
   # Скачайте и установите Go
   wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
   tar -C $HOME -xzf go1.21.5.linux-amd64.tar.gz
   
   # Добавьте Go в PATH
   echo 'export PATH=$HOME/go/bin:$HOME/go/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

5. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/ваш-username/neomovies-api.git
   cd neomovies-api
   ```

6. Соберите приложение:
   ```bash
   chmod +x build.sh
   ./build.sh
   ```

7. Настройте сервис в панели AlwaysData:
   - Type: Site
   - Name: neomovies-api
   - Address: api.your-name.alwaysdata.net
   - Command: $HOME/neomovies-api/run.sh
   - Working directory: $HOME/neomovies-api
   
8. Добавьте переменные окружения:
   - `TMDB_ACCESS_TOKEN`: Ваш токен TMDB API
   - `PORT`: 8080 (или порт по умолчанию)

После деплоя ваше API будет доступно по адресу: https://api.your-name.alwaysdata.net

## Локальная разработка

1. Установите зависимости:
```bash
go mod download
```

2. Запустите сервер:
```bash
go run main.go
```

API будет доступно по адресу: http://localhost:8080

## API Endpoints

- `GET /movies/search` - Поиск фильмов
- `GET /movies/popular` - Популярные фильмы
- `GET /movies/top-rated` - Лучшие фильмы
- `GET /movies/upcoming` - Предстоящие фильмы
- `GET /movies/:id` - Информация о фильме
- `GET /health` - Проверка работоспособности API

Полная документация API доступна по адресу: `/swagger/index.html`
