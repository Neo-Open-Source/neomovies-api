package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    "strings"
    "time"

    "neomovies-api/pkg/models"
    "neomovies-api/pkg/services"
)

type UnifiedHandler struct {
    tmdb *services.TMDBService
    kp   *services.KinopoiskService
}

func NewUnifiedHandler(tmdb *services.TMDBService, kp *services.KinopoiskService) *UnifiedHandler {
    return &UnifiedHandler{tmdb: tmdb, kp: kp}
}

// Parse source ID of form "kp_123" or "tmdb_456"
func parseSourceID(raw string) (source string, id int, err error) {
    parts := strings.SplitN(raw, "_", 2)
    if len(parts) != 2 {
        return "", 0, strconv.ErrSyntax
    }
    src := strings.ToLower(parts[0])
    if src != "kp" && src != "tmdb" {
        return "", 0, strconv.ErrSyntax
    }
    num, err := strconv.Atoi(parts[1])
    if err != nil {
        return "", 0, err
    }
    return src, num, nil
}

func (h *UnifiedHandler) GetMovie(w http.ResponseWriter, r *http.Request) {
    start := time.Now()
    vars := muxVars(r)
    rawID := vars["id"]

    source, id, err := parseSourceID(rawID)
    if err != nil {
        writeUnifiedError(w, http.StatusBadRequest, "invalid SOURCE_ID format", start, "")
        return
    }

    language := GetLanguage(r)
    var data *models.UnifiedContent
    if source == "kp" {
        if h.kp == nil {
            writeUnifiedError(w, http.StatusBadGateway, "Kinopoisk service not configured", start, source)
            return
        }
        kpFilm, err := h.kp.GetFilmByKinopoiskId(id)
        if err != nil {
            writeUnifiedError(w, http.StatusBadGateway, err.Error(), start, source)
            return
        }
        data = services.MapKPToUnified(kpFilm)
        // Обогащаем TMDB ID если есть IMDB ID
        if h.tmdb != nil {
            services.EnrichKPWithTMDBID(data, h.tmdb)
        }
    } else {
        // tmdb
        movie, err := h.tmdb.GetMovie(id, language)
        if err != nil {
            writeUnifiedError(w, http.StatusBadGateway, err.Error(), start, source)
            return
        }
        ext, _ := h.tmdb.GetMovieExternalIDs(id)
        data = services.MapTMDBToUnifiedMovie(movie, ext)
    }

    writeUnifiedOK(w, data, start, source, "")
}

func (h *UnifiedHandler) GetTV(w http.ResponseWriter, r *http.Request) {
    start := time.Now()
    vars := muxVars(r)
    rawID := vars["id"]

    source, id, err := parseSourceID(rawID)
    if err != nil {
        writeUnifiedError(w, http.StatusBadRequest, "invalid SOURCE_ID format", start, "")
        return
    }

    language := GetLanguage(r)
    var data *models.UnifiedContent
    if source == "kp" {
        if h.kp == nil {
            writeUnifiedError(w, http.StatusBadGateway, "Kinopoisk service not configured", start, source)
            return
        }
        kpFilm, err := h.kp.GetFilmByKinopoiskId(id)
        if err != nil {
            writeUnifiedError(w, http.StatusBadGateway, err.Error(), start, source)
            return
        }
        data = services.MapKPToUnified(kpFilm)
        // Обогащаем TMDB ID если есть IMDB ID
        if h.tmdb != nil {
            services.EnrichKPWithTMDBID(data, h.tmdb)
        }
    } else {
        tv, err := h.tmdb.GetTVShow(id, language)
        if err != nil {
            writeUnifiedError(w, http.StatusBadGateway, err.Error(), start, source)
            return
        }
        ext, _ := h.tmdb.GetTVExternalIDs(id)
        data = services.MapTMDBTVToUnified(tv, ext)
    }

    writeUnifiedOK(w, data, start, source, "")
}

