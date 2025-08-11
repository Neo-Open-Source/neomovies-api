package services

import (
	"context"
	"strconv"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"neomovies-api/pkg/models"
)

type MovieService struct {
	db   *mongo.Database
	tmdb *TMDBService
}

func NewMovieService(db *mongo.Database, tmdb *TMDBService) *MovieService {
	return &MovieService{
		db:   db,
		tmdb: tmdb,
	}
}

func (s *MovieService) Search(query string, page int, language, region string, year int) (*models.TMDBResponse, error) {
	return s.tmdb.SearchMovies(query, page, language, region, year)
}

func (s *MovieService) GetByID(id int, language string) (*models.Movie, error) {
	return s.tmdb.GetMovie(id, language)
}

func (s *MovieService) GetPopular(page int, language, region string) (*models.TMDBResponse, error) {
	return s.tmdb.GetPopularMovies(page, language, region)
}

func (s *MovieService) GetTopRated(page int, language, region string) (*models.TMDBResponse, error) {
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

func (s *MovieService) AddToFavorites(userID string, movieID string) error {
	collection := s.db.Collection("users")
	
	filter := bson.M{"_id": userID}
	update := bson.M{
		"$addToSet": bson.M{"favorites": movieID},
	}
	
	_, err := collection.UpdateOne(context.Background(), filter, update)
	return err
}

func (s *MovieService) RemoveFromFavorites(userID string, movieID string) error {
	collection := s.db.Collection("users")
	
	filter := bson.M{"_id": userID}
	update := bson.M{
		"$pull": bson.M{"favorites": movieID},
	}
	
	_, err := collection.UpdateOne(context.Background(), filter, update)
	return err
}

func (s *MovieService) GetFavorites(userID string, language string) ([]models.Movie, error) {
	collection := s.db.Collection("users")
	
	var user models.User
	err := collection.FindOne(context.Background(), bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		return nil, err
	}
	
	var movies []models.Movie
	for _, movieIDStr := range user.Favorites {
		movieID, err := strconv.Atoi(movieIDStr)
		if err != nil {
			continue
		}
		
		movie, err := s.tmdb.GetMovie(movieID, language)
		if err != nil {
			continue
		}
		
		movies = append(movies, *movie)
	}
	
	return movies, nil
}

func (s *MovieService) GetExternalIDs(id int) (*models.ExternalIDs, error) {
	return s.tmdb.GetMovieExternalIDs(id)
}