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
		ID:              kpFilm.KinopoiskId,
		Title:           title,
		OriginalTitle:   originalTitle,
		Overview:        overview,
		PosterPath:      posterPath,
		BackdropPath:    backdropPath,
		ReleaseDate:     releaseDate,
		VoteAverage:     kpFilm.RatingKinopoisk,
		VoteCount:       kpFilm.RatingKinopoiskVoteCount,
		Popularity:      float64(kpFilm.RatingKinopoisk * 100),
		Adult:           false,
		OriginalLanguage: detectLanguage(kpFilm),
		Runtime:         kpFilm.FilmLength,
		Genres:          genres,
		Tagline:         kpFilm.Slogan,
		ProductionCountries: countries,
		IMDbID:          kpFilm.ImdbId,
		KinopoiskID:     kpFilm.KinopoiskId,
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
		ID:              kpFilm.KinopoiskId,
		Name:            name,
		OriginalName:    originalName,
		Overview:        overview,
		PosterPath:      posterPath,
		BackdropPath:    backdropPath,
		FirstAirDate:    firstAirDate,
		LastAirDate:     lastAirDate,
		VoteAverage:     kpFilm.RatingKinopoisk,
		VoteCount:       kpFilm.RatingKinopoiskVoteCount,
		Popularity:      float64(kpFilm.RatingKinopoisk * 100),
		OriginalLanguage: detectLanguage(kpFilm),
		Genres:          genres,
		Status:          status,
		InProduction:    !kpFilm.Completed,
		KinopoiskID:     kpFilm.KinopoiskId,
	}
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

func mapKPFilmShortToMovie(film KPFilmShort) *models.Movie {
	genres := make([]models.Genre, 0)
	for _, g := range film.Genres {
		genres = append(genres, models.Genre{
			ID:   0,
			Name: g.Genre,
		})
	}

	year := 0
	if film.Year != "" {
		year, _ = strconv.Atoi(film.Year)
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

	originalTitle := film.NameEn
	if originalTitle == "" {
		originalTitle = film.NameRu
	}

	rating := 0.0
	if film.Rating != "" {
		rating, _ = strconv.ParseFloat(film.Rating, 64)
	}

	return &models.Movie{
		ID:               film.FilmId,
		Title:            title,
		OriginalTitle:    originalTitle,
		Overview:         film.Description,
		PosterPath:       posterPath,
		ReleaseDate:      releaseDate,
		VoteAverage:      rating,
		VoteCount:        film.RatingVoteCount,
		Popularity:       rating * 100,
		Genres:           genres,
		KinopoiskID:      film.FilmId,
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
