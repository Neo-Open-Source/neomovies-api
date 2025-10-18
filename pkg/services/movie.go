package services

import (
	"go.mongodb.org/mongo-driver/mongo"

	"neomovies-api/pkg/models"
)

type MovieService struct {
	tmdb      *TMDBService
	kpService *KinopoiskService
}

func NewMovieService(db *mongo.Database, tmdb *TMDBService, kpService *KinopoiskService) *MovieService {
	return &MovieService{
		tmdb:      tmdb,
		kpService: kpService,
	}
}

func (s *MovieService) Search(query string, page int, language, region string, year int) (*models.TMDBResponse, error) {
	if ShouldUseKinopoisk(language) && s.kpService != nil {
		kpSearch, err := s.kpService.SearchFilms(query, page)
		if err == nil {
			return MapKPSearchToTMDBResponse(kpSearch), nil
		}
	}
	return s.tmdb.SearchMovies(query, page, language, region, year)
}

func (s *MovieService) GetByID(id int, language string) (*models.Movie, error) {
	if ShouldUseKinopoisk(language) && s.kpService != nil {
		kpFilm, err := s.kpService.GetFilmByKinopoiskId(id)
		if err == nil {
			return MapKPFilmToTMDBMovie(kpFilm), nil
		}
	}
	return s.tmdb.GetMovie(id, language)
}

func (s *MovieService) GetPopular(page int, language, region string) (*models.TMDBResponse, error) {
	if ShouldUseKinopoisk(language) && s.kpService != nil {
		kpTop, err := s.kpService.GetTopFilms("TOP_100_POPULAR_FILMS", page)
		if err == nil {
			return MapKPSearchToTMDBResponse(kpTop), nil
		}
	}
	return s.tmdb.GetPopularMovies(page, language, region)
}

func (s *MovieService) GetTopRated(page int, language, region string) (*models.TMDBResponse, error) {
	if ShouldUseKinopoisk(language) && s.kpService != nil {
		kpTop, err := s.kpService.GetTopFilms("TOP_250_BEST_FILMS", page)
		if err == nil {
			return MapKPSearchToTMDBResponse(kpTop), nil
		}
	}
	return s.tmdb.GetTopRatedMovies(page, language, region)
}

func (s *MovieService) GetUpcoming(page int, language, region string) (*models.TMDBResponse, error) {
	return s.tmdb.GetUpcomingMovies(page, language, region)
}

func (s *MovieService) GetNowPlaying(page int, language, region string) (*models.TMDBResponse, error) {
	return s.tmdb.GetNowPlayingMovies(page, language, region)
}

func (s *MovieService) GetRecommendations(id, page int, language string) (*models.TMDBResponse, error) {
	return s.tmdb.GetMovieRecommendations(id, page, language)
}

func (s *MovieService) GetSimilar(id, page int, language string) (*models.TMDBResponse, error) {
	return s.tmdb.GetSimilarMovies(id, page, language)
}

func (s *MovieService) GetExternalIDs(id int) (*models.ExternalIDs, error) {
	if s.kpService != nil {
		kpFilm, err := s.kpService.GetFilmByKinopoiskId(id)
		if err == nil && kpFilm != nil {
			externalIDs := MapKPExternalIDsToTMDB(kpFilm)
			externalIDs.ID = id
			return externalIDs, nil
		}
	}
	
	tmdbIDs, err := s.tmdb.GetMovieExternalIDs(id)
	if err != nil {
		return nil, err
	}
	
	if s.kpService != nil && tmdbIDs.IMDbID != "" {
		kpFilm, err := s.kpService.GetFilmByImdbId(tmdbIDs.IMDbID)
		if err == nil && kpFilm != nil {
			tmdbIDs.KinopoiskID = kpFilm.KinopoiskId
		}
	}
	
	return tmdbIDs, nil
}
