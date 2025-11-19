package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID                  primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Email               string             `json:"email" bson:"email" validate:"required,email"`
	Password            string             `json:"-" bson:"password" validate:"required,min=6"`
	Name                string             `json:"name" bson:"name" validate:"required"`
	Avatar              string             `json:"avatar" bson:"avatar"`
	Favorites           []string           `json:"favorites" bson:"favorites"`
	Verified            bool               `json:"verified" bson:"verified"`
	VerificationCode    string             `json:"-" bson:"verificationCode,omitempty"`
	VerificationExpires time.Time          `json:"-" bson:"verificationExpires,omitempty"`
	IsAdmin             bool               `json:"isAdmin" bson:"isAdmin"`
	AdminVerified       bool               `json:"adminVerified" bson:"adminVerified"`
	CreatedAt           time.Time          `json:"created_at" bson:"createdAt"`
	UpdatedAt           time.Time          `json:"updated_at" bson:"updatedAt"`
	Provider            string             `json:"provider,omitempty" bson:"provider,omitempty"`
	GoogleID            string             `json:"googleId,omitempty" bson:"googleId,omitempty"`
	RefreshTokens       []RefreshToken     `json:"-" bson:"refreshTokens,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	Name     string `json:"name" validate:"required"`
}

type AuthResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
	User         User   `json:"user"`
}

type VerifyEmailRequest struct {
	Email string `json:"email" validate:"required,email"`
	Code  string `json:"code" validate:"required"`
}

type ResendCodeRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type RefreshToken struct {
	Token     string    `json:"token" bson:"token"`
	ExpiresAt time.Time `json:"expiresAt" bson:"expiresAt"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UserAgent string    `json:"userAgent,omitempty" bson:"userAgent,omitempty"`
	IPAddress string    `json:"ipAddress,omitempty" bson:"ipAddress,omitempty"`
}

type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}
