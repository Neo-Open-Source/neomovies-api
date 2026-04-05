package handlers

import (
	"encoding/json"
	"net/http"

	"neomovies-api/pkg/models"
	"neomovies-api/pkg/services"
)

type NeoIDHandler struct {
	neoIDService *services.NeoIDService
	authService  *services.AuthService
}

func NewNeoIDHandler(neoIDService *services.NeoIDService, authService *services.AuthService) *NeoIDHandler {
	return &NeoIDHandler{neoIDService: neoIDService, authService: authService}
}

// GetLoginURL returns the Neo ID login URL (for popup or redirect flow)
// POST /api/v1/auth/neo-id/login
func (h *NeoIDHandler) GetLoginURL(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RedirectURL string `json:"redirect_url"`
		State       string `json:"state"`
		Popup       bool   `json:"popup"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.RedirectURL == "" {
		http.Error(w, "redirect_url is required", http.StatusBadRequest)
		return
	}

	loginURL, err := h.neoIDService.GetLoginURL(req.RedirectURL, req.State, req.Popup)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"login_url": loginURL})
}

// Callback exchanges a Neo ID token for a local session
// POST /api/v1/auth/neo-id/callback
func (h *NeoIDHandler) Callback(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Token == "" {
		http.Error(w, "token is required", http.StatusBadRequest)
		return
	}

	// Verify token with Neo ID
	neoUser, err := h.neoIDService.VerifyToken(req.Token)
	if err != nil {
		http.Error(w, "invalid neo id token: "+err.Error(), http.StatusUnauthorized)
		return
	}

	// Get or create local user
	user, err := h.neoIDService.GetOrCreateUser(neoUser)
	if err != nil {
		http.Error(w, "failed to get or create user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Generate local token pair
	ua := r.Header.Get("User-Agent")
	ip := r.RemoteAddr
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		ip = fwd
	}

	tokenPair, err := h.authService.GenerateTokenPairPublic(user.ID.Hex(), ua, ip)
	if err != nil {
		http.Error(w, "failed to generate tokens", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"token":        tokenPair.AccessToken,
			"refreshToken": tokenPair.RefreshToken,
			"user":         user,
		},
		Message: "Login successful",
	})
}
