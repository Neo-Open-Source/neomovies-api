package api

import (
	"neomovies-api/internal/tmdb"
)

var (
	tmdbClient *tmdb.Client
)

// InitTMDBClient инициализирует TMDB клиент
func InitTMDBClient(apiKey string) {
	tmdbClient = tmdb.NewClient(apiKey)
}
