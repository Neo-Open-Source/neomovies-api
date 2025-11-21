package services

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"neomovies-api/pkg/models"
)

type FavoritesService struct {
	db        *mongo.Database
	tmdb      *TMDBService
	kinopoisk *KinopoiskService
}

func NewFavoritesService(db *mongo.Database, tmdb *TMDBService) *FavoritesService {
	return &FavoritesService{
		db:   db,
		tmdb: tmdb,
	}
}

func NewFavoritesServiceWithKP(db *mongo.Database, tmdb *TMDBService, kp *KinopoiskService) *FavoritesService {
	return &FavoritesService{
		db:        db,
		tmdb:      tmdb,
		kinopoisk: kp,
	}
}

func (s *FavoritesService) AddToFavorites(userID, mediaID, mediaType string) error {
	collection := s.db.Collection("favorites")

	// Проверяем, не добавлен ли уже в избранное
	filter := bson.M{
		"userId":    userID,
		"mediaId":   mediaID,
		"mediaType": mediaType,
	}

	var existingFavorite models.Favorite
	err := collection.FindOne(context.Background(), filter).Decode(&existingFavorite)
	if err == nil {
		// Уже в избранном
		return nil
	}

	// Получаем информацию из TMDB
	mediaIDInt, err := strconv.Atoi(mediaID)
	if err != nil {
		return fmt.Errorf("invalid media ID: %s", mediaID)
	}

	var movie *models.Movie
	var tv *models.TVShow

	if mediaType == "movie" {
		movie, err = s.tmdb.GetMovie(mediaIDInt, "ru-RU")
		if err != nil {
			return err
		}
	} else if mediaType == "tv" {
		tv, err = s.tmdb.GetTVShow(mediaIDInt, "ru-RU")
		if err != nil {
			return err
		}
	} else {
		return fmt.Errorf("invalid media type: %s", mediaType)
	}

	favorite := models.Favorite{
		UserID:    userID,
		MediaID:   mediaID,
		MediaType: mediaType,
		CreatedAt: time.Now(),
	}

	if movie != nil {
		favorite.Title = movie.Title
		favorite.NameRu = movie.Title
		favorite.NameEn = movie.OriginalTitle
		favorite.PosterPath = movie.PosterPath
		if len(movie.ReleaseDate) >= 4 {
			year, _ := strconv.Atoi(movie.ReleaseDate[:4])
			favorite.Year = year
		}
		favorite.Rating = movie.VoteAverage
	} else if tv != nil {
		favorite.Title = tv.Name
		favorite.NameRu = tv.Name
		favorite.NameEn = tv.OriginalName
		favorite.PosterPath = tv.PosterPath
		if len(tv.FirstAirDate) >= 4 {
			year, _ := strconv.Atoi(tv.FirstAirDate[:4])
			favorite.Year = year
		}
		favorite.Rating = tv.VoteAverage
	}

	_, err = collection.InsertOne(context.Background(), favorite)
	return err
}

