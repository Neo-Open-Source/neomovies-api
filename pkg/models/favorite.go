package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Favorite struct {
	ID              primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID          string             `json:"userId" bson:"userId"`
	KinopoiskID     string             `json:"kinopoiskId" bson:"kinopoiskId"`
	MediaID         string             `json:"mediaId" bson:"mediaId"` // TMDB ID for reference
	MediaType       string             `json:"mediaType" bson:"mediaType"` // "movie" or "tv"
	Title           string             `json:"title" bson:"title"`
	NameRu          string             `json:"nameRu" bson:"nameRu"`
	NameEn          string             `json:"nameEn" bson:"nameEn"`
	PosterPath      string             `json:"posterPath" bson:"posterPath"`
	PosterUrlPreview string            `json:"posterUrlPreview" bson:"posterUrlPreview"`
	Year            int                `json:"year" bson:"year"`
	Rating          float64            `json:"rating" bson:"rating"`
	CreatedAt       time.Time          `json:"createdAt" bson:"createdAt"`
}

type FavoriteRequest struct {
	MediaID    string `json:"mediaId" validate:"required"`
	MediaType  string `json:"mediaType" validate:"required,oneof=movie tv"`
	Title      string `json:"title" validate:"required"`
	PosterPath string `json:"posterPath"`
}
