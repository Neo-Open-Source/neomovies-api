package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type KinopoiskService struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

type KPFilm struct {
	KinopoiskId        int      `json:"kinopoiskId"`
	ImdbId             string   `json:"imdbId"`
	NameRu             string   `json:"nameRu"`
	NameEn             string   `json:"nameEn"`
	NameOriginal       string   `json:"nameOriginal"`
	PosterUrl          string   `json:"posterUrl"`
	PosterUrlPreview   string   `json:"posterUrlPreview"`
	CoverUrl           string   `json:"coverUrl"`
	LogoUrl            string   `json:"logoUrl"`
	ReviewsCount       int      `json:"reviewsCount"`
	RatingGoodReview   float64  `json:"ratingGoodReview"`
	RatingGoodReviewVoteCount int `json:"ratingGoodReviewVoteCount"`
	RatingKinopoisk    float64  `json:"ratingKinopoisk"`
	RatingKinopoiskVoteCount int `json:"ratingKinopoiskVoteCount"`
	RatingImdb         float64  `json:"ratingImdb"`
	RatingImdbVoteCount int     `json:"ratingImdbVoteCount"`
	RatingFilmCritics  float64  `json:"ratingFilmCritics"`
	RatingFilmCriticsVoteCount int `json:"ratingFilmCriticsVoteCount"`
	RatingAwait        float64  `json:"ratingAwait"`
	RatingAwaitCount   int      `json:"ratingAwaitCount"`
	RatingRfCritics    float64  `json:"ratingRfCritics"`
	RatingRfCriticsVoteCount int `json:"ratingRfCriticsVoteCount"`
	WebUrl             string   `json:"webUrl"`
	Year               int      `json:"year"`
	FilmLength         int      `json:"filmLength"`
	Slogan             string   `json:"slogan"`
	Description        string   `json:"description"`
	ShortDescription   string   `json:"shortDescription"`
	EditorAnnotation   string   `json:"editorAnnotation"`
	IsTicketsAvailable bool     `json:"isTicketsAvailable"`
	ProductionStatus   string   `json:"productionStatus"`
	Type               string   `json:"type"`
	RatingMpaa         string   `json:"ratingMpaa"`
	RatingAgeLimits    string   `json:"ratingAgeLimits"`
	HasImax            bool     `json:"hasImax"`
	Has3D              bool     `json:"has3d"`
	LastSync           string   `json:"lastSync"`
	Countries          []struct {
		Country string `json:"country"`
	} `json:"countries"`
	Genres []struct {
		Genre string `json:"genre"`
	} `json:"genres"`
	StartYear int `json:"startYear"`
	EndYear   int `json:"endYear"`
	Serial    bool `json:"serial"`
	ShortFilm bool `json:"shortFilm"`
	Completed bool `json:"completed"`
}

type KPSearchResponse struct {
	Keyword    string    `json:"keyword"`
	PagesCount int       `json:"pagesCount"`
	Films      []KPFilmShort `json:"films"`
	SearchFilmsCountResult int `json:"searchFilmsCountResult"`
}

type KPFilmShort struct {
	// Old format fields
	FilmId       int      `json:"filmId"`
	// New format fields
	KinopoiskId  int      `json:"kinopoiskId"`
	
	NameRu       string   `json:"nameRu"`
	NameEn       string   `json:"nameEn"`
	NameOriginal string   `json:"nameOriginal"`
	ImdbId       string   `json:"imdbId"`
	Type         string   `json:"type"`
	Year         int      `json:"year"` // Changed from string to int
	Description  string   `json:"description"`
	FilmLength   string   `json:"filmLength"`
	Countries    []KPCountry `json:"countries"`
	Genres       []KPGenre   `json:"genres"`
	
	// Old format rating field
	Rating       string   `json:"rating"`
	// New format rating fields
	RatingKinopoisk float64 `json:"ratingKinopoisk"`
	RatingImdb      float64 `json:"ratingImdb"`
	
	RatingVoteCount int   `json:"ratingVoteCount"`
	PosterUrl    string   `json:"posterUrl"`
	PosterUrlPreview string `json:"posterUrlPreview"`
}

