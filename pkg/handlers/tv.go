package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"neomovies-api/pkg/models"
	"neomovies-api/pkg/services"
)

type TVHandler struct {
	tvService *services.TVService
}

func NewTVHandler(tvService *services.TVService) *TVHandler {
	return &TVHandler{
		tvService: tvService,
	}
}

func (h *TVHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		http.Error(w, "Query parameter is required", http.StatusBadRequest)
		return
	}

	page := getIntQuery(r, "page", 1)
	language := GetLanguage(r)
	year := getIntQuery(r, "first_air_date_year", 0)

	tvShows, err := h.tvService.Search(query, page, language, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    tvShows,
	})
}

func (h *TVHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	rawID := vars["id"]

	// Support formats: "123" (old), "kp_123", "tmdb_123"
	source := ""
	var id int
	if strings.Contains(rawID, "_") {
		parts := strings.SplitN(rawID, "_", 2)
		if len(parts) != 2 {
			http.Error(w, "Invalid ID format", http.StatusBadRequest)
			return
		}
		source = parts[0]
		parsed, err := strconv.Atoi(parts[1])
		if err != nil {
			http.Error(w, "Invalid numeric ID", http.StatusBadRequest)
			return
		}
		id = parsed
	} else {
		// Backward compatibility
		parsed, err := strconv.Atoi(rawID)
		if err != nil {
			http.Error(w, "Invalid TV show ID", http.StatusBadRequest)
			return
		}
		id = parsed
	}

	language := GetLanguage(r)
	idType := r.URL.Query().Get("id_type")
	if source == "kp" || source == "tmdb" {
		idType = source
	}

	tvShow, err := h.tvService.GetByID(id, language, idType)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    tvShow,
	})
}

func (h *TVHandler) Popular(w http.ResponseWriter, r *http.Request) {
	page := getIntQuery(r, "page", 1)
	language := GetLanguage(r)

	tvShows, err := h.tvService.GetPopular(page, language)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    tvShows,
	})
}

func (h *TVHandler) TopRated(w http.ResponseWriter, r *http.Request) {
	page := getIntQuery(r, "page", 1)
	language := GetLanguage(r)

	tvShows, err := h.tvService.GetTopRated(page, language)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    tvShows,
	})
}

func (h *TVHandler) OnTheAir(w http.ResponseWriter, r *http.Request) {
	page := getIntQuery(r, "page", 1)
	language := GetLanguage(r)

	tvShows, err := h.tvService.GetOnTheAir(page, language)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    tvShows,
	})
}

func (h *TVHandler) AiringToday(w http.ResponseWriter, r *http.Request) {
	page := getIntQuery(r, "page", 1)
	language := GetLanguage(r)

	tvShows, err := h.tvService.GetAiringToday(page, language)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    tvShows,
	})
}

func (h *TVHandler) GetRecommendations(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid TV show ID", http.StatusBadRequest)
		return
	}

	page := getIntQuery(r, "page", 1)
	language := GetLanguage(r)

	tvShows, err := h.tvService.GetRecommendations(id, page, language)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    tvShows,
	})
}

func (h *TVHandler) GetSimilar(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid TV show ID", http.StatusBadRequest)
		return
	}

	page := getIntQuery(r, "page", 1)
	language := GetLanguage(r)

	tvShows, err := h.tvService.GetSimilar(id, page, language)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    tvShows,
	})
}

func (h *TVHandler) GetExternalIDs(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid TV show ID", http.StatusBadRequest)
		return
	}

	externalIDs, err := h.tvService.GetExternalIDs(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    externalIDs,
	})
}
