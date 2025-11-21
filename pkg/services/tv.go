package services

import (
	"fmt"
	"go.mongodb.org/mongo-driver/mongo"

	"neomovies-api/pkg/models"
)

type TVService struct {
	db        *mongo.Database
	tmdb      *TMDBService
	kpService *KinopoiskService
}

func NewTVService(db *mongo.Database, tmdb *TMDBService, kpService *KinopoiskService) *TVService {
	return &TVService{
		db:        db,
		tmdb:      tmdb,
		kpService: kpService,
	}
}

func (s *TVService) Search(query string, page int, language string, year int) (*models.TMDBTVResponse, error) {
	return s.tmdb.SearchTVShows(query, page, language, year)
}

func (s *TVService) GetByID(id int, language string, idType string) (*models.TVShow, error) {
    // Строго уважаем явный id_type, без скрытого fallback на TMDB
    switch idType {
    case "kp":
        if s.kpService == nil {
            return nil, fmt.Errorf("kinopoisk service not configured")
        }

        // Сначала пробуем как Kinopoisk ID
        if kpFilm, err := s.kpService.GetFilmByKinopoiskId(id); err == nil && kpFilm != nil {
            // Попробуем обогатить TMDB сериал через IMDb -> TMDB find
            if kpFilm.ImdbId != "" {
                if tmdbID, fErr := s.tmdb.FindTMDBIdByIMDB(kpFilm.ImdbId, "tv", NormalizeLanguage(language)); fErr == nil {
                    if tmdbTV, mErr := s.tmdb.GetTVShow(tmdbID, NormalizeLanguage(language)); mErr == nil {
                        return tmdbTV, nil
                    }
                }
            }
            return MapKPFilmToTVShow(kpFilm), nil
        }

        // Возможно пришел TMDB ID — пробуем конвертировать TMDB -> KP
        if kpId, convErr := TmdbIdToKPId(s.tmdb, s.kpService, id); convErr == nil {
            if kpFilm, err := s.kpService.GetFilmByKinopoiskId(kpId); err == nil && kpFilm != nil {
                if kpFilm.ImdbId != "" {
                    if tmdbID, fErr := s.tmdb.FindTMDBIdByIMDB(kpFilm.ImdbId, "tv", NormalizeLanguage(language)); fErr == nil {
                        if tmdbTV, mErr := s.tmdb.GetTVShow(tmdbID, NormalizeLanguage(language)); mErr == nil {
                            return tmdbTV, nil
                        }
                    }
                }
                return MapKPFilmToTVShow(kpFilm), nil
            }
        }
        // Явно указан KP, но ничего не нашли — возвращаем ошибку
        return nil, fmt.Errorf("TV show not found in Kinopoisk with id %d", id)

    case "tmdb":
        return s.tmdb.GetTVShow(id, language)
    }

    // Если id_type не указан — старая логика по языку
    if ShouldUseKinopoisk(language) && s.kpService != nil {
        if kpFilm, err := s.kpService.GetFilmByKinopoiskId(id); err == nil && kpFilm != nil {
            return MapKPFilmToTVShow(kpFilm), nil
        }
    }

    return s.tmdb.GetTVShow(id, language)
}

func (s *TVService) GetPopular(page int, language string) (*models.TMDBTVResponse, error) {
	if ShouldUseKinopoisk(language) && s.kpService != nil {
		kpResult, err := s.kpService.GetCollection("TOP_POPULAR_ALL", page)
		if err == nil && kpResult != nil && len(kpResult.Films) > 0 {
			return MapKPSearchToTMDBTVResponse(kpResult), nil
		}
	}
	
	return s.tmdb.GetPopularTVShows(page, language)
}

func (s *TVService) GetTopRated(page int, language string) (*models.TMDBTVResponse, error) {
	if ShouldUseKinopoisk(language) && s.kpService != nil {
		kpResult, err := s.kpService.GetCollection("TOP_250_TV_SHOWS", page)
		if err == nil && kpResult != nil && len(kpResult.Films) > 0 {
			return MapKPSearchToTMDBTVResponse(kpResult), nil
		}
	}
	
	return s.tmdb.GetTopRatedTVShows(page, language)
}

func (s *TVService) GetOnTheAir(page int, language string) (*models.TMDBTVResponse, error) {
	return s.tmdb.GetOnTheAirTVShows(page, language)
}

func (s *TVService) GetAiringToday(page int, language string) (*models.TMDBTVResponse, error) {
	return s.tmdb.GetAiringTodayTVShows(page, language)
}

func (s *TVService) GetRecommendations(id, page int, language string) (*models.TMDBTVResponse, error) {
	return s.tmdb.GetTVRecommendations(id, page, language)
}

func (s *TVService) GetSimilar(id, page int, language string) (*models.TMDBTVResponse, error) {
	return s.tmdb.GetSimilarTVShows(id, page, language)
}

func (s *TVService) GetExternalIDs(id int) (*models.ExternalIDs, error) {
	if s.kpService != nil {
		kpFilm, err := s.kpService.GetFilmByKinopoiskId(id)
		if err == nil && kpFilm != nil {
			externalIDs := MapKPExternalIDsToTMDB(kpFilm)
			externalIDs.ID = id
			
			// Пытаемся получить TMDB ID через IMDB ID
			if kpFilm.ImdbId != "" && s.tmdb != nil {
				if tmdbID, tmdbErr := s.tmdb.FindTMDBIdByIMDB(kpFilm.ImdbId, "tv", "ru-RU"); tmdbErr == nil {
					externalIDs.TMDBID = tmdbID
				}
			}
			
			return externalIDs, nil
		}
	}
	
	tmdbIDs, err := s.tmdb.GetTVExternalIDs(id)
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
