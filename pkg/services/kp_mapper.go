package services

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"neomovies-api/pkg/models"
)

func MapKPFilmToTMDBMovie(kpFilm *KPFilm) *models.Movie {
	if kpFilm == nil {
		return nil
	}

	releaseDate := ""
	if kpFilm.Year > 0 {
		releaseDate = fmt.Sprintf("%d-01-01", kpFilm.Year)
	}

	genres := make([]models.Genre, 0)
	for _, g := range kpFilm.Genres {
		genres = append(genres, models.Genre{
			ID:   0,
			Name: g.Genre,
		})
	}

	countries := make([]models.ProductionCountry, 0)
	for _, c := range kpFilm.Countries {
		countries = append(countries, models.ProductionCountry{
			ISO31661: "",
			Name:     c.Country,
		})
	}

	posterPath := ""
	if kpFilm.PosterUrlPreview != "" {
		posterPath = kpFilm.PosterUrlPreview
	} else if kpFilm.PosterUrl != "" {
		posterPath = kpFilm.PosterUrl
	}

	backdropPath := ""
	if kpFilm.CoverUrl != "" {
		backdropPath = kpFilm.CoverUrl
	}

	overview := kpFilm.Description
	if overview == "" {
		overview = kpFilm.ShortDescription
	}

	title := kpFilm.NameRu
	if title == "" {
		title = kpFilm.NameEn
	}
	if title == "" {
		title = kpFilm.NameOriginal
	}

	originalTitle := kpFilm.NameOriginal
	if originalTitle == "" {
		originalTitle = kpFilm.NameEn
	}

	return &models.Movie{
		ID:                  kpFilm.KinopoiskId,
		Title:               title,
		OriginalTitle:       originalTitle,
		Overview:            overview,
		PosterPath:          posterPath,
		BackdropPath:        backdropPath,
		ReleaseDate:         releaseDate,
		VoteAverage:         kpFilm.RatingKinopoisk,
		VoteCount:           kpFilm.RatingKinopoiskVoteCount,
		Popularity:          float64(kpFilm.RatingKinopoisk * 100),
		Adult:               false,
		OriginalLanguage:    detectLanguage(kpFilm),
		Runtime:             kpFilm.FilmLength,
		Genres:              genres,
		Tagline:             kpFilm.Slogan,
		ProductionCountries: countries,
		IMDbID:              kpFilm.ImdbId,
		KinopoiskID:         kpFilm.KinopoiskId,
	}
}

func MapKPFilmToTVShow(kpFilm *KPFilm) *models.TVShow {
	if kpFilm == nil {
		return nil
	}

	firstAirDate := ""
	if kpFilm.StartYear > 0 {
		firstAirDate = fmt.Sprintf("%d-01-01", kpFilm.StartYear)
	}

	lastAirDate := ""
	if kpFilm.EndYear > 0 {
		lastAirDate = fmt.Sprintf("%d-01-01", kpFilm.EndYear)
	}

	genres := make([]models.Genre, 0)
	for _, g := range kpFilm.Genres {
		genres = append(genres, models.Genre{
			ID:   0,
			Name: g.Genre,
		})
	}

	posterPath := ""
	if kpFilm.PosterUrlPreview != "" {
		posterPath = kpFilm.PosterUrlPreview
	} else if kpFilm.PosterUrl != "" {
		posterPath = kpFilm.PosterUrl
	}

	backdropPath := ""
	if kpFilm.CoverUrl != "" {
		backdropPath = kpFilm.CoverUrl
	}

	overview := kpFilm.Description
	if overview == "" {
		overview = kpFilm.ShortDescription
	}

	name := kpFilm.NameRu
	if name == "" {
		name = kpFilm.NameEn
	}
	if name == "" {
		name = kpFilm.NameOriginal
	}

	originalName := kpFilm.NameOriginal
	if originalName == "" {
		originalName = kpFilm.NameEn
	}

	status := "Ended"
	if kpFilm.Completed {
		status = "Ended"
	} else {
		status = "Returning Series"
	}

	return &models.TVShow{
		ID:               kpFilm.KinopoiskId,
		Name:             name,
		OriginalName:     originalName,
		Overview:         overview,
		PosterPath:       posterPath,
		BackdropPath:     backdropPath,
		FirstAirDate:     firstAirDate,
		LastAirDate:      lastAirDate,
		VoteAverage:      kpFilm.RatingKinopoisk,
		VoteCount:        kpFilm.RatingKinopoiskVoteCount,
		Popularity:       float64(kpFilm.RatingKinopoisk * 100),
		OriginalLanguage: detectLanguage(kpFilm),
		Genres:           genres,
		Status:           status,
		InProduction:     !kpFilm.Completed,
		KinopoiskID:      kpFilm.KinopoiskId,
	}
}

