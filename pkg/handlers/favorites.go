package handlers

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"

    "github.com/gorilla/mux"

    "neomovies-api/pkg/config"
    "neomovies-api/pkg/middleware"
    "neomovies-api/pkg/models"
    "neomovies-api/pkg/services"
)

type FavoritesHandler struct {
	favoritesService *services.FavoritesService
	config           *config.Config
}

func NewFavoritesHandler(favoritesService *services.FavoritesService, cfg *config.Config) *FavoritesHandler {
	return &FavoritesHandler{
		favoritesService: favoritesService,
		config:           cfg,
	}
}

func (h *FavoritesHandler) GetFavorites(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	favorites, err := h.favoritesService.GetFavorites(userID)
	if err != nil {
		http.Error(w, "Failed to get favorites: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    favorites,
		Message: "Favorites retrieved successfully",
	})
}

func (h *FavoritesHandler) AddToFavorites(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	mediaID := vars["id"]
	mediaType := r.URL.Query().Get("type")

	if mediaID == "" {
		http.Error(w, "Media ID is required", http.StatusBadRequest)
		return
	}

	if mediaType == "" {
		mediaType = "movie" // По умолчанию фильм для обратной совместимости
	}

	if mediaType != "movie" && mediaType != "tv" {
		http.Error(w, "Media type must be 'movie' or 'tv'", http.StatusBadRequest)
		return
	}

	// Получаем информацию о медиа на русском языке
	mediaInfo, err := h.fetchMediaInfoRussian(mediaID, mediaType)
	if err != nil {
		http.Error(w, "Failed to fetch media information: "+err.Error(), http.StatusInternalServerError)
		return
	}

	err = h.favoritesService.AddToFavoritesWithInfo(userID, mediaID, mediaType, mediaInfo)
	if err != nil {
		http.Error(w, "Failed to add to favorites: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Message: "Added to favorites successfully",
	})
}

func (h *FavoritesHandler) RemoveFromFavorites(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	mediaID := vars["id"]
	mediaType := r.URL.Query().Get("type")

	if mediaID == "" {
		http.Error(w, "Media ID is required", http.StatusBadRequest)
		return
	}

	if mediaType == "" {
		mediaType = "movie" // По умолчанию фильм для обратной совместимости
	}

	if mediaType != "movie" && mediaType != "tv" {
		http.Error(w, "Media type must be 'movie' or 'tv'", http.StatusBadRequest)
		return
	}

	err := h.favoritesService.RemoveFromFavorites(userID, mediaID, mediaType)
	if err != nil {
		http.Error(w, "Failed to remove from favorites: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Message: "Removed from favorites successfully",
	})
}

func (h *FavoritesHandler) CheckIsFavorite(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	mediaID := vars["id"]
	mediaType := r.URL.Query().Get("type")

	if mediaID == "" {
		http.Error(w, "Media ID is required", http.StatusBadRequest)
		return
	}

	if mediaType == "" {
		mediaType = "movie" // По умолчанию фильм для обратной совместимости
	}

	if mediaType != "movie" && mediaType != "tv" {
		http.Error(w, "Media type must be 'movie' or 'tv'", http.StatusBadRequest)
		return
	}

	isFavorite, err := h.favoritesService.IsFavorite(userID, mediaID, mediaType)
	if err != nil {
		http.Error(w, "Failed to check favorite status: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    map[string]bool{"isFavorite": isFavorite},
	})
}

// fetchMediaInfoRussian получает информацию о медиа на русском языке из TMDB
func (h *FavoritesHandler) fetchMediaInfoRussian(mediaID, mediaType string) (*models.MediaInfo, error) {
	var url string
	if mediaType == "movie" {
		url = fmt.Sprintf("https://api.themoviedb.org/3/movie/%s?api_key=%s&language=ru-RU", mediaID, h.config.TMDBAccessToken)
	} else {
		url = fmt.Sprintf("https://api.themoviedb.org/3/tv/%s?api_key=%s&language=ru-RU", mediaID, h.config.TMDBAccessToken)
	}

    client := &http.Client{Timeout: 6 * time.Second}
    resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from TMDB: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("TMDB API error: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var tmdbResponse map[string]interface{}
	if err := json.Unmarshal(body, &tmdbResponse); err != nil {
		return nil, fmt.Errorf("failed to parse TMDB response: %w", err)
	}

	mediaInfo := &models.MediaInfo{
		ID:        mediaID,
		MediaType: mediaType,
	}

	// Заполняем информацию в зависимости от типа медиа
	if mediaType == "movie" {
		if title, ok := tmdbResponse["title"].(string); ok {
			mediaInfo.Title = title
		}
		if originalTitle, ok := tmdbResponse["original_title"].(string); ok {
			mediaInfo.OriginalTitle = originalTitle
		}
		if releaseDate, ok := tmdbResponse["release_date"].(string); ok {
			mediaInfo.ReleaseDate = releaseDate
		}
	} else {
		if name, ok := tmdbResponse["name"].(string); ok {
			mediaInfo.Title = name
		}
		if originalName, ok := tmdbResponse["original_name"].(string); ok {
			mediaInfo.OriginalTitle = originalName
		}
		if firstAirDate, ok := tmdbResponse["first_air_date"].(string); ok {
			mediaInfo.FirstAirDate = firstAirDate
		}
	}

	// Общие поля
	if overview, ok := tmdbResponse["overview"].(string); ok {
		mediaInfo.Overview = overview
	}
	if posterPath, ok := tmdbResponse["poster_path"].(string); ok {
		mediaInfo.PosterPath = posterPath
	}
	if backdropPath, ok := tmdbResponse["backdrop_path"].(string); ok {
		mediaInfo.BackdropPath = backdropPath
	}
	if voteAverage, ok := tmdbResponse["vote_average"].(float64); ok {
		mediaInfo.VoteAverage = voteAverage
	}
	if voteCount, ok := tmdbResponse["vote_count"].(float64); ok {
		mediaInfo.VoteCount = int(voteCount)
	}
	if popularity, ok := tmdbResponse["popularity"].(float64); ok {
		mediaInfo.Popularity = popularity
	}

	// Жанры
	if genres, ok := tmdbResponse["genres"].([]interface{}); ok {
		for _, genre := range genres {
			if genreMap, ok := genre.(map[string]interface{}); ok {
				if genreID, ok := genreMap["id"].(float64); ok {
					mediaInfo.GenreIDs = append(mediaInfo.GenreIDs, int(genreID))
				}
			}
		}
	}

	return mediaInfo, nil
}
