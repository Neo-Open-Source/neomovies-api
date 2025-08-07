package services

import (
	"go.mongodb.org/mongo-driver/mongo"

	"neomovies-api/pkg/models"
)

type TVService struct {
	db   *mongo.Database
	tmdb *TMDBService
}

func NewTVService(db *mongo.Database, tmdb *TMDBService) *TVService {
	return &TVService{
		db:   db,
		tmdb: tmdb,
	}
}

func (s *TVService) Search(query string, page int, language string, year int) (*models.TMDBTVResponse, error) {
	return s.tmdb.SearchTVShows(query, page, language, year)
}

func (s *TVService) GetByID(id int, language string) (*models.TVShow, error) {
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