// Unified mappers with prefixed IDs
func MapKPToUnified(kpFilm *KPFilm) *models.UnifiedContent {
	if kpFilm == nil {
		return nil
	}

	releaseDate := FormatKPDate(kpFilm.Year)
	endDate := (*string)(nil)
	if kpFilm.EndYear > 0 {
		v := FormatKPDate(kpFilm.EndYear)
		endDate = &v
	}

	genres := make([]models.UnifiedGenre, 0)
	for _, g := range kpFilm.Genres {
		genres = append(genres, models.UnifiedGenre{ID: strings.ToLower(g.Genre), Name: g.Genre})
	}

	poster := kpFilm.PosterUrlPreview
	if poster == "" {
		poster = kpFilm.PosterUrl
	}

	country := ""
	if len(kpFilm.Countries) > 0 {
		country = kpFilm.Countries[0].Country
	}

	title := kpFilm.NameRu
	if title == "" {
		title = kpFilm.NameEn
	}
	originalTitle := kpFilm.NameOriginal
	if originalTitle == "" {
		originalTitle = kpFilm.NameEn
	}

	var budgetPtr *int64
	var revenuePtr *int64

	external := models.UnifiedExternalIDs{KP: &kpFilm.KinopoiskId, TMDB: nil, IMDb: kpFilm.ImdbId}

	return &models.UnifiedContent{
		ID:            strconv.Itoa(kpFilm.KinopoiskId),
		SourceID:      "kp_" + strconv.Itoa(kpFilm.KinopoiskId),
		Title:         title,
		OriginalTitle: originalTitle,
		Description:   firstNonEmpty(kpFilm.Description, kpFilm.ShortDescription),
		ReleaseDate:   releaseDate,
		EndDate:       endDate,
		Type:          mapKPTypeToUnified(kpFilm),
		Genres:        genres,
		Rating:        kpFilm.RatingKinopoisk,
		PosterURL:     BuildAPIImageProxyURL(poster, "w300"),
		BackdropURL:   BuildAPIImageProxyURL(kpFilm.CoverUrl, "w1280"),
		Director:      "",
		Cast:          []models.UnifiedCastMember{},
		Duration:      kpFilm.FilmLength,
		Country:       country,
		Language:      detectLanguage(kpFilm),
		Budget:        budgetPtr,
		Revenue:       revenuePtr,
		IMDbID:        kpFilm.ImdbId,
		ExternalIDs:   external,
	}
}

