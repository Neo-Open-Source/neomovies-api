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
	// Если указан id_type, используем его; иначе определяем по языку
	useKP := false
	if idType == "kp" {
		useKP = true
	} else if idType == "tmdb" {
		useKP = false
	} else {
		// Если id_type не указан, используем старую логику по языку
		useKP = ShouldUseKinopoisk(language)
	}
	
	if useKP && s.kpService != nil {
		// Сначала пробуем напрямую по KP ID
		kpFilm, err := s.kpService.GetFilmByKinopoiskId(id)
		if err == nil && kpFilm != nil {
			return MapKPFilmToTVShow(kpFilm), nil
		}
		
		// Если не найдено и явно указан id_type=kp, возможно это TMDB ID
		// Пробуем конвертировать TMDB -> KP
		if idType == "kp" {
			kpId, convErr := TmdbIdToKPId(s.tmdb, s.kpService, id)
			if convErr == nil {
				kpFilm, err := s.kpService.GetFilmByKinopoiskId(kpId)
				if err == nil && kpFilm != nil {
					return MapKPFilmToTVShow(kpFilm), nil
				}
			}
			// Если конвертация не удалась, возвращаем ошибку вместо fallback
			return nil, fmt.Errorf("TV show not found in Kinopoisk with id %d", id)
		}
	}
	
	// Для TMDB или если KP не указан
	return s.tmdb.GetTVShow(id, language)
}

func (s *TVService) GetPopular(page int, language string) (*models.TMDBTVResponse, error) {
	return s.tmdb.GetPopularTVShows(page, language)
}

func (s *TVService) GetTopRated(page int, language string) (*models.TMDBTVResponse, error) {
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
	return s.tmdb.GetTVExternalIDs(id)
}
