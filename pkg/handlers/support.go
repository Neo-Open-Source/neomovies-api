package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
)

type Supporter struct {
	ID            int      `json:"id"`
	Name          string   `json:"name"`
	Type          string   `json:"type"`
	Amount        *float64 `json:"amount,omitempty"`
	Currency      string   `json:"currency,omitempty"`
	Description   string   `json:"description"`
	Contributions []string `json:"contributions"`
	Year          int      `json:"year"`
	IsActive      bool     `json:"isActive"`
}

type SupportHandler struct{}

func NewSupportHandler() *SupportHandler {
	return &SupportHandler{}
}

func (h *SupportHandler) GetSupportersList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Get the path to supporters-list.json
	// It should be in the root of the project
	supportersPath := filepath.Join(".", "supporters-list.json")

	// Try to read the file
	data, err := os.ReadFile(supportersPath)
	if err != nil {
		// If file not found, return empty list
		if os.IsNotExist(err) {
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode([]Supporter{})
			return
		}
		// Other errors
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to read supporters list"})
		return
	}

	var supporters []Supporter
	if err := json.Unmarshal(data, &supporters); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to parse supporters list"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(supporters)
}
