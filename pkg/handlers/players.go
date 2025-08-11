package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"

	"neomovies-api/pkg/config"
)

type PlayersHandler struct {
	cfg *config.Config
}

func NewPlayersHandler(cfg *config.Config) *PlayersHandler {
	return &PlayersHandler{cfg: cfg}
}

func (h *PlayersHandler) GetAllohaPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	imdbID := vars["imdb_id"]
	if imdbID == "" {
		http.Error(w, "imdb_id is required", http.StatusBadRequest)
		return
	}
	if h.cfg.AllohaToken == "" {
		http.Error(w, "ALLOHA_TOKEN is not configured", http.StatusServiceUnavailable)
		return
	}

	// Примерная ссылка встраивания. При необходимости скорректируйте под фактический эндпоинт Alloha
	iframeSrc := fmt.Sprintf("https://alloha.tv/embed?imdb_id=%s&token=%s", imdbID, h.cfg.AllohaToken)
	renderIframePage(w, "Alloha Player", iframeSrc)
}

func (h *PlayersHandler) GetLumexPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	imdbID := vars["imdb_id"]
	if imdbID == "" {
		http.Error(w, "imdb_id is required", http.StatusBadRequest)
		return
	}
	if h.cfg.LumexURL == "" {
		http.Error(w, "LUMEX_URL is not configured", http.StatusServiceUnavailable)
		return
	}

	// Примерная ссылка встраивания. При необходимости скорректируйте под фактический эндпоинт Lumex
	iframeSrc := fmt.Sprintf("%s/embed/%s", h.cfg.LumexURL, imdbID)
	renderIframePage(w, "Lumex Player", iframeSrc)
}

func (h *PlayersHandler) GetVibixPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	imdbID := vars["imdb_id"]
	if imdbID == "" {
		http.Error(w, "imdb_id is required", http.StatusBadRequest)
		return
	}

	if h.cfg.VibixToken == "" {
		http.Error(w, "VIBIX_TOKEN is not configured", http.StatusServiceUnavailable)
		return
	}
	vibixHost := h.cfg.VibixHost
	if vibixHost == "" {
		vibixHost = "https://vibix.org"
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/v1/publisher/videos/imdb/%s", vibixHost, imdbID), nil)
	if err != nil {
		http.Error(w, "failed to create request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.cfg.VibixToken)
	req.Header.Set("X-CSRF-TOKEN", "")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "failed to fetch player", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, "movie not found on Vibix", http.StatusNotFound)
		return
	}

	var data struct {
		ID        interface{} `json:"id"`
		IframeURL string      `json:"iframe_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		http.Error(w, "failed to parse Vibix response", http.StatusBadGateway)
		return
	}
	if data.ID == nil || data.IframeURL == "" {
		http.Error(w, "movie not found on Vibix", http.StatusNotFound)
		return
	}

	renderIframePage(w, "Vibix Player", data.IframeURL)
}

func renderIframePage(w http.ResponseWriter, title, src string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>%s</title>
<style>
  html,body{height:100%%;margin:0;background:#000;}
  iframe{width:100%%;height:100vh;border:0;}
</style>
</head>
<body>
  <iframe src="%s" allowfullscreen></iframe>
</body>
</html>`, title, src)
}