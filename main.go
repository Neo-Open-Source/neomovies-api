package main

import (
	"log"
	"os"

	"neomovies-api/internal/api"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "neomovies-api/docs"
)

// @title Neo Movies API
// @version 1.0
// @description API для работы с фильмами
// @host localhost:8080
// @BasePath /
func main() {
	// Устанавливаем переменные окружения
	os.Setenv("GIN_MODE", "debug")
	os.Setenv("PORT", "8080")
	os.Setenv("TMDB_ACCESS_TOKEN", "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZmU3ODhlYmI5ZDAwNjZiNjQ2MWZhNzk5M2MyMzcxYiIsIm5iZiI6MTcyMzQwMTM3My4yMDgsInN1YiI6IjY2YjkwNDlkNzU4ZDQxOTQwYzA3NjlhNSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.x50tvcWDdBTEhtwRb3dE7aEe9qu4sXV_qOjLMn_Vmew")

	// Инициализируем TMDB клиент с CommsOne DNS
	log.Println("Initializing TMDB client with CommsOne DNS")
	api.InitTMDBClient(os.Getenv("TMDB_ACCESS_TOKEN"))

	// Устанавливаем режим Gin
	gin.SetMode(os.Getenv("GIN_MODE"))

	// Создаем роутер
	r := gin.Default()

	// Настраиваем CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},
	}))

	// Swagger документация
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Health check
	r.GET("/health", api.HealthCheck)

	// Movies API
	movies := r.Group("/movies")
	{
		movies.GET("/popular", api.GetPopularMovies)
		movies.GET("/search", api.SearchMovies)
		movies.GET("/top-rated", api.GetTopRatedMovies)
		movies.GET("/upcoming", api.GetUpcomingMovies)
		movies.GET("/:id", api.GetMovie)
	}

	// Bridge API
	bridge := r.Group("/bridge")
	{
		// TMDB endpoints
		tmdb := bridge.Group("/tmdb")
		{
			// Movie endpoints
			movie := tmdb.Group("/movie")
			{
				movie.GET("/popular", api.GetTMDBPopularMovies)
				movie.GET("/top_rated", api.GetTMDBTopRatedMovies)
				movie.GET("/upcoming", api.GetTMDBUpcomingMovies)
				movie.GET("/:id", api.GetTMDBMovie)
				movie.GET("/:id/external_ids", api.GetTMDBMovieExternalIDs)
			}

			// Search endpoints
			search := tmdb.Group("/search")
			{
				search.GET("/movie", api.SearchTMDBMovies)
				search.GET("/tv", api.SearchTMDBTV)
			}

			// TV endpoints
			tv := tmdb.Group("/tv")
			{
				tv.GET("/:id/external_ids", api.GetTMDBTVExternalIDs)
			}

			// Discover endpoints
			discover := tmdb.Group("/discover")
			{
				discover.GET("/movie", api.DiscoverMovies)
				discover.GET("/tv", api.DiscoverTV)
			}
		}
	}

	// Admin API
	admin := r.Group("/admin")
	{
		// Movies endpoints
		adminMovies := admin.Group("/movies")
		{
			adminMovies.GET("", api.GetAdminMovies)
			adminMovies.POST("/toggle-visibility", api.ToggleMovieVisibility)
		}

		// Users endpoints
		adminUsers := admin.Group("/users")
		{
			adminUsers.GET("", api.GetUsers)
			adminUsers.POST("/create", api.CreateUser)
			adminUsers.POST("/toggle-admin", api.ToggleAdmin)
			adminUsers.POST("/send-verification", api.SendVerification)
			adminUsers.POST("/verify-code", api.VerifyCode)
		}
	}

	// Запускаем сервер
	port := os.Getenv("PORT")
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