// AddToFavoritesWithInfo adds media to favorites with provided media information
func (s *FavoritesService) AddToFavoritesWithInfo(userID, mediaID, mediaType string, mediaInfo *models.MediaInfo) error {
	collection := s.db.Collection("favorites")

	// Проверяем, не добавлен ли уже в избранное
	filter := bson.M{
		"userId":    userID,
		"mediaId":   mediaID,
		"mediaType": mediaType,
	}

	var existingFavorite models.Favorite
	err := collection.FindOne(context.Background(), filter).Decode(&existingFavorite)
	if err == nil {
		// Уже в избранном
		return nil
	}

	// Определяем источник данных и обрабатываем постер соответственно
	var posterPath, posterUrlPreview string
	
	if mediaInfo.PosterPath != "" {
		// Проверяем, это TMDB путь (начинается с /) или полный URL от Кинопоиска
		if len(mediaInfo.PosterPath) > 0 && mediaInfo.PosterPath[0] == '/' {
			// TMDB путь - формируем полный URL
			posterPath = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", mediaInfo.PosterPath)
		} else if len(mediaInfo.PosterPath) > 10 && (mediaInfo.PosterPath[:8] == "https://" || mediaInfo.PosterPath[:7] == "http://") {
			// Полный URL от Кинопоиска - извлекаем ID и формируем через API
			// Пример: https://kinopoiskapiunofficial.tech/images/posters/kp_small/6605654.jpg
			// Нужно получить: /api/v1/images/kp_small/6605654
			posterUrlPreview = extractKinopoiskImagePath(mediaInfo.PosterPath)
			posterPath = posterUrlPreview
		} else {
			// Другой формат - используем как есть
			posterPath = mediaInfo.PosterPath
		}
	}

	// Извлекаем год из даты
	year := 0
	if mediaType == "movie" && len(mediaInfo.ReleaseDate) >= 4 {
		year, _ = strconv.Atoi(mediaInfo.ReleaseDate[:4])
	} else if mediaType == "tv" && len(mediaInfo.FirstAirDate) >= 4 {
		year, _ = strconv.Atoi(mediaInfo.FirstAirDate[:4])
	}

	favorite := models.Favorite{
		UserID:           userID,
		MediaID:          mediaID,
		MediaType:        mediaType,
		Title:            mediaInfo.Title,
		NameRu:           mediaInfo.Title,
		NameEn:           mediaInfo.OriginalTitle,
		PosterPath:       posterPath,
		PosterUrlPreview: posterUrlPreview,
		Year:             year,
		Rating:           mediaInfo.VoteAverage,
		CreatedAt:        time.Now(),
	}

	_, err = collection.InsertOne(context.Background(), favorite)
	return err
}

func (s *FavoritesService) RemoveFromFavorites(userID, mediaID, mediaType string) error {
	collection := s.db.Collection("favorites")

	filter := bson.M{
		"userId":    userID,
		"mediaId":   mediaID,
		"mediaType": mediaType,
	}

	_, err := collection.DeleteOne(context.Background(), filter)
	return err
}

func (s *FavoritesService) GetFavorites(userID string) ([]models.Favorite, error) {
	collection := s.db.Collection("favorites")

	filter := bson.M{
		"userId": userID,
	}

	cursor, err := collection.Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var favorites []models.Favorite
	err = cursor.All(context.Background(), &favorites)
	if err != nil {
		return nil, err
	}

	// Возвращаем пустой массив вместо nil если нет избранных
	if favorites == nil {
		favorites = []models.Favorite{}
	}

	return favorites, nil
}

func (s *FavoritesService) IsFavorite(userID, mediaID, mediaType string) (bool, error) {
	collection := s.db.Collection("favorites")

	filter := bson.M{
		"userId":    userID,
		"mediaId":   mediaID,
		"mediaType": mediaType,
	}

	var favorite models.Favorite
	err := collection.FindOne(context.Background(), filter).Decode(&favorite)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// extractKinopoiskImagePath извлекает путь изображения Кинопоиска и преобразует его в API путь
// Пример входа: https://kinopoiskapiunofficial.tech/images/posters/kp_small/6605654.jpg
// Пример выхода: /api/v1/images/kp_small/6605654
func extractKinopoiskImagePath(imageURL string) string {
	// Ищем паттерн /images/posters/
	pattern := "/images/posters/"
	idx := strings.Index(imageURL, pattern)
	if idx == -1 {
		return imageURL
	}

	// Получаем часть после /images/posters/
	// Например: kp_small/6605654.jpg
	remainder := imageURL[idx+len(pattern):]

	// Удаляем расширение файла
	if lastDot := strings.LastIndex(remainder, "."); lastDot != -1 {
		remainder = remainder[:lastDot]
	}

	// Формируем API путь
	return fmt.Sprintf("/api/v1/images/%s", remainder)
}
