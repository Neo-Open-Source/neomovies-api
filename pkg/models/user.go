package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User represents a NeoMovies user, identified via Neo ID.
type User struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	NeoID     string             `json:"neo_id" bson:"neoId"`
	Email     string             `json:"email" bson:"email"`
	Name      string             `json:"name" bson:"name"`
	Avatar    string             `json:"avatar" bson:"avatar"`
	IsAdmin   bool               `json:"is_admin" bson:"isAdmin"`
	CreatedAt time.Time          `json:"created_at" bson:"createdAt"`
	UpdatedAt time.Time          `json:"updated_at" bson:"updatedAt"`

	// Local refresh tokens (short-lived, stored in DB)
	RefreshTokens []RefreshToken `json:"-" bson:"refreshTokens,omitempty"`
}

type RefreshToken struct {
	Token     string    `bson:"token"`
	ExpiresAt time.Time `bson:"expiresAt"`
	CreatedAt time.Time `bson:"createdAt"`
	UserAgent string    `bson:"userAgent,omitempty"`
	IPAddress string    `bson:"ipAddress,omitempty"`
}

type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken"`
}
