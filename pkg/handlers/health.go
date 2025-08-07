package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"neomovies-api/pkg/models"
)

func HealthCheck(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":    "OK",
		"timestamp": time.Now().UTC(),
		"service":   "neomovies-api",
		"version":   "2.0.0",
		"uptime":    time.Since(startTime),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Message: "API is running",
		Data:    health,
	})
}

var startTime = time.Now()