func mapKPTypeToUnified(kp *KPFilm) string {
	if kp.Serial || kp.Type == "TV_SERIES" || kp.Type == "MINI_SERIES" {
		return "tv"
	}
	return "movie"
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func MapKPSearchToTMDBResponse(kpSearch *KPSearchResponse) *models.TMDBResponse {
	if kpSearch == nil {
		return &models.TMDBResponse{
			Page:         1,
			Results:      []models.Movie{},
			TotalPages:   0,
			TotalResults: 0,
		}
	}

	results := make([]models.Movie, 0)
	for _, film := range kpSearch.Films {
		movie := mapKPFilmShortToMovie(film)
		if movie != nil {
			results = append(results, *movie)
		}
	}

	totalPages := kpSearch.PagesCount
	if totalPages == 0 && len(results) > 0 {
		totalPages = 1
	}

	return &models.TMDBResponse{
		Page:         1,
		Results:      results,
		TotalPages:   totalPages,
		TotalResults: kpSearch.SearchFilmsCountResult,
	}
}

func MapKPSearchToTMDBTVResponse(kpSearch *KPSearchResponse) *models.TMDBTVResponse {
	if kpSearch == nil {
		return &models.TMDBTVResponse{
			Page:         1,
			Results:      []models.TVShow{},
			TotalPages:   0,
			TotalResults: 0,
		}
	}

	results := make([]models.TVShow, 0)
	for _, film := range kpSearch.Films {
		tvShow := mapKPFilmShortToTVShow(film)
		if tvShow != nil {
			results = append(results, *tvShow)
		}
	}

	totalPages := kpSearch.PagesCount
	if totalPages == 0 && len(results) > 0 {
		totalPages = 1
	}

	return &models.TMDBTVResponse{
		Page:         1,
		Results:      results,
		TotalPages:   totalPages,
		TotalResults: kpSearch.SearchFilmsCountResult,
	}
}

func mapKPFilmShortToMovie(film KPFilmShort) *models.Movie {
	genres := make([]models.Genre, 0)
	for _, g := range film.Genres {
		genres = append(genres, models.Genre{
			ID:   0,
			Name: g.Genre,
		})
	}

	// Year is a string, convert to int
	year := 0
	if film.Year != "" {
		if parsedYear, err := strconv.Atoi(film.Year); err == nil {
			year = parsedYear
		}
	}

	releaseDate := ""
	if year > 0 {
		releaseDate = fmt.Sprintf("%d-01-01", year)
	}

	// Приоритет: PosterUrlPreview > PosterUrl
	posterPath := film.PosterUrlPreview
	if posterPath == "" {
		posterPath = film.PosterUrl
	}

	// Backdrop path from coverUrl
	backdropPath := film.CoverUrl

	title := film.NameRu
	if title == "" {
		title = film.NameEn
	}
	if title == "" {
		title = film.NameOriginal
	}

	originalTitle := film.NameOriginal
	if originalTitle == "" {
		originalTitle = film.NameEn
	}
	if originalTitle == "" {
		originalTitle = film.NameRu
	}

	// Use new format rating if available, otherwise fall back to old format
	rating := film.RatingKinopoisk
	if rating == 0 && film.Rating != "" {
		rating, _ = strconv.ParseFloat(film.Rating, 64)
	}

	// Get ID - prefer KinopoiskId (new format) over FilmId (old format)
	id := film.KinopoiskId
	if id == 0 {
		id = film.FilmId
	}

	return &models.Movie{
		ID:            id,
		Title:         title,
		OriginalTitle: originalTitle,
		Overview:      film.Description,
		PosterPath:    posterPath,
		BackdropPath:  backdropPath,
		ReleaseDate:   releaseDate,
		VoteAverage:   rating,
		VoteCount:     film.RatingVoteCount,
		Popularity:    rating * 100,
		Genres:        genres,
		KinopoiskID:   id,
		IMDbID:        film.ImdbId,
	}
}

func mapKPFilmShortToTVShow(film KPFilmShort) *models.TVShow {
	genres := make([]models.Genre, 0)
	for _, g := range film.Genres {
		genres = append(genres, models.Genre{
			ID:   0,
			Name: g.Genre,
		})
	}

	// Year is a string, convert to int
	year := 0
	if film.Year != "" {
		if parsedYear, err := strconv.Atoi(film.Year); err == nil {
			year = parsedYear
		}
	}
	releaseDate := ""
	if year > 0 {
		releaseDate = fmt.Sprintf("%d-01-01", year)
	}

	posterPath := film.PosterUrlPreview
	if posterPath == "" {
		posterPath = film.PosterUrl
	}

	title := film.NameRu
	if title == "" {
		title = film.NameEn
	}
	if title == "" {
		title = film.NameOriginal
	}

	originalTitle := film.NameOriginal
	if originalTitle == "" {
		originalTitle = film.NameEn
	}
	if originalTitle == "" {
		originalTitle = film.NameRu
	}

	rating := film.RatingKinopoisk
	if rating == 0 && film.Rating != "" {
		rating, _ = strconv.ParseFloat(film.Rating, 64)
	}

	id := film.KinopoiskId
	if id == 0 {
		id = film.FilmId
	}

	return &models.TVShow{
		ID:           id,
		Name:         title,
		OriginalName: originalTitle,
		Overview:     film.Description,
		PosterPath:   posterPath,
		FirstAirDate: releaseDate,
		VoteAverage:  rating,
		VoteCount:    film.RatingVoteCount,
		Popularity:   rating * 100,
		Genres:       genres,
		KinopoiskID:  id,
		IMDbID:       film.ImdbId,
	}
}

func detectLanguage(film *KPFilm) string {
	if film.NameRu != "" {
		return "ru"
	}
	if film.NameEn != "" {
		return "en"
	}
	return "ru"
}

func MapKPExternalIDsToTMDB(kpFilm *KPFilm) *models.ExternalIDs {
	if kpFilm == nil {
		return &models.ExternalIDs{}
	}

	return &models.ExternalIDs{
		ID:          kpFilm.KinopoiskId,
		IMDbID:      kpFilm.ImdbId,
		KinopoiskID: kpFilm.KinopoiskId,
	}
}

func ShouldUseKinopoisk(language string) bool {
	if language == "" {
		return false
	}
	lang := strings.ToLower(language)
	return strings.HasPrefix(lang, "ru")
}

func NormalizeLanguage(language string) string {
	if language == "" {
		return "en-US"
	}

	lang := strings.ToLower(language)
	if strings.HasPrefix(lang, "ru") {
		return "ru-RU"
	}

	return "en-US"
}

func ConvertKPRatingToTMDB(kpRating float64) float64 {
	return kpRating
}

func FormatKPDate(year int) string {
	if year <= 0 {
		return time.Now().Format("2006-01-02")
	}
	return fmt.Sprintf("%d-01-01", year)
}

// EnrichKPWithTMDBID обогащает KP контент TMDB ID через IMDB ID
func EnrichKPWithTMDBID(content *models.UnifiedContent, tmdbService *TMDBService) {
	if content == nil || content.IMDbID == "" || content.ExternalIDs.TMDB != nil {
		return
	}

	mediaType := "movie"
	if content.Type == "tv" {
		mediaType = "tv"
	}

	if tmdbID, err := tmdbService.FindTMDBIdByIMDB(content.IMDbID, mediaType, "ru-RU"); err == nil {
		content.ExternalIDs.TMDB = &tmdbID
	}
}

// EnrichKPSearchItemsWithTMDBID обогащает массив поисковых элементов TMDB ID
func EnrichKPSearchItemsWithTMDBID(items []models.UnifiedSearchItem, tmdbService *TMDBService) {
	for i := range items {
		if items[i].ExternalIDs.IMDb == "" || items[i].ExternalIDs.TMDB != nil {
			continue
		}

		mediaType := "movie"
		if items[i].Type == "tv" {
			mediaType = "tv"
		}

		if tmdbID, err := tmdbService.FindTMDBIdByIMDB(items[i].ExternalIDs.IMDb, mediaType, "ru-RU"); err == nil {
			items[i].ExternalIDs.TMDB = &tmdbID
		}
	}
}
