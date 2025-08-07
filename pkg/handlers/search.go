package handlers

import (
	"encoding/json"
	"net/http"

	"neomovies-api/pkg/models"
	"neomovies-api/pkg/services"
)

type SearchHandler struct {
	tmdbService *services.TMDBService
}

func NewSearchHandler(tmdbService *services.TMDBService) *SearchHandler {
	return &SearchHandler{
		tmdbService: tmdbService,
	}
}

func (h *SearchHandler) MultiSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		http.Error(w, "Query parameter is required", http.StatusBadRequest)
		return
	}

	page := getIntQuery(r, "page", 1)
	language := r.URL.Query().Get("language")
	if language == "" {
		language = "ru-RU"
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