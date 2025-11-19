package services

import (
	"fmt"
	"log"
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

func (s *MovieService) GetByID(id int, language string, idType string) (*models.Movie, error) {
    // Строго уважаем явный id_type, без скрытого fallback на TMDB
    switch idType {
    case "kp":
        if s.kpService == nil {
            return nil, fmt.Errorf("kinopoisk service not configured")
        }

        // Сначала пробуем как Kinopoisk ID
        if kpFilm, err := s.kpService.GetFilmByKinopoiskId(id); err == nil {
            // Возвращаем KP-модель в TMDB-формате без подмены на TMDB объект
            return MapKPFilmToTMDBMovie(kpFilm), nil
        }

        // Возможно пришел TMDB ID — пробуем конвертировать TMDB -> KP
        if kpId, convErr := TmdbIdToKPId(s.tmdb, s.kpService, id); convErr == nil {
            if kpFilm, err := s.kpService.GetFilmByKinopoiskId(kpId); err == nil {
                return MapKPFilmToTMDBMovie(kpFilm), nil
            }
        }
        // Явно указан KP, но ничего не нашли — возвращаем ошибку
        return nil, fmt.Errorf("film not found in Kinopoisk with id %d", id)

    case "tmdb":
        return s.tmdb.GetMovie(id, language)
    }

    // Если id_type не указан — старая логика по языку
    if ShouldUseKinopoisk(language) && s.kpService != nil {
        if kpFilm, err := s.kpService.GetFilmByKinopoiskId(id); err == nil {
            return MapKPFilmToTMDBMovie(kpFilm), nil
        }
    }

    return s.tmdb.GetMovie(id, language)
}

func (s *MovieService) GetPopular(page int, language, region string) (*models.TMDBResponse, error) {
	log.Printf("[GetPopular] language=%s, region=%s, page=%d", language, region, page)
	
	if ShouldUseKinopoisk(language) && s.kpService != nil {
		log.Printf("[GetPopular] Using Kinopoisk for language: %s", language)
		
		// Try GetTopFilms first
		kpTop, err := s.kpService.GetTopFilms("TOP_100_POPULAR_FILMS", page)
		if err != nil {
			log.Printf("[GetPopular] GetTopFilms error: %v, trying GetPopularFilms", err)
		} else if kpTop != nil && len(kpTop.Films) > 0 {
			log.Printf("[GetPopular] Got %d films from GetTopFilms", len(kpTop.Films))
			return MapKPSearchToTMDBResponse(kpTop), nil
		} else {
			log.Printf("[GetPopular] GetTopFilms returned empty results, trying GetPopularFilms")
		}
		
		// Try GetPopularFilms as fallback
		kpPopular, err := s.kpService.GetPopularFilms(page)
		if err != nil {
			log.Printf("[GetPopular] GetPopularFilms error: %v, falling back to TMDB", err)
		} else if kpPopular != nil && len(kpPopular.Films) > 0 {
			log.Printf("[GetPopular] Got %d films from GetPopularFilms", len(kpPopular.Films))
			return MapKPSearchToTMDBResponse(kpPopular), nil
		} else {
			log.Printf("[GetPopular] GetPopularFilms returned empty results, falling back to TMDB")
		}
	}
	
	log.Printf("[GetPopular] Using TMDB for language: %s", language)
	return s.tmdb.GetPopularMovies(page, language, region)
}

func (s *MovieService) GetTopRated(page int, language, region string) (*models.TMDBResponse, error) {
	log.Printf("[GetTopRated] language=%s, region=%s, page=%d", language, region, page)
	
	if ShouldUseKinopoisk(language) && s.kpService != nil {
		log.Printf("[GetTopRated] Using Kinopoisk for language: %s", language)
		
		// Try GetTopFilms first
		kpTop, err := s.kpService.GetTopFilms("TOP_250_BEST_FILMS", page)
		if err != nil {
			log.Printf("[GetTopRated] GetTopFilms error: %v, trying GetPopularFilms", err)
		} else if kpTop != nil && len(kpTop.Films) > 0 {
			log.Printf("[GetTopRated] Got %d films from GetTopFilms", len(kpTop.Films))
			return MapKPSearchToTMDBResponse(kpTop), nil
		} else {
			log.Printf("[GetTopRated] GetTopFilms returned empty results, trying GetPopularFilms")
		}
		
		// Try GetPopularFilms as fallback (sorted by rating)
		kpPopular, err := s.kpService.GetPopularFilms(page)
		if err != nil {
			log.Printf("[GetTopRated] GetPopularFilms error: %v, falling back to TMDB", err)
		} else if kpPopular != nil && len(kpPopular.Films) > 0 {
			log.Printf("[GetTopRated] Got %d films from GetPopularFilms", len(kpPopular.Films))
			return MapKPSearchToTMDBResponse(kpPopular), nil
		} else {
			log.Printf("[GetTopRated] GetPopularFilms returned empty results, falling back to TMDB")
		}
	}
	
	log.Printf("[GetTopRated] Using TMDB for language: %s", language)
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
			
			// Пытаемся получить TMDB ID через IMDB ID
			if kpFilm.ImdbId != "" && s.tmdb != nil {
				if tmdbID, tmdbErr := s.tmdb.FindTMDBIdByIMDB(kpFilm.ImdbId, "movie", "ru-RU"); tmdbErr == nil {
					externalIDs.TMDBID = tmdbID
				}
			}
			
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
