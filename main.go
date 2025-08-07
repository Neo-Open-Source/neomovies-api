package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"

	"neomovies-api/pkg/config"
	"neomovies-api/pkg/database"
	appHandlers "neomovies-api/pkg/handlers"
	"neomovies-api/pkg/middleware"
	"neomovies-api/pkg/services"
)

func main() {
	// Загружаем переменные окружения
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	// Инициализируем конфигурацию
	cfg := config.New()

	// Подключаемся к базе данных
	db, err := database.Connect(cfg.MongoURI)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer database.Disconnect()

	// Инициализируем сервисы
	tmdbService := services.NewTMDBService(cfg.TMDBAccessToken)
	emailService := services.NewEmailService(cfg)
	authService := services.NewAuthService(db, cfg.JWTSecret, emailService)
	movieService := services.NewMovieService(db, tmdbService)
	tvService := services.NewTVService(db, tmdbService)
	torrentService := services.NewTorrentService()
	reactionsService := services.NewReactionsService(db)

	// Создаем обработчики
	authHandler := appHandlers.NewAuthHandler(authService)
	movieHandler := appHandlers.NewMovieHandler(movieService)
	tvHandler := appHandlers.NewTVHandler(tvService)
	docsHandler := appHandlers.NewDocsHandler()
	searchHandler := appHandlers.NewSearchHandler(tmdbService)
	categoriesHandler := appHandlers.NewCategoriesHandler(tmdbService)
	playersHandler := appHandlers.NewPlayersHandler(cfg)
	torrentsHandler := appHandlers.NewTorrentsHandler(torrentService, tmdbService)
	reactionsHandler := appHandlers.NewReactionsHandler(reactionsService)
	imagesHandler := appHandlers.NewImagesHandler()

	// Настраиваем маршруты
	r := mux.NewRouter()

	// Документация API на корневом пути
	r.HandleFunc("/", docsHandler.ServeDocs).Methods("GET")
	r.HandleFunc("/openapi.json", docsHandler.GetOpenAPISpec).Methods("GET")

	// API маршруты
	api := r.PathPrefix("/api/v1").Subrouter()

	// Публичные маршруты
	api.HandleFunc("/health", appHandlers.HealthCheck).Methods("GET")
	api.HandleFunc("/auth/register", authHandler.Register).Methods("POST")
	api.HandleFunc("/auth/login", authHandler.Login).Methods("POST")
	api.HandleFunc("/auth/verify", authHandler.VerifyEmail).Methods("POST")
	api.HandleFunc("/auth/resend-code", authHandler.ResendVerificationCode).Methods("POST")

	// Поиск
	r.HandleFunc("/search/multi", searchHandler.MultiSearch).Methods("GET")

	// Категории
	api.HandleFunc("/categories", categoriesHandler.GetCategories).Methods("GET")
	api.HandleFunc("/categories/{id}/movies", categoriesHandler.GetMoviesByCategory).Methods("GET")// Плееры - ИСПРАВЛЕНО: добавлены параметры {imdb_id}

    // Плееры
    api.HandleFunc("/players/alloha/{imdb_id}", playersHandler.GetAllohaPlayer).Methods("GET")
    api.HandleFunc("/players/lumex/{imdb_id}", playersHandler.GetLumexPlayer).Methods("GET")

	// Торренты
	api.HandleFunc("/torrents/search/{imdbId}", torrentsHandler.SearchTorrents).Methods("GET")
	api.HandleFunc("/torrents/movies", torrentsHandler.SearchMovies).Methods("GET")
	api.HandleFunc("/torrents/series", torrentsHandler.SearchSeries).Methods("GET")
	api.HandleFunc("/torrents/anime", torrentsHandler.SearchAnime).Methods("GET")
	api.HandleFunc("/torrents/seasons", torrentsHandler.GetAvailableSeasons).Methods("GET")
	api.HandleFunc("/torrents/search", torrentsHandler.SearchByQuery).Methods("GET")

	// Реакции (публичные)
	api.HandleFunc("/reactions/{mediaType}/{mediaId}/counts", reactionsHandler.GetReactionCounts).Methods("GET")

	// Изображения (прокси для TMDB)
	api.HandleFunc("/images/{size}/{path:.*}", imagesHandler.GetImage).Methods("GET")

	// Маршруты для фильмов (некоторые публичные, некоторые приватные)
	api.HandleFunc("/movies/search", movieHandler.Search).Methods("GET")
	api.HandleFunc("/movies/popular", movieHandler.Popular).Methods("GET")
	api.HandleFunc("/movies/top-rated", movieHandler.TopRated).Methods("GET")
	api.HandleFunc("/movies/upcoming", movieHandler.Upcoming).Methods("GET")
	api.HandleFunc("/movies/now-playing", movieHandler.NowPlaying).Methods("GET")
	api.HandleFunc("/movies/{id}", movieHandler.GetByID).Methods("GET")
	api.HandleFunc("/movies/{id}/recommendations", movieHandler.GetRecommendations).Methods("GET")
	api.HandleFunc("/movies/{id}/similar", movieHandler.GetSimilar).Methods("GET")

	// Маршруты для сериалов
	api.HandleFunc("/tv/search", tvHandler.Search).Methods("GET")
	api.HandleFunc("/tv/popular", tvHandler.Popular).Methods("GET")
	api.HandleFunc("/tv/top-rated", tvHandler.TopRated).Methods("GET")
	api.HandleFunc("/tv/on-the-air", tvHandler.OnTheAir).Methods("GET")
	api.HandleFunc("/tv/airing-today", tvHandler.AiringToday).Methods("GET")
	api.HandleFunc("/tv/{id}", tvHandler.GetByID).Methods("GET")
	api.HandleFunc("/tv/{id}/recommendations", tvHandler.GetRecommendations).Methods("GET")
	api.HandleFunc("/tv/{id}/similar", tvHandler.GetSimilar).Methods("GET")

	// Приватные маршруты (требуют авторизации)
	protected := api.PathPrefix("").Subrouter()
	protected.Use(middleware.JWTAuth(cfg.JWTSecret))

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

	// CORS и другие middleware
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"}), 
                handlers.AllowCredentials(),
	)

	// Определяем порт
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("API documentation available at: http://localhost:%s/", port)
	
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}
