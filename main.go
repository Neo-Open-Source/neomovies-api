package main

import (
	"fmt"
	"io"
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
	"neomovies-api/pkg/monitor"
	"neomovies-api/pkg/services"
)

func main() {
	// Инициализация логирования в файл
	logFile, err := os.OpenFile("neomovies-api.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		fmt.Printf("Failed to open log file: %v\n", err)
	} else {
		// Пишем логи одновременно в файл и в консоль
		multiWriter := io.MultiWriter(os.Stdout, logFile)
		log.SetOutput(multiWriter)
		log.SetFlags(log.LstdFlags | log.Lshortfile)
		defer logFile.Close()
	}

	if err := godotenv.Load(); err != nil {
		_ = err
	}

	cfg := config.New()

	db, err := database.Connect(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		fmt.Printf("❌ Failed to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer database.Disconnect()

	var tmdbService *services.TMDBService
	if cfg.TMDBAccessToken != "" {
		tmdbService = services.NewTMDBService(cfg.TMDBAccessToken)
	}
	kpService := services.NewKinopoiskService(cfg.KPAPIKey, cfg.KPAPIBaseURL)
	movieService := services.NewMovieService(db, tmdbService, kpService)
	tvService := services.NewTVService(db, tmdbService, kpService)
	favoritesService := services.NewFavoritesServiceWithKP(db, tmdbService, kpService)
	torrentService := services.NewTorrentServiceWithConfig(cfg.RedAPIBaseURL, cfg.RedAPIKey)
	reactionsService := services.NewReactionsService(db)

	authService := services.NewAuthService(db, cfg.JWTSecret)

	neoIDService := services.NewNeoIDService(db, cfg.NeoIDURL, cfg.NeoIDAPIKey, cfg.NeoIDSiteID, cfg.JWTSecret)

	movieHandler := appHandlers.NewMovieHandler(movieService)
	tvHandler := appHandlers.NewTVHandler(tvService)
	favoritesHandler := appHandlers.NewFavoritesHandlerWithServices(favoritesService, cfg, tmdbService, kpService)
	docsHandler := appHandlers.NewDocsHandler()
	searchHandler := appHandlers.NewSearchHandler(tmdbService, kpService)
	unifiedHandler := appHandlers.NewUnifiedHandler(tmdbService, kpService)
	categoriesHandler := appHandlers.NewCategoriesHandler(tmdbService).WithKinopoisk(kpService)
	playersHandler := appHandlers.NewPlayersHandler(cfg)
	torrentsHandler := appHandlers.NewTorrentsHandler(torrentService, tmdbService)
	reactionsHandler := appHandlers.NewReactionsHandler(reactionsService)
	imagesHandler := appHandlers.NewImagesHandler()
	supportHandler := appHandlers.NewSupportHandler()
	neoIDHandler := appHandlers.NewNeoIDHandler(neoIDService, authService)
	authHandler := appHandlers.NewAuthHandler(authService).WithNeoID(neoIDService)
	webhookHandler := appHandlers.NewWebhookHandler(authService)

	r := mux.NewRouter()

	r.HandleFunc("/openapi.json", docsHandler.GetOpenAPISpec).Methods("GET")

	api := r.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/health", appHandlers.HealthCheck).Methods("GET")

	// Auth — only Neo ID
	api.HandleFunc("/auth/neo-id/login", neoIDHandler.GetLoginURL).Methods("POST")
	api.HandleFunc("/auth/neo-id/callback", neoIDHandler.Callback).Methods("POST")
	api.HandleFunc("/auth/refresh", authHandler.RefreshToken).Methods("POST")
	// Webhooks
	api.HandleFunc("/webhooks/neo-id", webhookHandler.NeoIDWebhook).Methods("POST")
	// Disabled legacy auth endpoints
	gone := func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"disabled, use Neo ID auth"}`, http.StatusGone)
	}
	api.HandleFunc("/auth/register", gone).Methods("POST")
	api.HandleFunc("/auth/login", gone).Methods("POST")
	api.HandleFunc("/auth/verify-email", gone).Methods("POST")
	api.HandleFunc("/auth/resend-code", gone).Methods("POST")
	api.HandleFunc("/auth/google/login", gone).Methods("GET")
	api.HandleFunc("/auth/google/callback", gone).Methods("GET")

	api.HandleFunc("/search/multi", searchHandler.MultiSearch).Methods("GET")

	api.HandleFunc("/categories", categoriesHandler.GetCategories).Methods("GET")
	api.HandleFunc("/categories/{id}/movies", categoriesHandler.GetMoviesByCategory).Methods("GET")
	api.HandleFunc("/categories/{id}/media", categoriesHandler.GetMediaByCategory).Methods("GET")

	api.HandleFunc("/players/alloha/{id_type}/{id}", playersHandler.GetAllohaPlayer).Methods("GET")
	api.HandleFunc("/players/lumex/{id_type}/{id}", playersHandler.GetLumexPlayer).Methods("GET")
	api.HandleFunc("/players/vibix/{id_type}/{id}", playersHandler.GetVibixPlayer).Methods("GET")
	api.HandleFunc("/players/vidsrc/{media_type}/{imdb_id}", playersHandler.GetVidsrcPlayer).Methods("GET")
	api.HandleFunc("/players/vidlink/movie/{imdb_id}", playersHandler.GetVidlinkMoviePlayer).Methods("GET")
	api.HandleFunc("/players/vidlink/tv/{tmdb_id}", playersHandler.GetVidlinkTVPlayer).Methods("GET")
	api.HandleFunc("/players/hdvb/{id_type}/{id}", playersHandler.GetHDVBPlayer).Methods("GET")
	api.HandleFunc("/players/collaps/{id_type}/{id}", playersHandler.GetCollapsPlayer).Methods("GET")

	api.HandleFunc("/torrents/search/by-title", torrentsHandler.SearchByTitle).Methods("GET")
	api.HandleFunc("/torrents/search", torrentsHandler.SearchByQuery).Methods("GET")
	api.HandleFunc("/torrents/search/{imdbId}", torrentsHandler.SearchTorrents).Methods("GET")
	api.HandleFunc("/torrents/movies", torrentsHandler.SearchMovies).Methods("GET")
	api.HandleFunc("/torrents/series", torrentsHandler.SearchSeries).Methods("GET")
	api.HandleFunc("/torrents/anime", torrentsHandler.SearchAnime).Methods("GET")
	api.HandleFunc("/torrents/seasons", torrentsHandler.GetAvailableSeasons).Methods("GET")

	api.HandleFunc("/reactions/{mediaType}/{mediaId}/counts", reactionsHandler.GetReactionCounts).Methods("GET")

	api.HandleFunc("/images/{type}/{id}", imagesHandler.GetImage).Methods("GET")

	api.HandleFunc("/support/list", supportHandler.GetSupportersList).Methods("GET")

	// Movies routes - specific paths first, then parameterized
	api.HandleFunc("/movies/search", movieHandler.Search).Methods("GET")
	api.HandleFunc("/movies/popular", movieHandler.Popular).Methods("GET")
	api.HandleFunc("/movies/top-rated", movieHandler.TopRated).Methods("GET")
	api.HandleFunc("/movies/upcoming", movieHandler.Upcoming).Methods("GET")
	api.HandleFunc("/movies/{id}/recommendations", movieHandler.GetRecommendations).Methods("GET")
	api.HandleFunc("/movies/{id}/similar", movieHandler.GetSimilar).Methods("GET")
	api.HandleFunc("/movies/{id}/external-ids", movieHandler.GetExternalIDs).Methods("GET")
	api.HandleFunc("/movies/{id}", movieHandler.GetByID).Methods("GET")

	// TV routes - specific paths first, then parameterized
	api.HandleFunc("/tv/search", tvHandler.Search).Methods("GET")
	api.HandleFunc("/tv/popular", tvHandler.Popular).Methods("GET")
	api.HandleFunc("/tv/top-rated", tvHandler.TopRated).Methods("GET")
	api.HandleFunc("/tv/on-the-air", tvHandler.OnTheAir).Methods("GET")
	api.HandleFunc("/tv/airing-today", tvHandler.AiringToday).Methods("GET")
	api.HandleFunc("/tv/{id}/recommendations", tvHandler.GetRecommendations).Methods("GET")
	api.HandleFunc("/tv/{id}/similar", tvHandler.GetSimilar).Methods("GET")
	api.HandleFunc("/tv/{id}/external-ids", tvHandler.GetExternalIDs).Methods("GET")
	api.HandleFunc("/tv/{id}", tvHandler.GetByID).Methods("GET")

	api.HandleFunc("/movie/{id}", unifiedHandler.GetMovie).Methods("GET")
	api.HandleFunc("/tv/{id}", unifiedHandler.GetTV).Methods("GET")
	api.HandleFunc("/search", unifiedHandler.Search).Methods("GET")

	protected := api.PathPrefix("").Subrouter()
	protected.Use(middleware.JWTAuthWithUserCheck(cfg.JWTSecret, authService))

	protected.HandleFunc("/favorites", favoritesHandler.GetFavorites).Methods("GET")
	protected.HandleFunc("/favorites/{id}", favoritesHandler.AddToFavorites).Methods("POST")
	protected.HandleFunc("/favorites/{id}", favoritesHandler.RemoveFromFavorites).Methods("DELETE")
	protected.HandleFunc("/favorites/{id}/check", favoritesHandler.CheckIsFavorite).Methods("GET")

	// Protected auth routes
	protected.HandleFunc("/auth/profile", authHandler.GetProfile).Methods("GET")
	protected.HandleFunc("/auth/profile", authHandler.UpdateProfile).Methods("PUT")
	protected.HandleFunc("/auth/refresh-tokens/revoke", authHandler.RevokeRefreshToken).Methods("POST")
	protected.HandleFunc("/auth/refresh-tokens/revoke-all", authHandler.RevokeAllRefreshTokens).Methods("POST")
	protected.HandleFunc("/auth/delete-account", authHandler.DeleteAccount).Methods("DELETE")

	protected.HandleFunc("/reactions/{mediaType}/{mediaId}/my-reaction", reactionsHandler.GetMyReaction).Methods("GET")
	protected.HandleFunc("/reactions/{mediaType}/{mediaId}", reactionsHandler.SetReaction).Methods("POST")
	protected.HandleFunc("/reactions/{mediaType}/{mediaId}", reactionsHandler.RemoveReaction).Methods("DELETE")
	protected.HandleFunc("/reactions/my", reactionsHandler.GetMyReactions).Methods("GET")

	// CORS configuration - allow all origins
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{
			"*", // Allow all origins
		}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"}),
		handlers.AllowedHeaders([]string{
			"Authorization",
			"Content-Type",
			"Accept",
			"Origin",
			"X-Requested-With",
			"X-CSRF-Token",
			"Access-Control-Allow-Origin",
			"Access-Control-Allow-Headers",
			"Access-Control-Allow-Methods",
			"Access-Control-Allow-Credentials",
		}),
		handlers.ExposedHeaders([]string{
			"Authorization",
			"Content-Type",
			"X-Total-Count",
		}),
		handlers.MaxAge(3600),
	)

	var finalHandler http.Handler
	if cfg.NodeEnv == "development" {
		r.Use(monitor.RequestMonitor())
		finalHandler = corsHandler(r)

		fmt.Println("\n🚀 NeoMovies API Server")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("📡 Server: http://localhost:%s\n", cfg.Port)
		fmt.Printf("📚 Docs:   http://localhost:%s/\n", cfg.Port)
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("%-6s %-3s │ %-60s │ %8s\n", "METHOD", "CODE", "ENDPOINT", "TIME")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	} else {
		finalHandler = corsHandler(r)
		fmt.Printf("✅ Server starting on port %s\n", cfg.Port)
	}

	port := cfg.Port
	if port == "" {
		port = "3000"
	}

	if err := http.ListenAndServe(":"+port, finalHandler); err != nil {
		fmt.Printf("❌ Server failed to start: %v\n", err)
		os.Exit(1)
	}
}
