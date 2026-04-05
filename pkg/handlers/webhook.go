package handlers

import (
	"encoding/json"
	"net/http"

	"neomovies-api/pkg/services"
)

type WebhookHandler struct {
	authService *services.AuthService
}

func NewWebhookHandler(authService *services.AuthService) *WebhookHandler {
	return &WebhookHandler{authService: authService}
}

// NeoIDWebhook handles events from Neo ID (e.g. user disconnected service)
// POST /api/v1/webhooks/neo-id
func (h *WebhookHandler) NeoIDWebhook(w http.ResponseWriter, r *http.Request) {
	var event struct {
		Event     string `json:"event"`
		UnifiedID string `json:"unified_id"`
		Email     string `json:"email"`
		Service   string `json:"service"`
	}
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	switch event.Event {
	case "user.disconnected":
		// User disconnected NeoMovies from Neo ID — delete their account
		if event.UnifiedID == "" && event.Email == "" {
			http.Error(w, "unified_id or email required", http.StatusBadRequest)
			return
		}

		var userID string
		if event.UnifiedID != "" {
			u, err := h.authService.GetUserByNeoID(event.UnifiedID)
			if err == nil && u != nil {
				userID = u.ID.Hex()
			}
		}
		if userID == "" && event.Email != "" {
			u, err := h.authService.GetUserByEmailPublic(event.Email)
			if err == nil && u != nil {
				userID = u.ID.Hex()
			}
		}

		if userID != "" {
			_ = h.authService.DeleteAccount(r.Context(), userID)
		}
	}

	w.WriteHeader(http.StatusOK)
}
