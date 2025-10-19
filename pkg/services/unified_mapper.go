package services

import (
    "fmt"
    "net/url"
    "strconv"
    "strings"

    "neomovies-api/pkg/models"
)

const tmdbImageBase = "https://image.tmdb.org/t/p"

// BuildAPIImageProxyURL строит относительный URL до нашего прокси-эндпоинта изображений.
// Если передан абсолютный URL (KP и пр.) — он кодируется и передаётся как path параметр.
// Если передан относительный TMDB-путь, он используется как есть (без ведущего '/').
func BuildAPIImageProxyURL(pathOrURL string, size string) string {
    if strings.TrimSpace(pathOrURL) == "" {
        return ""
    }
    if size == "" {
        size = "w500"
    }
    // Абсолютные ссылки (Kinopoisk и пр.) — кодируем целиком
    if strings.HasPrefix(pathOrURL, "http://") || strings.HasPrefix(pathOrURL, "https://") {
        return fmt.Sprintf("/api/v1/images/%s/%s", size, url.QueryEscape(pathOrURL))
    }
    // TMDB относительный путь
    clean := pathOrURL
    if strings.HasPrefix(clean, "/") {
        clean = clean[1:]
    }
    return fmt.Sprintf("/api/v1/images/%s/%s", size, clean)
}

func MapTMDBToUnifiedMovie(movie *models.Movie, external *models.ExternalIDs) *models.UnifiedContent {
    if movie == nil {
        return nil
    }

    genres := make([]models.UnifiedGenre, 0, len(movie.Genres))
    for _, g := range movie.Genres {
        name := strings.TrimSpace(g.Name)
        id := strings.ToLower(strings.ReplaceAll(name, " ", "-"))
        if id == "" {
            id = strconv.Itoa(g.ID)
        }
        genres = append(genres, models.UnifiedGenre{ID: id, Name: name})
    }

    var imdb string
    if external != nil {
        imdb = external.IMDbID
    }

    var budgetPtr *int64
    if movie.Budget > 0 {
        v := movie.Budget
        budgetPtr = &v
    }
    var revenuePtr *int64
    if movie.Revenue > 0 {
        v := movie.Revenue
        revenuePtr = &v
    }

    ext := models.UnifiedExternalIDs{
        KP:   nil,
        TMDB: &movie.ID,
        IMDb: imdb,
    }

    return &models.UnifiedContent{
        ID:            strconv.Itoa(movie.ID),
        SourceID:      "tmdb_" + strconv.Itoa(movie.ID),
        Title:         movie.Title,
        OriginalTitle: movie.OriginalTitle,
        Description:   movie.Overview,
        ReleaseDate:   movie.ReleaseDate,
        EndDate:       nil,
        Type:          "movie",
        Genres:        genres,
        Rating:        movie.VoteAverage,
        PosterURL:     BuildAPIImageProxyURL(movie.PosterPath, "w500"),
        BackdropURL:   BuildAPIImageProxyURL(movie.BackdropPath, "w1280"),
        Director:      "",
        Cast:          []models.UnifiedCastMember{},
        Duration:      movie.Runtime,
        Country:       firstCountry(movie.ProductionCountries),
        Language:      movie.OriginalLanguage,
        Budget:        budgetPtr,
        Revenue:       revenuePtr,
        IMDbID:        imdb,
        ExternalIDs:   ext,
    }
}

