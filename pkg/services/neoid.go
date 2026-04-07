package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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
// Uses /api/service/verify which accepts service-scoped Neo ID access tokens.
func (s *NeoIDService) VerifyToken(token string) (*NeoIDUser, error) {
	return s.verifyViaAPI(token)
}

func (s *NeoIDService) verifyViaAPI(token string) (*NeoIDUser, error) {
	body := fmt.Sprintf(`{"token":%q}`, token)
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
		raw, _ := io.ReadAll(resp.Body)
		msg := strings.TrimSpace(string(raw))
		if len(msg) > 500 {
			msg = msg[:500] + "..."
		}
		return nil, fmt.Errorf("neo id verify returned %d: %s", resp.StatusCode, msg)
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

// VerifyTokenWithRefresh verifies a service access token and automatically refreshes it when needed.
// Returns user plus potentially rotated service tokens.
func (s *NeoIDService) VerifyTokenWithRefresh(accessToken, refreshToken string) (*NeoIDUser, string, string, error) {
	user, err := s.verifyViaAPI(accessToken)
	if err == nil {
		return user, accessToken, refreshToken, nil
	}

	if strings.TrimSpace(refreshToken) == "" {
		return nil, "", "", err
	}

	newAccess, newRefresh, refreshErr := s.refreshServiceToken(refreshToken)
	if refreshErr != nil {
		return nil, "", "", fmt.Errorf("verify failed: %v; refresh failed: %w", err, refreshErr)
	}

	user, verifyErr := s.verifyViaAPI(newAccess)
	if verifyErr != nil {
		return nil, "", "", fmt.Errorf("verify after refresh failed: %w", verifyErr)
	}

	return user, newAccess, newRefresh, nil
}

func (s *NeoIDService) refreshServiceToken(refreshToken string) (string, string, error) {
	body := fmt.Sprintf(`{"refresh_token":%q}`, refreshToken)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost,
		s.neoIDURL+"/api/service/refresh",
		strings.NewReader(body),
	)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("X-API-Key", s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("neo id refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		msg := strings.TrimSpace(string(raw))
		if len(msg) > 500 {
			msg = msg[:500] + "..."
		}
		return "", "", fmt.Errorf("neo id refresh returned %d: %s", resp.StatusCode, msg)
	}

	var out struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", "", err
	}
	if out.AccessToken == "" {
		return "", "", fmt.Errorf("neo id refresh returned empty access_token")
	}
	if out.RefreshToken == "" {
		out.RefreshToken = refreshToken
	}
	return out.AccessToken, out.RefreshToken, nil
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
	req.Header.Set("X-API-Key", s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("neo id login request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		msg := strings.TrimSpace(string(respBody))
		if len(msg) > 500 {
			msg = msg[:500] + "..."
		}
		return "", fmt.Errorf("neo id login returned %d: %s", resp.StatusCode, msg)
	}

	var result struct {
		LoginURL string `json:"login_url"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}
	if result.LoginURL == "" {
		msg := strings.TrimSpace(string(respBody))
		if len(msg) > 500 {
			msg = msg[:500] + "..."
		}
		return "", fmt.Errorf("no login_url returned, response: %s", msg)
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