type KPCountry struct {
	Country string `json:"country"`
}

type KPGenre struct {
	Genre string `json:"genre"`
}

type KPExternalSource struct {
	Source string `json:"source"`
	ID     string `json:"id"`
}

func NewKinopoiskService(apiKey, baseURL string) *KinopoiskService {
	return &KinopoiskService{
		apiKey:  apiKey,
		baseURL: baseURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *KinopoiskService) makeRequest(endpoint string, target interface{}) error {
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		log.Printf("[Kinopoisk] makeRequest error creating request: %v", err)
		return err
	}

	// Log API key status
	if s.apiKey == "" {
		log.Printf("[Kinopoisk] ⚠️  API Key is EMPTY!")
	} else {
		log.Printf("[Kinopoisk] Using API Key (first 10 chars): %s...", s.apiKey[:10])
	}

	req.Header.Set("X-API-KEY", s.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		log.Printf("[Kinopoisk] makeRequest HTTP error: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Kinopoisk] makeRequest status code: %d for endpoint: %s", resp.StatusCode, endpoint)
		return fmt.Errorf("Kinopoisk API error: %d", resp.StatusCode)
	}

	return json.NewDecoder(resp.Body).Decode(target)
}

func (s *KinopoiskService) GetFilmByKinopoiskId(id int) (*KPFilm, error) {
	endpoint := fmt.Sprintf("%s/v2.2/films/%d", s.baseURL, id)
	var film KPFilm
	err := s.makeRequest(endpoint, &film)
	return &film, err
}

func (s *KinopoiskService) GetFilmByImdbId(imdbId string) (*KPFilm, error) {
    endpoint := fmt.Sprintf("%s/v2.2/films?imdbId=%s", s.baseURL, url.QueryEscape(imdbId))
	
	var response struct {
		Films []KPFilm `json:"items"`
	}
	
	err := s.makeRequest(endpoint, &response)
	if err != nil {
		return nil, err
	}
	
	if len(response.Films) == 0 {
		return nil, fmt.Errorf("film not found")
	}
	
	return &response.Films[0], nil
}

func (s *KinopoiskService) SearchFilms(keyword string, page int) (*KPSearchResponse, error) {
    endpoint := fmt.Sprintf("%s/v2.1/films/search-by-keyword?keyword=%s&page=%d", s.baseURL, url.QueryEscape(keyword), page)
	var response KPSearchResponse
	err := s.makeRequest(endpoint, &response)
	return &response, err
}

// GetPopularFilms tries to get popular films using filters API
// This is an alternative to GetTopFilms which may not work anymore
func (s *KinopoiskService) GetPopularFilms(page int) (*KPSearchResponse, error) {
	// Try using the filters API with popularity sort
	endpoint := fmt.Sprintf("%s/v2.2/films?sortField=num_vote&sortType=DESC&page=%d", s.baseURL, page)
	log.Printf("[Kinopoisk] GetPopularFilms (via filters): %s", endpoint)
	
	// Try new format first (items/total)
	var responseNew struct {
		Total      int           `json:"total"`
		TotalPages int           `json:"totalPages"`
		Items      []KPFilmShort `json:"items"`
	}
	
	err := s.makeRequest(endpoint, &responseNew)
	if err != nil {
		log.Printf("[Kinopoisk] GetPopularFilms error: %v", err)
		return nil, err
	}
	
	// If we got items, use them
	if len(responseNew.Items) > 0 {
		log.Printf("[Kinopoisk] GetPopularFilms got %d films (new format)", len(responseNew.Items))
		return &KPSearchResponse{
			PagesCount: responseNew.TotalPages,
			Films:      responseNew.Items,
			SearchFilmsCountResult: len(responseNew.Items),
		}, nil
	}
	
	// Fallback to old format (films/pagesCount)
	var responseOld struct {
		PagesCount int           `json:"pagesCount"`
		Films      []KPFilmShort `json:"films"`
	}
	
	err = s.makeRequest(endpoint, &responseOld)
	if err != nil {
		log.Printf("[Kinopoisk] GetPopularFilms error (old format): %v", err)
		return nil, err
	}
	
	log.Printf("[Kinopoisk] GetPopularFilms got %d films (old format)", len(responseOld.Films))
	
	return &KPSearchResponse{
		PagesCount: responseOld.PagesCount,
		Films:      responseOld.Films,
		SearchFilmsCountResult: len(responseOld.Films),
	}, nil
}

