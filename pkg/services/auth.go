package services

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"

	"neomovies-api/pkg/models"
)

// AuthService contains the database connection, JWT secret, and email service.
type AuthService struct {
	db           *mongo.Database
	jwtSecret    string
	emailService *EmailService
	cubAPIURL    string
}

// Reaction represents a reaction entry in the database.
type Reaction struct {
    MediaID string `bson:"mediaId"`
    Type    string `bson:"type"`
    UserID  primitive.ObjectID `bson:"userId"`
}

// NewAuthService creates and initializes a new AuthService.
func NewAuthService(db *mongo.Database, jwtSecret string, emailService *EmailService, cubAPIURL string) *AuthService {
	service := &AuthService{
		db:           db,
		jwtSecret:    jwtSecret,
		emailService: emailService,
		cubAPIURL:    cubAPIURL,
	}
    
	return service
}

// generateVerificationCode creates a 6-digit verification code.
func (s *AuthService) generateVerificationCode() string {
	return fmt.Sprintf("%06d", rand.Intn(900000)+100000)
}

// Register registers a new user.
func (s *AuthService) Register(req models.RegisterRequest) (map[string]interface{}, error) {
	collection := s.db.Collection("users")

	var existingUser models.User
	err := collection.FindOne(context.Background(), bson.M{"email": req.Email}).Decode(&existingUser)
	if err == nil {
		return nil, errors.New("email already registered")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	code := s.generateVerificationCode()
	codeExpires := time.Now().Add(10 * time.Minute)

	user := models.User{
		ID:                 primitive.NewObjectID(),
		Email:              req.Email,
		Password:           string(hashedPassword),
		Name:               req.Name,
		Favorites:          []string{},
		Verified:           false,
		VerificationCode:   code,
		VerificationExpires: codeExpires,
		IsAdmin:            false,
		AdminVerified:      false,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	_, err = collection.InsertOne(context.Background(), user)
	if err != nil {
		return nil, err
	}

	if s.emailService != nil {
		go s.emailService.SendVerificationEmail(user.Email, code)
	}

	return map[string]interface{}{
		"success": true,
		"message": "Registered. Check email for verification code.",
	}, nil
}

// Login authenticates a user.
func (s *AuthService) Login(req models.LoginRequest) (*models.AuthResponse, error) {
	collection := s.db.Collection("users")
    
	var user models.User
	err := collection.FindOne(context.Background(), bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		return nil, errors.New("User not found")
	}

	if !user.Verified {
		return nil, errors.New("Account not activated. Please verify your email.")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return nil, errors.New("Invalid password")
	}

	token, err := s.generateJWT(user.ID.Hex())
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

// GetUserByID retrieves a user by their ID.
func (s *AuthService) GetUserByID(userID string) (*models.User, error) {
	collection := s.db.Collection("users")

	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}

	var user models.User
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&user)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

// UpdateUser updates a user's information.
func (s *AuthService) UpdateUser(userID string, updates bson.M) (*models.User, error) {
	collection := s.db.Collection("users")

	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}

	updates["updated_at"] = time.Now()

	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"_id": objectID},
		bson.M{"$set": updates},
	)
	if err != nil {
		return nil, err
	}

	return s.GetUserByID(userID)
}

// generateJWT generates a new JWT for a given user ID.
func (s *AuthService) generateJWT(userID string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(),
		"iat":     time.Now().Unix(),
		"jti":     uuid.New().String(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// VerifyEmail verifies a user's email with a code.
func (s *AuthService) VerifyEmail(req models.VerifyEmailRequest) (map[string]interface{}, error) {
	collection := s.db.Collection("users")

	var user models.User
	err := collection.FindOne(context.Background(), bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		return nil, errors.New("user not found")
	}

	if user.Verified {
		return map[string]interface{}{
			"success": true,
			"message": "Email already verified",
		}, nil
	}

	if user.VerificationCode != req.Code || user.VerificationExpires.Before(time.Now()) {
		return nil, errors.New("invalid or expired verification code")
	}

	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"email": req.Email},
		bson.M{
			"$set": bson.M{"verified": true},
			"$unset": bson.M{
				"verificationCode":    "",
				"verificationExpires": "",
			},
		},
	)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success": true,
		"message": "Email verified successfully",
	}, nil
}

// ResendVerificationCode sends a new verification email.
func (s *AuthService) ResendVerificationCode(req models.ResendCodeRequest) (map[string]interface{}, error) {
	collection := s.db.Collection("users")

	var user models.User
	err := collection.FindOne(context.Background(), bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		return nil, errors.New("user not found")
	}

	if user.Verified {
		return nil, errors.New("email already verified")
	}

	code := s.generateVerificationCode()
	codeExpires := time.Now().Add(10 * time.Minute)

	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"email": req.Email},
		bson.M{
			"$set": bson.M{
				"verificationCode":    code,
				"verificationExpires": codeExpires,
			},
		},
	)
	if err != nil {
		return nil, err
	}

	if s.emailService != nil {
		go s.emailService.SendVerificationEmail(user.Email, code)
	}

	return map[string]interface{}{
		"success": true,
		"message": "Verification code sent to your email",
	}, nil
}

// DeleteAccount deletes a user and all associated data.
func (s *AuthService) DeleteAccount(ctx context.Context, userID string) error {
	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return fmt.Errorf("invalid user ID format: %w", err)
	}

	// Step 1: Find user reactions and remove them from cub.rip
	if s.cubAPIURL != "" {
		reactionsCollection := s.db.Collection("reactions")
		var userReactions []Reaction
		cursor, err := reactionsCollection.Find(ctx, bson.M{"userId": objectID})
		if err != nil {
			return fmt.Errorf("failed to find user reactions: %w", err)
		}
		if err = cursor.All(ctx, &userReactions); err != nil {
			return fmt.Errorf("failed to decode user reactions: %w", err)
		}

		var wg sync.WaitGroup
		client := &http.Client{Timeout: 10 * time.Second}

		for _, reaction := range userReactions {
			wg.Add(1)
			go func(r Reaction) {
				defer wg.Done()
				url := fmt.Sprintf("%s/reactions/remove/%s/%s", s.cubAPIURL, r.MediaID, r.Type)
				req, err := http.NewRequestWithContext(ctx, "POST", url, nil) // or "DELETE"
				if err != nil {
					// Log the error but don't stop the process
					fmt.Printf("failed to create request for cub.rip: %v\n", err)
					return
				}
				
				resp, err := client.Do(req)
				if err != nil {
					fmt.Printf("failed to send request to cub.rip: %v\n", err)
					return
				}
				defer resp.Body.Close()
				
				if resp.StatusCode != http.StatusOK {
					body, _ := io.ReadAll(resp.Body)
					fmt.Printf("cub.rip API responded with status %d: %s\n", resp.StatusCode, body)
				}
			}(reaction)
		}
		wg.Wait()
	}

	// Step 2: Delete all user-related data from the database
	usersCollection := s.db.Collection("users")
	favoritesCollection := s.db.Collection("favorites")
	reactionsCollection := s.db.Collection("reactions")

	_, err = usersCollection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	_, err = favoritesCollection.DeleteMany(ctx, bson.M{"userId": objectID})
	if err != nil {
		return fmt.Errorf("failed to delete user favorites: %w", err)
	}

	_, err = reactionsCollection.DeleteMany(ctx, bson.M{"userId": objectID})
	if err != nil {
		return fmt.Errorf("failed to delete user reactions: %w", err)
	}

	return nil
}
