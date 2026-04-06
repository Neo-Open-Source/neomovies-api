package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	"neomovies-api/pkg/models"
)

// NeoIDService handles Neo ID integration
type NeoIDService struct {
	db         *mongo.Database
	neoIDURL   string
	apiKey     string
	siteID     string
	jwtSecret  string
	httpClient *http.Client
}

func NewNeoIDService(db *mongo.Database, neoIDURL, apiKey, siteID, jwtSecret string) *NeoIDService {
	return &NeoIDService{
		db:         db,
		neoIDURL:   strings.TrimRight(neoIDURL, "/"),
		apiKey:     apiKey,
		siteID:     siteID,
		jwtSecret:  jwtSecret,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type NeoIDUser struct {
	UnifiedID   string `json:"unified_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Avatar      string `json:"avatar"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
}

// VerifyToken verifies a Neo ID access token and returns user info
// Uses /api/service/verify which accepts standard Neo ID access tokens
func (s *NeoIDService) VerifyToken(token string) (*NeoIDUser, error) {
	// First try /api/service/verify (standard endpoint)
	user, err := s.verifyViaAPI(token)
	if err == nil {
		return user, nil
	}

	// Fallback: decode JWT directly (works when JWT_SECRET is shared)
	return s.verifyViaJWT(token)
}

func (s *NeoIDService) verifyViaAPI(token string) (*NeoIDUser, error) {
	body := `{"token":"` + token + `"}`
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost,
		s.neoIDURL+"/api/service/verify",
		strings.NewReader(body),
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("X-API-Key", s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("neo id verify request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("neo id verify returned %d", resp.StatusCode)
	}

	var result struct {
		Valid bool       `json:"valid"`
		User  *NeoIDUser `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if !result.Valid || result.User == nil {
		return nil, fmt.Errorf("invalid token")
	}
	return result.User, nil
}

func (s *NeoIDService) verifyViaJWT(token string) (*NeoIDUser, error) {
	// Try /oauth/userinfo with the token as Bearer
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet,
		s.neoIDURL+"/oauth/userinfo",
		nil,
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("userinfo request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo returned %d", resp.StatusCode)
	}

	var claims struct {
		Sub        string `json:"sub"`
		Email      string `json:"email"`
		Name       string `json:"name"`
		GivenName  string `json:"given_name"`
		FamilyName string `json:"family_name"`
		Picture    string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		return nil, err
	}
	if claims.Sub == "" {
		return nil, fmt.Errorf("no sub in userinfo")
	}
	return &NeoIDUser{
		UnifiedID:   claims.Sub,
		Email:       claims.Email,
		DisplayName: claims.Name,
		Avatar:      claims.Picture,
		FirstName:   claims.GivenName,
		LastName:    claims.FamilyName,
	}, nil
}

// GetOrCreateUser finds or creates a local user from Neo ID user info
func (s *NeoIDService) GetOrCreateUser(neoUser *NeoIDUser) (*models.User, error) {
	collection := s.db.Collection("users")
	ctx := context.Background()

	// Try by neo_id (unified_id)
	var user models.User
	err := collection.FindOne(ctx, bson.M{"neoId": neoUser.UnifiedID}).Decode(&user)
	if err == nil {
		// Update avatar/name if changed
		update := bson.M{"updatedAt": time.Now()}
		if neoUser.Avatar != "" && user.Avatar != neoUser.Avatar {
			update["avatar"] = neoUser.Avatar
		}
		name := neoUser.DisplayName
		if name == "" {
			name = neoUser.FirstName + " " + neoUser.LastName
		}
		if name != "" && strings.TrimSpace(name) != "" && user.Name != strings.TrimSpace(name) {
			update["name"] = strings.TrimSpace(name)
		}
		_, _ = collection.UpdateOne(ctx, bson.M{"neoId": neoUser.UnifiedID}, bson.M{"$set": update})
		return &user, nil
	}

	// Try by email
	if neoUser.Email != "" {
		err = collection.FindOne(ctx, bson.M{"email": neoUser.Email}).Decode(&user)
		if err == nil {
			// Link neo id
			_, _ = collection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": bson.M{
				"neoId":     neoUser.UnifiedID,
				"updatedAt": time.Now(),
			}})
			return &user, nil
		}
	}

	// Create new user
	name := neoUser.DisplayName
	if name == "" {
		name = strings.TrimSpace(neoUser.FirstName + " " + neoUser.LastName)
	}
	if name == "" && neoUser.Email != "" {
		name = strings.Split(neoUser.Email, "@")[0]
	}

	newUser := models.User{
		ID:        primitive.NewObjectID(),
		Email:     neoUser.Email,
		Name:      name,
		Avatar:    neoUser.Avatar,
		NeoID:     neoUser.UnifiedID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if _, err := collection.InsertOne(ctx, newUser); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return &newUser, nil
}

// GetLoginURL returns the Neo ID login URL for popup mode
func (s *NeoIDService) GetLoginURL(redirectURL, state string, popup bool) (string, error) {
	if s.apiKey == "" {
		return "", fmt.Errorf("NEO_ID_API_KEY not configured")
	}

	body := fmt.Sprintf(`{"redirect_url":%q,"state":%q,"mode":%q}`,
		redirectURL, state, map[bool]string{true: "popup", false: "redirect"}[popup])

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost,
		s.neoIDURL+"/api/service/login",
		strings.NewReader(body),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("neo id login request failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		LoginURL string `json:"login_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.LoginURL == "" {
		return "", fmt.Errorf("no login_url returned")
	}

	// Make absolute if relative
	if strings.HasPrefix(result.LoginURL, "/") {
		return s.neoIDURL + result.LoginURL, nil
	}
	return result.LoginURL, nil
}

// NotifyUserDeleted tells Neo ID that a user deleted their NeoMovies account.
// Neo ID can use this to remove the service from the user's connected list.
func (s *NeoIDService) NotifyUserDeleted(neoUnifiedID, email string) {
	if s.apiKey == "" || s.neoIDURL == "" {
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"event":      "user.deleted",
		"unified_id": neoUnifiedID,
		"email":      email,
	})
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost,
		s.neoIDURL+"/api/service/user-deleted",
		strings.NewReader(string(payload)),
	)
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	resp, err := s.httpClient.Do(req)
	if err == nil {
		resp.Body.Close()
	}
}
