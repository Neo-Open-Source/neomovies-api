package handler

import (
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
	globalDB  *mongo.Database
	globalCfg *config.Config
	initOnce  sync.Once
	initError error
)

func initializeApp() {
	if err := godotenv.Load(); err != nil {
		_ = err
	}

	globalCfg = config.New()

	var err error
	globalDB, err = database.Connect(globalCfg.MongoURI, globalCfg.MongoDBName)
	if err != nil {
		initError = err
		return
	}
}

func Handler(w http.ResponseWriter, r *http.Request) {
	initOnce.Do(initializeApp)

	if initError != nil {
		http.Error(w, "Application initialization failed: "+initError.Error(), http.StatusInternalServerError)
		return
	}

	tmdbService := services.NewTMDBService(globalCfg.TMDBAccessToken)
	kpService := services.NewKinopoiskService(globalCfg.KPAPIKey, globalCfg.KPAPIBaseURL)
	emailService := services.NewEmailService(globalCfg)
	authService := services.NewAuthService(globalDB, globalCfg.JWTSecret, emailService, globalCfg.BaseURL, globalCfg.GoogleClientID, globalCfg.GoogleClientSecret, globalCfg.GoogleRedirectURL, globalCfg.FrontendURL)

	movieService := services.NewMovieService(globalDB, tmdbService, kpService)
	tvService := services.NewTVService(globalDB, tmdbService, kpService)
	favoritesService := services.NewFavoritesServiceWithKP(globalDB, tmdbService, kpService)
	torrentService := services.NewTorrentServiceWithConfig(globalCfg.RedAPIBaseURL, globalCfg.RedAPIKey)
	reactionsService := services.NewReactionsService(globalDB)

	authHandler := handlersPkg.NewAuthHandler(authService)
	movieHandler := handlersPkg.NewMovieHandler(movieService)
	tvHandler := handlersPkg.NewTVHandler(tvService)
	favoritesHandler := handlersPkg.NewFavoritesHandlerWithServices(favoritesService, globalCfg, tmdbService, kpService)
	docsHandler := handlersPkg.NewDocsHandler()
	searchHandler := handlersPkg.NewSearchHandler(tmdbService, kpService)
	unifiedHandler := handlersPkg.NewUnifiedHandler(tmdbService, kpService)
	categoriesHandler := handlersPkg.NewCategoriesHandler(tmdbService).WithKinopoisk(kpService)
	playersHandler := handlersPkg.NewPlayersHandler(globalCfg)
	torrentsHandler := handlersPkg.NewTorrentsHandler(torrentService, tmdbService)
	reactionsHandler := handlersPkg.NewReactionsHandler(reactionsService)
	imagesHandler := handlersPkg.NewImagesHandler()

	router := mux.NewRouter()

	router.HandleFunc("/", docsHandler.ServeDocs).Methods("GET")
	router.HandleFunc("/openapi.json", docsHandler.GetOpenAPISpec).Methods("GET")

	api := router.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/health", handlersPkg.HealthCheck).Methods("GET")
	api.HandleFunc("/auth/register", authHandler.Register).Methods("POST")
	api.HandleFunc("/auth/login", authHandler.Login).Methods("POST")
	api.HandleFunc("/auth/verify", authHandler.VerifyEmail).Methods("POST")
	api.HandleFunc("/auth/resend-code", authHandler.ResendVerificationCode).Methods("POST")
	api.HandleFunc("/auth/google/login", authHandler.GoogleLogin).Methods("GET")
	api.HandleFunc("/auth/google/callback", authHandler.GoogleCallback).Methods("GET")

	api.HandleFunc("/search/multi", searchHandler.MultiSearch).Methods("GET")

	api.HandleFunc("/categories", categoriesHandler.GetCategories).Methods("GET")
	api.HandleFunc("/categories/{id}/movies", categoriesHandler.GetMoviesByCategory).Methods("GET")
	api.HandleFunc("/categories/{id}/media", categoriesHandler.GetMediaByCategory).Methods("GET")

	api.HandleFunc("/players/alloha/{id_type}/{id}", playersHandler.GetAllohaPlayer).Methods("GET")
	api.HandleFunc("/players/alloha/meta/kp/{kp_id}", playersHandler.GetAllohaMetaByKP).Methods("GET")
	api.HandleFunc("/players/lumex/{id_type}/{id}", playersHandler.GetLumexPlayer).Methods("GET")
	api.HandleFunc("/players/vibix/{id_type}/{id}", playersHandler.GetVibixPlayer).Methods("GET")
	api.HandleFunc("/players/hdvb/{id_type}/{id}", playersHandler.GetHDVBPlayer).Methods("GET")
	api.HandleFunc("/players/vidsrc/{media_type}/{imdb_id}", playersHandler.GetVidsrcPlayer).Methods("GET")
	api.HandleFunc("/players/vidlink/movie/{imdb_id}", playersHandler.GetVidlinkMoviePlayer).Methods("GET")
	api.HandleFunc("/players/vidlink/tv/{tmdb_id}", playersHandler.GetVidlinkTVPlayer).Methods("GET")
	api.HandleFunc("/players/rgshows/{tmdb_id}", playersHandler.GetRgShowsPlayer).Methods("GET")
	api.HandleFunc("/players/rgshows/{tmdb_id}/{season}/{episode}", playersHandler.GetRgShowsTVPlayer).Methods("GET")
	api.HandleFunc("/players/iframevideo/{kinopoisk_id}/{imdb_id}", playersHandler.GetIframeVideoPlayer).Methods("GET")
	api.HandleFunc("/stream/{provider}/{tmdb_id}", playersHandler.GetStreamAPI).Methods("GET")

	api.HandleFunc("/torrents/search/{imdbId}", torrentsHandler.SearchTorrents).Methods("GET")
	api.HandleFunc("/torrents/movies", torrentsHandler.SearchMovies).Methods("GET")
	api.HandleFunc("/torrents/series", torrentsHandler.SearchSeries).Methods("GET")
	api.HandleFunc("/torrents/anime", torrentsHandler.SearchAnime).Methods("GET")
	api.HandleFunc("/torrents/seasons", torrentsHandler.GetAvailableSeasons).Methods("GET")
	api.HandleFunc("/torrents/by-title", torrentsHandler.SearchByTitle).Methods("GET")
	api.HandleFunc("/torrents/search", torrentsHandler.SearchByQuery).Methods("GET")

	api.HandleFunc("/reactions/{mediaType}/{mediaId}/counts", reactionsHandler.GetReactionCounts).Methods("GET")

	api.HandleFunc("/images/{type}/{id}", imagesHandler.GetImage).Methods("GET")

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

	// Unified prefixed routes - register last so they don't interfere with specific routes
	api.HandleFunc("/movie/{id}", unifiedHandler.GetMovie).Methods("GET")
	api.HandleFunc("/tv/{id}", unifiedHandler.GetTV).Methods("GET")
	api.HandleFunc("/search", unifiedHandler.Search).Methods("GET")

	protected := api.PathPrefix("").Subrouter()
	protected.Use(middleware.JWTAuth(globalCfg.JWTSecret))

	protected.HandleFunc("/favorites", favoritesHandler.GetFavorites).Methods("GET")
	protected.HandleFunc("/favorites/{id}", favoritesHandler.AddToFavorites).Methods("POST")
	protected.HandleFunc("/favorites/{id}", favoritesHandler.RemoveFromFavorites).Methods("DELETE")
	protected.HandleFunc("/favorites/{id}/check", favoritesHandler.CheckIsFavorite).Methods("GET")

	protected.HandleFunc("/auth/profile", authHandler.GetProfile).Methods("GET")
	protected.HandleFunc("/auth/profile", authHandler.UpdateProfile).Methods("PUT")
	protected.HandleFunc("/auth/profile", authHandler.DeleteAccount).Methods("DELETE")

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

	corsHandler(router).ServeHTTP(w, r)
}