func (s *KinopoiskService) GetExternalSources(kinopoiskId int) ([]KPExternalSource, error) {
	endpoint := fmt.Sprintf("%s/v2.2/films/%d/external_sources", s.baseURL, kinopoiskId)
	
	var response struct {
		Items []KPExternalSource `json:"items"`
	}
	
	err := s.makeRequest(endpoint, &response)
	if err != nil {
		return nil, err
	}
	
	return response.Items, nil
}

func (s *KinopoiskService) GetTopFilms(topType string, page int) (*KPSearchResponse, error) {
	endpoint := fmt.Sprintf("%s/v2.2/films/top?type=%s&page=%d", s.baseURL, topType, page)
	log.Printf("[Kinopoisk] GetTopFilms: %s", endpoint)
	
	var response struct {
		PagesCount int           `json:"pagesCount"`
		Films      []KPFilmShort `json:"films"`
	}
	
	err := s.makeRequest(endpoint, &response)
	if err != nil {
		log.Printf("[Kinopoisk] GetTopFilms error: %v", err)
		return nil, err
	}
	
	log.Printf("[Kinopoisk] GetTopFilms got %d films (pagesCount=%d)", len(response.Films), response.PagesCount)
	
	// If no films returned, log warning
	if len(response.Films) == 0 {
		log.Printf("[Kinopoisk] ⚠️  GetTopFilms returned empty results for type=%s", topType)
	}
	
	return &KPSearchResponse{
		PagesCount: response.PagesCount,
		Films:      response.Films,
		SearchFilmsCountResult: len(response.Films),
	}, nil
}

func KPIdToImdbId(kpService *KinopoiskService, kpId int) (string, error) {
	film, err := kpService.GetFilmByKinopoiskId(kpId)
	if err != nil {
		return "", err
	}
	return film.ImdbId, nil
}

func ImdbIdToKPId(kpService *KinopoiskService, imdbId string) (int, error) {
	film, err := kpService.GetFilmByImdbId(imdbId)
	if err != nil {
		return 0, err
	}
	return film.KinopoiskId, nil
}

func TmdbIdToKPId(tmdbService *TMDBService, kpService *KinopoiskService, tmdbId int) (int, error) {
	externalIds, err := tmdbService.GetMovieExternalIDs(tmdbId)
	if err != nil {
		return 0, err
	}
	
	if externalIds.IMDbID == "" {
		return 0, fmt.Errorf("no IMDb ID found for TMDB ID %d", tmdbId)
	}
	
	return ImdbIdToKPId(kpService, externalIds.IMDbID)
}

func KPIdToTmdbId(tmdbService *TMDBService, kpService *KinopoiskService, kpId int) (int, error) {
	imdbId, err := KPIdToImdbId(kpService, kpId)
	if err != nil {
		return 0, err
	}
	
	movies, err := tmdbService.SearchMovies("", 1, "en-US", "", 0)
	if err != nil {
		return 0, err
	}
	
	for _, movie := range movies.Results {
		ids, err := tmdbService.GetMovieExternalIDs(movie.ID)
		if err != nil {
			continue
		}
		if ids.IMDbID == imdbId {
			return movie.ID, nil
		}
	}
	
	return 0, fmt.Errorf("TMDB ID not found for KP ID %d", kpId)
}

func ConvertKPRating(rating float64) float64 {
	return rating
}

func FormatKPYear(year int) string {
	return strconv.Itoa(year)
}
