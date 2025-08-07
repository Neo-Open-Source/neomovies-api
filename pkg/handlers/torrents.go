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

type TorrentsHandler struct {
	torrentService *services.TorrentService
	tmdbService    *services.TMDBService
}

func NewTorrentsHandler(torrentService *services.TorrentService, tmdbService *services.TMDBService) *TorrentsHandler {
	return &TorrentsHandler{
		torrentService: torrentService,
		tmdbService:    tmdbService,
	}
}

// SearchTorrents - поиск торрентов по IMDB ID
func (h *TorrentsHandler) SearchTorrents(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	imdbID := vars["imdbId"]

	if imdbID == "" {
		http.Error(w, "IMDB ID is required", http.StatusBadRequest)
		return
	}

	// Параметры запроса
	mediaType := r.URL.Query().Get("type")
	if mediaType == "" {
		mediaType = "movie"
	}

	// Создаем опции поиска
	options := &models.TorrentSearchOptions{
		ContentType: mediaType,
	}

	// Качество
	if quality := r.URL.Query().Get("quality"); quality != "" {
		options.Quality = strings.Split(quality, ",")
	}

	// Минимальное и максимальное качество
	options.MinQuality = r.URL.Query().Get("minQuality")
	options.MaxQuality = r.URL.Query().Get("maxQuality")

	// Исключаемые качества
	if excludeQualities := r.URL.Query().Get("excludeQualities"); excludeQualities != "" {
		options.ExcludeQualities = strings.Split(excludeQualities, ",")
	}

	// HDR
	if hdr := r.URL.Query().Get("hdr"); hdr != "" {
		if hdrBool, err := strconv.ParseBool(hdr); err == nil {
			options.HDR = &hdrBool
		}
	}

	// HEVC
	if hevc := r.URL.Query().Get("hevc"); hevc != "" {
		if hevcBool, err := strconv.ParseBool(hevc); err == nil {
			options.HEVC = &hevcBool
		}
	}

	// Сортировка
	options.SortBy = r.URL.Query().Get("sortBy")
	if options.SortBy == "" {
		options.SortBy = "seeders"
	}

	options.SortOrder = r.URL.Query().Get("sortOrder")
	if options.SortOrder == "" {
		options.SortOrder = "desc"
	}

	// Группировка
	if groupByQuality := r.URL.Query().Get("groupByQuality"); groupByQuality == "true" {
		options.GroupByQuality = true
	}

	if groupBySeason := r.URL.Query().Get("groupBySeason"); groupBySeason == "true" {
		options.GroupBySeason = true
	}

	// Сезон для сериалов
	if season := r.URL.Query().Get("season"); season != "" {
		if seasonInt, err := strconv.Atoi(season); err == nil {
			options.Season = &seasonInt
		}
	}

	// Поиск торрентов
	results, err := h.torrentService.SearchTorrentsByIMDbID(h.tmdbService, imdbID, mediaType, options)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Формируем ответ с группировкой если необходимо
	response := map[string]interface{}{
		"imdbId": imdbID,
		"type":   mediaType,
		"total":  results.Total,
	}

	if options.Season != nil {
		response["season"] = *options.Season
	}

	// Применяем группировку если запрошена
	if options.GroupByQuality && options.GroupBySeason {
		// Группируем сначала по сезонам, затем по качеству внутри каждого сезона
		seasonGroups := h.torrentService.GroupBySeason(results.Results)
		finalGroups := make(map[string]map[string][]models.TorrentResult)
		
		for season, torrents := range seasonGroups {
			qualityGroups := h.torrentService.GroupByQuality(torrents)
			finalGroups[season] = qualityGroups
		}
		
		response["grouped"] = true
		response["groups"] = finalGroups
	} else if options.GroupByQuality {
		groups := h.torrentService.GroupByQuality(results.Results)
		response["grouped"] = true
		response["groups"] = groups
	} else if options.GroupBySeason {
		groups := h.torrentService.GroupBySeason(results.Results)
		response["grouped"] = true
		response["groups"] = groups
	} else {
		response["grouped"] = false
		response["results"] = results.Results
	}

	if len(results.Results) == 0 {
		response["error"] = "No torrents found for this IMDB ID"
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(response)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// SearchMovies - поиск фильмов по названию
func (h *TorrentsHandler) SearchMovies(w http.ResponseWriter, r *http.Request) {
	title := r.URL.Query().Get("title")
	originalTitle := r.URL.Query().Get("originalTitle")
	year := r.URL.Query().Get("year")

	if title == "" && originalTitle == "" {
		http.Error(w, "Title or original title is required", http.StatusBadRequest)
		return
	}

	results, err := h.torrentService.SearchMovies(title, originalTitle, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"title":         title,
		"originalTitle": originalTitle,
		"year":          year,
		"type":          "movie",
		"total":         results.Total,
		"results":       results.Results,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// SearchSeries - поиск сериалов по названию с поддержкой сезонов
func (h *TorrentsHandler) SearchSeries(w http.ResponseWriter, r *http.Request) {
	title := r.URL.Query().Get("title")
	originalTitle := r.URL.Query().Get("originalTitle")
	year := r.URL.Query().Get("year")

	if title == "" && originalTitle == "" {
		http.Error(w, "Title or original title is required", http.StatusBadRequest)
		return
	}

	var season *int
	if seasonStr := r.URL.Query().Get("season"); seasonStr != "" {
		if seasonInt, err := strconv.Atoi(seasonStr); err == nil {
			season = &seasonInt
		}
	}

	results, err := h.torrentService.SearchSeries(title, originalTitle, year, season)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"title":         title,
		"originalTitle": originalTitle,
		"year":          year,
		"type":          "series",
		"total":         results.Total,
		"results":       results.Results,
	}

	if season != nil {
		response["season"] = *season
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// SearchAnime - поиск аниме по названию
func (h *TorrentsHandler) SearchAnime(w http.ResponseWriter, r *http.Request) {
	title := r.URL.Query().Get("title")
	originalTitle := r.URL.Query().Get("originalTitle")
	year := r.URL.Query().Get("year")

	if title == "" && originalTitle == "" {
		http.Error(w, "Title or original title is required", http.StatusBadRequest)
		return
	}

	results, err := h.torrentService.SearchAnime(title, originalTitle, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"title":         title,
		"originalTitle": originalTitle,
		"year":          year,
		"type":          "anime",
		"total":         results.Total,
		"results":       results.Results,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// GetAvailableSeasons - получение доступных сезонов для сериала
func (h *TorrentsHandler) GetAvailableSeasons(w http.ResponseWriter, r *http.Request) {
	title := r.URL.Query().Get("title")
	originalTitle := r.URL.Query().Get("originalTitle")
	year := r.URL.Query().Get("year")

	if title == "" && originalTitle == "" {
		http.Error(w, "Title or original title is required", http.StatusBadRequest)
		return
	}

	seasons, err := h.torrentService.GetAvailableSeasons(title, originalTitle, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"title":         title,
		"originalTitle": originalTitle,
		"year":          year,
		"seasons":       seasons,
		"total":         len(seasons),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// SearchByQuery - универсальный поиск торрентов
func (h *TorrentsHandler) SearchByQuery(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		http.Error(w, "Query is required", http.StatusBadRequest)
		return
	}

	contentType := r.URL.Query().Get("type")
	if contentType == "" {
		contentType = "movie"
	}

	year := r.URL.Query().Get("year")

	// Формируем параметры поиска
	params := map[string]string{
		"query": query,
	}

	if year != "" {
		params["year"] = year
	}

	// Устанавливаем тип контента и категорию
	switch contentType {
	case "movie":
		params["is_serial"] = "1"
		params["category"] = "2000"
	case "series", "tv":
		params["is_serial"] = "2"
		params["category"] = "5000"
	case "anime":
		params["is_serial"] = "5"
		params["category"] = "5070"
	}

	results, err := h.torrentService.SearchTorrents(params)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Применяем фильтрацию по типу контента
	options := &models.TorrentSearchOptions{
		ContentType: contentType,
	}
	results.Results = h.torrentService.FilterByContentType(results.Results, options.ContentType)
	results.Total = len(results.Results)

	response := map[string]interface{}{
		"query":   query,
		"type":    contentType,
		"year":    year,
		"total":   results.Total,
		"results": results.Results,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    response,
	})
}