func MapTMDBTVToUnified(tv *models.TVShow, external *models.ExternalIDs) *models.UnifiedContent {
    if tv == nil {
        return nil
    }

    genres := make([]models.UnifiedGenre, 0, len(tv.Genres))
    for _, g := range tv.Genres {
        name := strings.TrimSpace(g.Name)
        id := strings.ToLower(strings.ReplaceAll(name, " ", "-"))
        if id == "" {
            id = strconv.Itoa(g.ID)
        }
        genres = append(genres, models.UnifiedGenre{ID: id, Name: name})
    }

    var imdb string
    if external != nil {
        imdb = external.IMDbID
    }

    endDate := (*string)(nil)
    if strings.TrimSpace(tv.LastAirDate) != "" {
        v := tv.LastAirDate
        endDate = &v
    }

    ext := models.UnifiedExternalIDs{
        KP:   nil,
        TMDB: &tv.ID,
        IMDb: imdb,
    }

    duration := 0
    if len(tv.EpisodeRunTime) > 0 {
        duration = tv.EpisodeRunTime[0]
    }

    unified := &models.UnifiedContent{
        ID:            strconv.Itoa(tv.ID),
        SourceID:      "tmdb_" + strconv.Itoa(tv.ID),
        Title:         tv.Name,
        OriginalTitle: tv.OriginalName,
        Description:   tv.Overview,
        ReleaseDate:   tv.FirstAirDate,
        EndDate:       endDate,
        Type:          "tv",
        Genres:        genres,
        Rating:        tv.VoteAverage,
        PosterURL:     BuildAPIImageProxyURL(tv.PosterPath, "w500"),
        BackdropURL:   BuildAPIImageProxyURL(tv.BackdropPath, "w1280"),
        Director:      "",
        Cast:          []models.UnifiedCastMember{},
        Duration:      duration,
        Country:       firstCountry(tv.ProductionCountries),
        Language:      tv.OriginalLanguage,
        Budget:        nil,
        Revenue:       nil,
        IMDbID:        imdb,
        ExternalIDs:   ext,
    }

    // Map seasons basic info
    if len(tv.Seasons) > 0 {
        unified.Seasons = make([]models.UnifiedSeason, 0, len(tv.Seasons))
        for _, s := range tv.Seasons {
            unified.Seasons = append(unified.Seasons, models.UnifiedSeason{
                ID:           strconv.Itoa(s.ID),
                SourceID:     "tmdb_" + strconv.Itoa(s.ID),
                Name:         s.Name,
                SeasonNumber: s.SeasonNumber,
                EpisodeCount: s.EpisodeCount,
                ReleaseDate:  s.AirDate,
                PosterURL:    BuildAPIImageProxyURL(s.PosterPath, "w500"),
            })
        }
    }

    return unified
}

func MapTMDBMultiToUnifiedItems(m *models.MultiSearchResponse) []models.UnifiedSearchItem {
    if m == nil {
        return []models.UnifiedSearchItem{}
    }
    items := make([]models.UnifiedSearchItem, 0, len(m.Results))
    for _, r := range m.Results {
        if r.MediaType != "movie" && r.MediaType != "tv" {
            continue
        }
        title := r.Title
        if r.MediaType == "tv" {
            title = r.Name
        }
        release := r.ReleaseDate
        if r.MediaType == "tv" {
            release = r.FirstAirDate
        }
        poster := BuildAPIImageProxyURL(r.PosterPath, "w500")
        tmdbId := r.ID
        items = append(items, models.UnifiedSearchItem{
            ID:          strconv.Itoa(tmdbId),
            SourceID:    "tmdb_" + strconv.Itoa(tmdbId),
            Title:       title,
            Type:        map[string]string{"movie":"movie","tv":"tv"}[r.MediaType],
            ReleaseDate: release,
            PosterURL:   poster,
            Rating:      r.VoteAverage,
            Description: r.Overview,
            ExternalIDs: models.UnifiedExternalIDs{KP: nil, TMDB: &tmdbId, IMDb: ""},
        })
    }
    return items
}

func MapKPSearchToUnifiedItems(kps *KPSearchResponse) []models.UnifiedSearchItem {
    if kps == nil {
        return []models.UnifiedSearchItem{}
    }
    items := make([]models.UnifiedSearchItem, 0, len(kps.Films))
    for _, f := range kps.Films {
        title := f.NameRu
        if strings.TrimSpace(title) == "" {
            title = f.NameEn
        }
        poster := f.PosterUrlPreview
        if poster == "" {
            poster = f.PosterUrl
        }
        poster = BuildAPIImageProxyURL(poster, "w500")
        rating := 0.0
        if strings.TrimSpace(f.Rating) != "" {
            if v, err := strconv.ParseFloat(f.Rating, 64); err == nil {
                rating = v
            }
        }
        kpId := f.FilmId
        items = append(items, models.UnifiedSearchItem{
            ID:          strconv.Itoa(kpId),
            SourceID:    "kp_" + strconv.Itoa(kpId),
            Title:       title,
            Type:        mapKPTypeToUnifiedShort(f.Type),
            ReleaseDate: yearToDate(f.Year),
            PosterURL:   poster,
            Rating:      rating,
            Description: f.Description,
            ExternalIDs: models.UnifiedExternalIDs{KP: &kpId, TMDB: nil, IMDb: ""},
        })
    }
    return items
}

func mapKPTypeToUnifiedShort(t string) string {
    switch strings.ToUpper(strings.TrimSpace(t)) {
    case "TV_SERIES", "MINI_SERIES":
        return "tv"
    default:
        return "movie"
    }
}

func yearToDate(y string) string {
    y = strings.TrimSpace(y)
    if y == "" {
        return ""
    }
    return y + "-01-01"
}

func firstCountry(countries []models.ProductionCountry) string {
    if len(countries) == 0 {
        return ""
    }
    if strings.TrimSpace(countries[0].Name) != "" {
        return countries[0].Name
    }
    return countries[0].ISO31661
}
