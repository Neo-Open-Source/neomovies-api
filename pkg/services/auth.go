package services

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	"neomovies-api/pkg/models"
)

// AuthService handles local JWT sessions for NeoMovies users.
// Identity is always established via Neo ID — no passwords here.
type AuthService struct {
	db        *mongo.Database
	jwtSecret string
}

func NewAuthService(db *mongo.Database, jwtSecret string) *AuthService {
	return &AuthService{db: db, jwtSecret: jwtSecret}
}

// GetUserByID returns a user by MongoDB ObjectID hex string.
func (s *AuthService) GetUserByID(userID string) (*models.User, error) {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}
	var user models.User
	err = s.db.Collection("users").FindOne(context.Background(), bson.M{"_id": oid}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByNeoID returns a user by their Neo ID unified_id.
func (s *AuthService) GetUserByNeoID(neoID string) (*models.User, error) {
	var user models.User
	err := s.db.Collection("users").FindOne(context.Background(), bson.M{"neoId": neoID}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByEmailPublic returns a user by email (used by webhook handler).
func (s *AuthService) GetUserByEmailPublic(email string) (*models.User, error) {
	var user models.User
	err := s.db.Collection("users").FindOne(context.Background(), bson.M{"email": email}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateUser applies a bson.M patch to a user document.
func (s *AuthService) UpdateUser(userID string, updates bson.M) (*models.User, error) {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}
	updates["updatedAt"] = time.Now()
	_, err = s.db.Collection("users").UpdateOne(
		context.Background(),
		bson.M{"_id": oid},
		bson.M{"$set": updates},
	)
	if err != nil {
		return nil, err
	}
	return s.GetUserByID(userID)
}

// DeleteAccount removes the user and all their data.
func (s *AuthService) DeleteAccount(ctx context.Context, userID string) error {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return err
	}
	_, _ = s.db.Collection("favorites").DeleteMany(ctx, bson.M{"userId": oid})
	_, _ = s.db.Collection("reactions").DeleteMany(ctx, bson.M{"userId": oid})
	_, err = s.db.Collection("users").DeleteOne(ctx, bson.M{"_id": oid})
	return err
}

// GenerateTokenPairPublic creates a local access + refresh token pair for a user.
func (s *AuthService) GenerateTokenPairPublic(userID, userAgent, ipAddress string) (*models.TokenPair, error) {
	return s.generateTokenPair(userID, userAgent, ipAddress)
}

func (s *AuthService) generateJWT(userID string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour).Unix(),
		"iat":     time.Now().Unix(),
		"jti":     uuid.New().String(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString([]byte(s.jwtSecret))
}

func (s *AuthService) generateTokenPair(userID, userAgent, ipAddress string) (*models.TokenPair, error) {
	accessToken, err := s.generateJWT(userID)
	if err != nil {
		return nil, err
	}

	refreshToken := uuid.New().String()
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}

	col := s.db.Collection("users")
	ctx := context.Background()

	// Prune expired tokens
	_, _ = col.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{
		"$pull": bson.M{"refreshTokens": bson.M{"expiresAt": bson.M{"$lt": time.Now()}}},
	})

	_, err = col.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{
		"$push": bson.M{"refreshTokens": models.RefreshToken{
			Token:     refreshToken,
			ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
			CreatedAt: time.Now(),
			UserAgent: userAgent,
			IPAddress: ipAddress,
		}},
		"$set": bson.M{"updatedAt": time.Now()},
	})
	if err != nil {
		return nil, err
	}

	return &models.TokenPair{AccessToken: accessToken, RefreshToken: refreshToken}, nil
}

// RefreshAccessToken rotates a refresh token and issues a new pair.
func (s *AuthService) RefreshAccessToken(refreshToken, userAgent, ipAddress string) (*models.TokenPair, error) {
	col := s.db.Collection("users")
	var user models.User
	err := col.FindOne(context.Background(), bson.M{
		"refreshTokens": bson.M{"$elemMatch": bson.M{
			"token":     refreshToken,
			"expiresAt": bson.M{"$gt": time.Now()},
		}},
	}).Decode(&user)
	if err != nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	// Remove used token
	_, _ = col.UpdateOne(context.Background(), bson.M{"_id": user.ID}, bson.M{
		"$pull": bson.M{"refreshTokens": bson.M{"token": refreshToken}},
	})

	return s.generateTokenPair(user.ID.Hex(), userAgent, ipAddress)
}

// RevokeRefreshToken removes a specific refresh token.
func (s *AuthService) RevokeRefreshToken(userID, refreshToken string) error {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return err
	}
	_, err = s.db.Collection("users").UpdateOne(
		context.Background(),
		bson.M{"_id": oid},
		bson.M{"$pull": bson.M{"refreshTokens": bson.M{"token": refreshToken}}},
	)
	return err
}

// RevokeAllRefreshTokens clears all refresh tokens for a user.
func (s *AuthService) RevokeAllRefreshTokens(userID string) error {
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return err
	}
	_, err = s.db.Collection("users").UpdateOne(
		context.Background(),
		bson.M{"_id": oid},
		bson.M{"$set": bson.M{"refreshTokens": []models.RefreshToken{}, "updatedAt": time.Now()}},
	)
	return err
}
