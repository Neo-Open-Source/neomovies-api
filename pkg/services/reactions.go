package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"neomovies-api/pkg/models"
)

type ReactionsService struct {
	db     *mongo.Database
	client *http.Client
}

func NewReactionsService(db *mongo.Database) *ReactionsService {
	return &ReactionsService{
		db:     db,
		client: &http.Client{},
	}
}

const CUB_API_URL = "https://cub.rip/api"

var VALID_REACTIONS = []string{"fire", "nice", "think", "bore", "shit"}

// Получить счетчики реакций для медиа из внешнего API (cub.rip)
func (s *ReactionsService) GetReactionCounts(mediaType, mediaID string) (*models.ReactionCounts, error) {
	cubID := fmt.Sprintf("%s_%s", mediaType, mediaID)
	
	resp, err := s.client.Get(fmt.Sprintf("%s/reactions/get/%s", CUB_API_URL, cubID))
	if err != nil {
		return &models.ReactionCounts{}, nil // Возвращаем пустые счетчики при ошибке
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &models.ReactionCounts{}, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &models.ReactionCounts{}, nil
	}

	var response struct {
		Result []struct {
			Type    string `json:"type"`
			Counter int    `json:"counter"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return &models.ReactionCounts{}, nil
	}

	// Преобразуем в нашу структуру
	counts := &models.ReactionCounts{}
	for _, reaction := range response.Result {
		switch reaction.Type {
		case "fire":
			counts.Fire = reaction.Counter
		case "nice":
			counts.Nice = reaction.Counter
		case "think":
			counts.Think = reaction.Counter
		case "bore":
			counts.Bore = reaction.Counter
		case "shit":
			counts.Shit = reaction.Counter
		}
	}

	return counts, nil
}

// Получить реакцию пользователя для медиа
func (s *ReactionsService) GetUserReaction(userID, mediaType, mediaID string) (*models.Reaction, error) {
	collection := s.db.Collection("reactions")
	fullMediaID := fmt.Sprintf("%s_%s", mediaType, mediaID)

	var reaction models.Reaction
	err := collection.FindOne(context.Background(), bson.M{
		"userId":  userID,
		"mediaId": fullMediaID,
	}).Decode(&reaction)

	if err == mongo.ErrNoDocuments {
		return nil, nil // Реакции нет
	}

	return &reaction, err
}

// Установить реакцию пользователя
func (s *ReactionsService) SetUserReaction(userID, mediaType, mediaID, reactionType string) error {
	// Проверяем валидность типа реакции
	if !s.isValidReactionType(reactionType) {
		return fmt.Errorf("invalid reaction type: %s", reactionType)
	}

	collection := s.db.Collection("reactions")
	fullMediaID := fmt.Sprintf("%s_%s", mediaType, mediaID)

	// Создаем или обновляем реакцию
	filter := bson.M{
		"userId":  userID,
		"mediaId": fullMediaID,
	}

	reaction := models.Reaction{
		UserID:  userID,
		MediaID: fullMediaID,
		Type:    reactionType,
		Created: time.Now().Format(time.RFC3339),
	}

	update := bson.M{
		"$set": reaction,
	}

	upsert := true
	_, err := collection.UpdateOne(context.Background(), filter, update, &options.UpdateOptions{
		Upsert: &upsert,
	})

	if err != nil {
		return err
	}

	// Отправляем реакцию в cub.rip API
	go s.sendReactionToCub(fullMediaID, reactionType)

	return nil
}

// Удалить реакцию пользователя
func (s *ReactionsService) RemoveUserReaction(userID, mediaType, mediaID string) error {
	collection := s.db.Collection("reactions")
	fullMediaID := fmt.Sprintf("%s_%s", mediaType, mediaID)

	_, err := collection.DeleteOne(context.Background(), bson.M{
		"userId":  userID,
		"mediaId": fullMediaID,
	})

	return err
}

// Получить все реакции пользователя
func (s *ReactionsService) GetUserReactions(userID string, limit int) ([]models.Reaction, error) {
	collection := s.db.Collection("reactions")

	ctx := context.Background()
	cursor, err := collection.Find(ctx, bson.M{"userId": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var reactions []models.Reaction
	if err := cursor.All(ctx, &reactions); err != nil {
		return nil, err
	}

	return reactions, nil
}

func (s *ReactionsService) isValidReactionType(reactionType string) bool {
	for _, valid := range VALID_REACTIONS {
		if valid == reactionType {
			return true
		}
	}
	return false
}

// Отправка реакции в cub.rip API (асинхронно)
func (s *ReactionsService) sendReactionToCub(mediaID, reactionType string) {
	// Формируем запрос к cub.rip API
	url := fmt.Sprintf("%s/reactions/set", CUB_API_URL)
	
	data := map[string]string{
		"mediaId": mediaID,
		"type":    reactionType,
	}

	_, err := json.Marshal(data)
	if err != nil {
		return
	}

	// В данном случае мы отправляем простой POST запрос
	// В будущем можно доработать для отправки JSON данных
	resp, err := s.client.Get(fmt.Sprintf("%s?mediaId=%s&type=%s", url, mediaID, reactionType))
	if err != nil {
		return
	}
	defer resp.Body.Close()

	// Логируем результат (в продакшене лучше использовать структурированное логирование)
	if resp.StatusCode == http.StatusOK {
		fmt.Printf("Reaction sent to cub.rip: %s - %s\n", mediaID, reactionType)
	}
}