func (h *UnifiedHandler) Search(w http.ResponseWriter, r *http.Request) {
    start := time.Now()
    query := r.URL.Query().Get("query")
    if strings.TrimSpace(query) == "" {
        writeUnifiedError(w, http.StatusBadRequest, "query is required", start, "")
        return
    }
    source := strings.ToLower(r.URL.Query().Get("source")) // kp|tmdb
    page := getIntQuery(r, "page", 1)
    language := GetLanguage(r)

    if source != "kp" && source != "tmdb" {
        writeUnifiedError(w, http.StatusBadRequest, "source must be 'kp' or 'tmdb'", start, "")
        return
    }

    if source == "kp" {
        if h.kp == nil {
            writeUnifiedError(w, http.StatusBadGateway, "Kinopoisk service not configured", start, source)
            return
        }
        kpSearch, err := h.kp.SearchFilms(query, page)
        if err != nil {
            writeUnifiedError(w, http.StatusBadGateway, err.Error(), start, source)
            return
        }
        items := services.MapKPSearchToUnifiedItems(kpSearch)
        // Обогащаем результаты поиска TMDB ID через получение полной информации о фильмах
        if h.tmdb != nil {
            for i := range items {
                if kpID, err := strconv.Atoi(items[i].ID); err == nil {
                    if kpFilm, err := h.kp.GetFilmByKinopoiskId(kpID); err == nil && kpFilm.ImdbId != "" {
                        items[i].ExternalIDs.IMDb = kpFilm.ImdbId
                        mediaType := "movie"
                        if items[i].Type == "tv" {
                            mediaType = "tv"
                        }
                        if tmdbID, err := h.tmdb.FindTMDBIdByIMDB(kpFilm.ImdbId, mediaType, "ru-RU"); err == nil {
                            items[i].ExternalIDs.TMDB = &tmdbID
                        }
                    }
                }
            }
        }
        resp := models.UnifiedSearchResponse{
            Success: true,
            Data:    items,
            Source:  source,
            Pagination: models.UnifiedPagination{Page: page, TotalPages: kpSearch.PagesCount, TotalResults: kpSearch.SearchFilmsCountResult, PageSize: len(items)},
            Metadata: models.UnifiedMetadata{FetchedAt: time.Now(), APIVersion: "3.0", ResponseTime: time.Since(start).Milliseconds(), Query: query},
        }
        writeJSON(w, http.StatusOK, resp)
        return
    }

    // TMDB multi search
    multi, err := h.tmdb.SearchMulti(query, page, language)
    if err != nil {
        writeUnifiedError(w, http.StatusBadGateway, err.Error(), start, source)
        return
    }
    items := services.MapTMDBMultiToUnifiedItems(multi)
    resp := models.UnifiedSearchResponse{
        Success: true,
        Data:    items,
        Source:  source,
        Pagination: models.UnifiedPagination{Page: multi.Page, TotalPages: multi.TotalPages, TotalResults: multi.TotalResults, PageSize: len(items)},
        Metadata: models.UnifiedMetadata{FetchedAt: time.Now(), APIVersion: "3.0", ResponseTime: time.Since(start).Milliseconds(), Query: query},
    }
    writeJSON(w, http.StatusOK, resp)
}

func writeUnifiedOK(w http.ResponseWriter, data *models.UnifiedContent, start time.Time, source string, query string) {
    resp := models.UnifiedAPIResponse{
        Success: true,
        Data:    data,
        Source:  source,
        Metadata: models.UnifiedMetadata{
            FetchedAt:    time.Now(),
            APIVersion:   "3.0",
            ResponseTime: time.Since(start).Milliseconds(),
            Query:        query,
        },
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(resp)
}

func writeUnifiedError(w http.ResponseWriter, code int, message string, start time.Time, source string) {
    resp := models.UnifiedAPIResponse{
        Success: false,
        Error:   message,
        Source:  source,
        Metadata: models.UnifiedMetadata{
            FetchedAt:    time.Now(),
            APIVersion:   "3.0",
            ResponseTime: time.Since(start).Milliseconds(),
        },
    }
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(resp)
}
