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

// Default supporters data (used as fallback on Vercel)
var defaultSupporters = []Supporter{
	{
		ID:          1,
		Name:        "Sophron Ragozin",
		Type:        "service",
		Description: "Покупка и продления основного домена neomovies.ru",
		Contributions: []string{
			"Домен neomovies.ru",
		},
		Year:     2025,
		IsActive: true,
	},
	{
		ID:          2,
		Name:        "Chernuha",
		Type:        "service",
		Description: "Покупка домена neomovies.run",
		Contributions: []string{
			"Домен neomovies.run",
		},
		Year:     2025,
		IsActive: true,
	},
	{
		ID:          3,
		Name:        "Iwnuply",
		Type:        "code",
		Description: "Создание докер контейнера для API и Frontend",
		Contributions: []string{
			"Docker",
		},
		Year:     2025,
		IsActive: true,
	},
}

func (h *SupportHandler) GetSupportersList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Try to read from file first
	supportersPath := filepath.Join(".", "supporters-list.json")
	data, err := os.ReadFile(supportersPath)

	// If file not found or error reading, use default data
	if err != nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(defaultSupporters)
		return
	}

	var supporters []Supporter
	if err := json.Unmarshal(data, &supporters); err != nil {
		// If parsing fails, use default data
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(defaultSupporters)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(supporters)
}
