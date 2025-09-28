package services

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"sync"
	"time"

	"encoding/json"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"neomovies-api/pkg/models"
)

// AuthService contains the database connection, JWT secret, and email service.
type AuthService struct {
	db                 *mongo.Database
	jwtSecret          string
	emailService       *EmailService
	baseURL            string
	googleClientID     string
	googleClientSecret string
	googleRedirectURL  string
	frontendURL        string
}

// Reaction represents a reaction entry in the database.
type Reaction struct {
	MediaID string             `bson:"mediaId"`
	Type    string             `bson:"type"`
	UserID  primitive.ObjectID `bson:"userId"`
}

// NewAuthService creates and initializes a new AuthService.
func NewAuthService(db *mongo.Database, jwtSecret string, emailService *EmailService, baseURL string, googleClientID string, googleClientSecret string, googleRedirectURL string, frontendURL string) *AuthService {
	service := &AuthService{
		db:                 db,
		jwtSecret:          jwtSecret,
		emailService:       emailService,
		baseURL:            baseURL,
		googleClientID:     googleClientID,
		googleClientSecret: googleClientSecret,
		googleRedirectURL:  googleRedirectURL,
		frontendURL:        frontendURL,
	}
	return service
}

func (s *AuthService) googleOAuthConfig() *oauth2.Config {
	redirectURL := s.googleRedirectURL
	if redirectURL == "" && s.baseURL != "" {
		redirectURL = fmt.Sprintf("%s/api/v1/auth/google/callback", s.baseURL)
	}
	return &oauth2.Config{
		ClientID:     s.googleClientID,
		ClientSecret: s.googleClientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
}

func (s *AuthService) GetGoogleLoginURL(state string) (string, error) {
	cfg := s.googleOAuthConfig()
	if cfg.ClientID == "" || cfg.ClientSecret == "" || cfg.RedirectURL == "" {
		return "", errors.New("google oauth not configured")
	}
	return cfg.AuthCodeURL(state, oauth2.AccessTypeOffline), nil
}

type googleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	EmailVerified bool   `json:"email_verified"`
}

// BuildFrontendRedirect builds frontend URL for redirect after OAuth; returns false if not configured
func (s *AuthService) BuildFrontendRedirect(token string, authErr string) (string, bool) {
	if s.frontendURL == "" {
		return "", false
	}
	if authErr != "" {
		u, _ := url.Parse(s.frontendURL + "/login")
		q := u.Query()
		q.Set("oauth", "google")
		q.Set("error", authErr)
		u.RawQuery = q.Encode()
		return u.String(), true
	}
	u, _ := url.Parse(s.frontendURL + "/auth/callback")
	q := u.Query()
	q.Set("provider", "google")
	q.Set("token", token)
	u.RawQuery = q.Encode()
	return u.String(), true
}

func (s *AuthService) HandleGoogleCallback(ctx context.Context, code string) (*models.AuthResponse, error) {
	cfg := s.googleOAuthConfig()
	tok, err := cfg.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}

	client := cfg.Client(ctx, tok)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch userinfo: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo request failed: status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var gUser googleUserInfo
	if err := json.Unmarshal(body, &gUser); err != nil {
		return nil, fmt.Errorf("failed to parse userinfo: %w", err)
	}
	if gUser.Email == "" {
		return nil, errors.New("email not provided by Google")
	}

	collection := s.db.Collection("users")

	// Try by googleId first
	var user models.User
	err = collection.FindOne(ctx, bson.M{"googleId": gUser.Sub}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		// Try by email
		err = collection.FindOne(ctx, bson.M{"email": gUser.Email}).Decode(&user)
	}
	if err == mongo.ErrNoDocuments {
		// Create new user
		user = models.User{
			ID:            primitive.NewObjectID(),
			Email:         gUser.Email,
			Password:      "",
			Name:          gUser.Name,
			Avatar:        gUser.Picture,
			Favorites:     []string{},
			Verified:      true,
			IsAdmin:       false,
			AdminVerified: false,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
			Provider:      "google",
			GoogleID:      gUser.Sub,
		}
		if _, err := collection.InsertOne(ctx, user); err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		// Existing user: ensure fields
		update := bson.M{
			"verified":  true,
			"provider":  "google",
			"googleId":  gUser.Sub,
			"updatedAt": time.Now(),
		}
		if user.Name == "" && gUser.Name != "" {
			update["name"] = gUser.Name
		}
		if user.Avatar == "" && gUser.Picture != "" {
			update["avatar"] = gUser.Picture
		}
		_, _ = collection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": update})
	}

	// Generate JWT
	if user.ID.IsZero() {
		// If we created user above, we already have user.ID set; else fetch updated
		_ = collection.FindOne(ctx, bson.M{"email": gUser.Email}).Decode(&user)
	}
	tokenPair, err := s.generateTokenPair(user.ID.Hex(), "", "")
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Token:        tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		User:         user,
	}, nil
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
		ID:                  primitive.NewObjectID(),
		Email:               req.Email,
		Password:            string(hashedPassword),
		Name:                req.Name,
		Favorites:           []string{},
		Verified:            false,
		VerificationCode:    code,
		VerificationExpires: codeExpires,
		IsAdmin:             false,
		AdminVerified:       false,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
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
func (s *AuthService) LoginWithTokens(req models.LoginRequest, userAgent, ipAddress string) (*models.AuthResponse, error) {
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

	tokenPair, err := s.generateTokenPair(user.ID.Hex(), userAgent, ipAddress)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Token:        tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		User:         user,
	}, nil
}

