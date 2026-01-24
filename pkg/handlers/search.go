package handlers

import (
	"encoding/json"
	"net/http"

	"neomovies-api/pkg/models"
	"neomovies-api/pkg/services"
)

type SearchHandler struct {
	tmdbService *services.TMDBService
	kpService   *services.KinopoiskService
}

func NewSearchHandler(tmdbService *services.TMDBService, kpService *services.KinopoiskService) *SearchHandler {
	return &SearchHandler{
		tmdbService: tmdbService,
		kpService:   kpService,
	}
}

func (h *SearchHandler) MultiSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		http.Error(w, "Query parameter is required", http.StatusBadRequest)
		return
	}

	page := getIntQuery(r, "page", 1)
	language := GetLanguage(r)

	if services.ShouldUseKinopoisk(language) {
		if h.kpService == nil {
			http.Error(w, "Kinopoisk service is not configured", http.StatusBadGateway)
			return
		}

		kpSearch, err := h.kpService.SearchFilms(query, page)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}

		tmdbResp := services.MapKPSearchToTMDBResponse(kpSearch)
		multiResults := make([]models.MultiSearchResult, 0)
		for _, movie := range tmdbResp.Results {
			multiResults = append(multiResults, models.MultiSearchResult{
				ID:               movie.ID,
				MediaType:        "movie",
				Title:            movie.Title,
				OriginalTitle:    movie.OriginalTitle,
				Overview:         movie.Overview,
				PosterPath:       movie.PosterPath,
				BackdropPath:     movie.BackdropPath,
				ReleaseDate:      movie.ReleaseDate,
				VoteAverage:      movie.VoteAverage,
				VoteCount:        movie.VoteCount,
				Popularity:       movie.Popularity,
				Adult:            movie.Adult,
				OriginalLanguage: movie.OriginalLanguage,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(models.APIResponse{
			Success: true,
			Data: models.MultiSearchResponse{
				Page:         page,
				Results:      multiResults,
				TotalPages:   tmdbResp.TotalPages,
				TotalResults: tmdbResp.TotalResults,
			},
		})
		return
	}

	// EN/прочие языки — TMDB
	if h.tmdbService == nil {
		http.Error(w, "TMDB disabled", http.StatusNotImplemented)
		return
	}
	results, err := h.tmdbService.SearchMulti(query, page, language)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    results,
	})
}
