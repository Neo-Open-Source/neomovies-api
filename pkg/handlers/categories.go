package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	"neomovies-api/pkg/models"
	"neomovies-api/pkg/services"
)

type CategoriesHandler struct {
	tmdbService *services.TMDBService
}

func NewCategoriesHandler(tmdbService *services.TMDBService) *CategoriesHandler {
	return &CategoriesHandler{
		tmdbService: tmdbService,
	}
}

type Category struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func (h *CategoriesHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	// Получаем все жанры
	genresResponse, err := h.tmdbService.GetAllGenres()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Преобразуем жанры в категории
	var categories []Category
	for _, genre := range genresResponse.Genres {
		slug := generateSlug(genre.Name)
		categories = append(categories, Category{
			ID:   genre.ID,
			Name: genre.Name,
			Slug: slug,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    categories,
	})
}

func (h *CategoriesHandler) GetMoviesByCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	categoryID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		return
	}

	page := getIntQuery(r, "page", 1)
	language := r.URL.Query().Get("language")
	if language == "" {
		language = "ru-RU"
	}

	// Используем discover API для получения фильмов по жанру
	movies, err := h.tmdbService.DiscoverMoviesByGenre(categoryID, page, language)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    movies,
	})
}

func generateSlug(name string) string {
	// Простая функция для создания slug из названия
	// В реальном проекте стоит использовать более сложную логику
	result := ""
	for _, char := range name {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') {
			result += string(char)
		} else if char == ' ' {
			result += "-"
		}
	}
	return result
}