// Login authenticates a user (legacy method for backward compatibility).
func (s *AuthService) Login(req models.LoginRequest) (*models.AuthResponse, error) {
	return s.LoginWithTokens(req, "", "")
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
		"exp":     time.Now().Add(time.Hour * 1).Unix(), // Сократил время жизни до 1 часа
		"iat":     time.Now().Unix(),
		"jti":     uuid.New().String(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// generateRefreshToken generates a new refresh token
func (s *AuthService) generateRefreshToken() string {
	return uuid.New().String()
}

// generateTokenPair generates both access and refresh tokens
func (s *AuthService) generateTokenPair(userID, userAgent, ipAddress string) (*models.TokenPair, error) {
	accessToken, err := s.generateJWT(userID)
	if err != nil {
		return nil, err
	}

	refreshToken := s.generateRefreshToken()

	// Сохраняем refresh token в базе данных
	collection := s.db.Collection("users")
	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}

	refreshTokenDoc := models.RefreshToken{
		Token:     refreshToken,
		ExpiresAt: time.Now().Add(time.Hour * 24 * 30), // 30 дней
		CreatedAt: time.Now(),
		UserAgent: userAgent,
		IPAddress: ipAddress,
	}

	// Удаляем старые истекшие токены и добавляем новый
	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"_id": objectID},
		bson.M{
			"$pull": bson.M{
				"refreshTokens": bson.M{
					"expiresAt": bson.M{"$lt": time.Now()},
				},
			},
		},
	)
	if err != nil {
		return nil, err
	}

	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"_id": objectID},
		bson.M{
			"$push": bson.M{
				"refreshTokens": refreshTokenDoc,
			},
			"$set": bson.M{
				"updatedAt": time.Now(),
			},
		},
	)
	if err != nil {
		return nil, err
	}

	return &models.TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

// RefreshAccessToken refreshes an access token using a refresh token
func (s *AuthService) RefreshAccessToken(refreshToken, userAgent, ipAddress string) (*models.TokenPair, error) {
	collection := s.db.Collection("users")

	// Найти пользователя с данным refresh токеном
	var user models.User
	err := collection.FindOne(
		context.Background(),
		bson.M{
			"refreshTokens": bson.M{
				"$elemMatch": bson.M{
					"token":     refreshToken,
					"expiresAt": bson.M{"$gt": time.Now()},
				},
			},
		},
	).Decode(&user)

	if err != nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	// Удалить использованный refresh token
	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"_id": user.ID},
		bson.M{
			"$pull": bson.M{
				"refreshTokens": bson.M{
					"token": refreshToken,
				},
			},
		},
	)
	if err != nil {
		return nil, err
	}

	// Создать новую пару токенов
	return s.generateTokenPair(user.ID.Hex(), userAgent, ipAddress)
}

// RevokeRefreshToken revokes a specific refresh token
func (s *AuthService) RevokeRefreshToken(userID, refreshToken string) error {
	collection := s.db.Collection("users")
	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return err
	}

	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"_id": objectID},
		bson.M{
			"$pull": bson.M{
				"refreshTokens": bson.M{
					"token": refreshToken,
				},
			},
		},
	)
	return err
}

// RevokeAllRefreshTokens revokes all refresh tokens for a user
func (s *AuthService) RevokeAllRefreshTokens(userID string) error {
	collection := s.db.Collection("users")
	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return err
	}

	_, err = collection.UpdateOne(
		context.Background(),
		bson.M{"_id": objectID},
		bson.M{
			"$set": bson.M{
				"refreshTokens": []models.RefreshToken{},
				"updatedAt":     time.Now(),
			},
		},
	)
	return err
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
	if s.baseURL != "" { // Changed from cubAPIURL to baseURL
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
				url := fmt.Sprintf("%s/reactions/remove/%s/%s", s.baseURL, r.MediaID, r.Type) // Changed from cubAPIURL to baseURL
				req, err := http.NewRequestWithContext(ctx, "POST", url, nil)                 // or "DELETE"
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
