package handlers

import (
	"net/http"
)

// GetLanguage extracts the lang parameter from request and returns it with default "ru"
// Supports both "lang" and "language" query parameters
// Valid values: "ru", "en"
// Default: "ru"
func GetLanguage(r *http.Request) string {
	// Check "lang" parameter first (our new standard)
	lang := r.URL.Query().Get("lang")
	
	// Fall back to "language" for backward compatibility
	if lang == "" {
		lang = r.URL.Query().Get("language")
	}
	
	// Default to "ru" if not specified
	if lang == "" {
		return "ru-RU"
	}
	
	// Convert short codes to TMDB format
	switch lang {
	case "en":
		return "en-US"
	case "ru":
		return "ru-RU"
	default:
		// Return as-is if already in correct format
		return lang
	}
}
