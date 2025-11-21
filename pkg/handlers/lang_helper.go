package handlers

import (
	"net/http"
	"strings"
)

func GetLanguage(r *http.Request) string {
	lang := r.URL.Query().Get("lang")
	
	if lang == "" {
		lang = r.URL.Query().Get("language")
	}
	
	if lang == "" {
		return "ru-RU"
	}
	
	lang = strings.TrimSpace(lang)
	lang = strings.Trim(lang, "'\"")
	
	switch lang {
	case "en":
		return "en-US"
	case "ru":
		return "ru-RU"
	default:
		return lang
	}
}
