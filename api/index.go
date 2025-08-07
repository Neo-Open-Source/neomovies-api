package handler

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/mongo"

	"neomovies-api/pkg/config"
	"neomovies-api/pkg/database"
	handlersPkg "neomovies-api/pkg/handlers"
	"neomovies-api/pkg/middleware"
	"neomovies-api/pkg/services"
)

var (
	globalDB   *mongo.Database
	globalCfg  *config.Config
	initOnce   sync.Once
	initError  error
)

func initializeApp() {
	// Загружаем переменные окружения (в Vercel они уже установлены)
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found (normal for Vercel)")
	}

	// Инициализируем конфигурацию
	globalCfg = config.New()

	// Подключаемся к базе данных
	var err error
	globalDB, err = database.Connect(globalCfg.MongoURI)
	if err != nil {
		log.Printf("Failed to connect to database: %v", err)
		initError = err
		return
	}

	log.Println("Successfully connected to database")
}

func Handler(w http.ResponseWriter, r *http.Request) {
	// Инициализируем приложение один раз
	initOnce.Do(initializeApp)

	// Проверяем, была ли ошибка инициализации
	if initError != nil {
		log.Printf("Initialization error: %v", initError)
		http.Error(w, "Application initialization failed: "+initError.Error(), http.StatusInternalServerError)
		return
	}

	// Инициализируем сервисы
	tmdbService := services.NewTMDBService(globalCfg.TMDBAccessToken)
	emailService := services.NewEmailService(globalCfg)
	authService := services.NewAuthService(globalDB, globalCfg.JWTSecret, emailService)
	movieService := services.NewMovieService(globalDB, tmdbService)
	tvService := services.NewTVService(globalDB, tmdbService)
	torrentService := services.NewTorrentService()
	reactionsService := services.NewReactionsService(globalDB)

	// Создаем обработчики
	authHandler := handlersPkg.NewAuthHandler(authService)
	movieHandler := handlersPkg.NewMovieHandler(movieService)
	tvHandler := handlersPkg.NewTVHandler(tvService)
	docsHandler := handlersPkg.NewDocsHandler()
	searchHandler := handlersPkg.NewSearchHandler(tmdbService)
	categoriesHandler := handlersPkg.NewCategoriesHandler(tmdbService)
	playersHandler := handlersPkg.NewPlayersHandler(globalCfg)
	torrentsHandler := handlersPkg.NewTorrentsHandler(torrentService, tmdbService)
	reactionsHandler := handlersPkg.NewReactionsHandler(reactionsService)
	imagesHandler := handlersPkg.NewImagesHandler()

	// Настраиваем маршруты
	router := mux.NewRouter()

	// Документация API на корневом пути
	router.HandleFunc("/", docsHandler.ServeDocs).Methods("GET")
	router.HandleFunc("/openapi.json", docsHandler.GetOpenAPISpec).Methods("GET")

	// API маршруты
	api := router.PathPrefix("/api/v1").Subrouter()

	// Публичные маршруты
	api.HandleFunc("/health", handlersPkg.HealthCheck).Methods("GET")
	api.HandleFunc("/auth/register", authHandler.Register).Methods("POST")
	api.HandleFunc("/auth/login", authHandler.Login).Methods("POST")
	api.HandleFunc("/auth/verify", authHandler.VerifyEmail).Methods("POST")
	api.HandleFunc("/auth/resend-code", authHandler.ResendVerificationCode).Methods("POST")

	// Поиск
	router.HandleFunc("/search/multi", searchHandler.MultiSearch).Methods("GET")

	// Категории
	api.HandleFunc("/categories", categoriesHandler.GetCategories).Methods("GET")
	api.HandleFunc("/categories/{id}/movies", categoriesHandler.GetMoviesByCategory).Methods("GET")

	// Плееры
	api.HandleFunc("/players/alloha/{imdb_id}", playersHandler.GetAllohaPlayer).Methods("GET")
	api.HandleFunc("/players/lumex/{imdb_id}", playersHandler.GetLumexPlayer).Methods("GET")

	// Торренты
	api.HandleFunc("/torrents/search/{imdbId}", torrentsHandler.SearchTorrents).Methods("GET")

	// Реакции (публичные)
	api.HandleFunc("/reactions/{mediaType}/{mediaId}/counts", reactionsHandler.GetReactionCounts).Methods("GET")

	// Изображения (прокси для TMDB)
	api.HandleFunc("/images/{size}/{path:.*}", imagesHandler.GetImage).Methods("GET")

	// Маршруты для фильмов
	api.HandleFunc("/movies/search", movieHandler.Search).Methods("GET")
	api.HandleFunc("/movies/popular", movieHandler.Popular).Methods("GET")
	api.HandleFunc("/movies/top-rated", movieHandler.TopRated).Methods("GET")
	api.HandleFunc("/movies/upcoming", movieHandler.Upcoming).Methods("GET")
	api.HandleFunc("/movies/now-playing", movieHandler.NowPlaying).Methods("GET")
	api.HandleFunc("/movies/{id}", movieHandler.GetByID).Methods("GET")
	api.HandleFunc("/movies/{id}/recommendations", movieHandler.GetRecommendations).Methods("GET")
	api.HandleFunc("/movies/{id}/similar", movieHandler.GetSimilar).Methods("GET")
	api.HandleFunc("/movies/{id}/external-ids", movieHandler.GetExternalIDs).Methods("GET")

	// Маршруты для сериалов
	api.HandleFunc("/tv/search", tvHandler.Search).Methods("GET")
	api.HandleFunc("/tv/popular", tvHandler.Popular).Methods("GET")
	api.HandleFunc("/tv/top-rated", tvHandler.TopRated).Methods("GET")
	api.HandleFunc("/tv/on-the-air", tvHandler.OnTheAir).Methods("GET")
	api.HandleFunc("/tv/airing-today", tvHandler.AiringToday).Methods("GET")
	api.HandleFunc("/tv/{id}", tvHandler.GetByID).Methods("GET")
	api.HandleFunc("/tv/{id}/recommendations", tvHandler.GetRecommendations).Methods("GET")
	api.HandleFunc("/tv/{id}/similar", tvHandler.GetSimilar).Methods("GET")
	api.HandleFunc("/tv/{id}/external-ids", tvHandler.GetExternalIDs).Methods("GET")

	// Приватные маршруты (требуют авторизации)
	protected := api.PathPrefix("").Subrouter()
	protected.Use(middleware.JWTAuth(globalCfg.JWTSecret))

	// Избранное
	protected.HandleFunc("/favorites", movieHandler.GetFavorites).Methods("GET")
	protected.HandleFunc("/favorites/{id}", movieHandler.AddToFavorites).Methods("POST")
	protected.HandleFunc("/favorites/{id}", movieHandler.RemoveFromFavorites).Methods("DELETE")

	// Пользовательские данные
	protected.HandleFunc("/auth/profile", authHandler.GetProfile).Methods("GET")
	protected.HandleFunc("/auth/profile", authHandler.UpdateProfile).Methods("PUT")

	// Реакции (приватные)
	protected.HandleFunc("/reactions/{mediaType}/{mediaId}/my-reaction", reactionsHandler.GetMyReaction).Methods("GET")
	protected.HandleFunc("/reactions/{mediaType}/{mediaId}", reactionsHandler.SetReaction).Methods("POST")
	protected.HandleFunc("/reactions/{mediaType}/{mediaId}", reactionsHandler.RemoveReaction).Methods("DELETE")
	protected.HandleFunc("/reactions/my", reactionsHandler.GetMyReactions).Methods("GET")

	// CORS middleware
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"}), 
                handlers.AllowCredentials(),
	)

	// Обрабатываем запрос
	corsHandler(router).ServeHTTP(w, r)
}
