package handlers

import (
	"log"
	"net/http"
	"strings"
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
	
	// Sanitize - remove any quotes or suspicious characters
	lang = strings.TrimSpace(lang)
	lang = strings.Trim(lang, "'\"")
	
	if lang != r.URL.Query().Get("language") && lang != r.URL.Query().Get("lang") {
		log.Printf("[GetLanguage] Sanitized language parameter from %s to %s", r.URL.Query().Get("language"), lang)
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
