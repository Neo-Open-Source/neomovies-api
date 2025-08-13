package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"neomovies-api/pkg/config"
	"github.com/gorilla/mux"
)

type PlayersHandler struct {
	config *config.Config
}

func NewPlayersHandler(cfg *config.Config) *PlayersHandler {
	return &PlayersHandler{
		config: cfg,
	}
}

func (h *PlayersHandler) GetAllohaPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetAllohaPlayer called: %s %s", r.Method, r.URL.Path)
	
	vars := mux.Vars(r)
	log.Printf("Route vars: %+v", vars)
	
	imdbID := vars["imdb_id"]
	if imdbID == "" {
		log.Printf("Error: imdb_id is empty")
		http.Error(w, "imdb_id path param is required", http.StatusBadRequest)
		return
	}
	
	log.Printf("Processing imdb_id: %s", imdbID)
	
	if h.config.AllohaToken == "" {
		log.Printf("Error: ALLOHA_TOKEN is missing")
		http.Error(w, "Server misconfiguration: ALLOHA_TOKEN missing", http.StatusInternalServerError)
		return
	}
	
	idParam := fmt.Sprintf("imdb=%s", url.QueryEscape(imdbID))
	apiURL := fmt.Sprintf("https://api.alloha.tv/?token=%s&%s", h.config.AllohaToken, idParam)
	log.Printf("Calling Alloha API: %s", apiURL)
	
	resp, err := http.Get(apiURL)
	if err != nil {
		log.Printf("Error calling Alloha API: %v", err)
		http.Error(w, "Failed to fetch from Alloha API", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()
	
	log.Printf("Alloha API response status: %d", resp.StatusCode)
	
	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Alloha API error: %d", resp.StatusCode), http.StatusBadGateway)
		return
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading Alloha response: %v", err)
		http.Error(w, "Failed to read Alloha response", http.StatusInternalServerError)
		return
	}
	
	log.Printf("Alloha API response body: %s", string(body))
	
	var allohaResponse struct {
		Status string `json:"status"`
		Data struct {
			Iframe string `json:"iframe"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(body, &allohaResponse); err != nil {
		log.Printf("Error unmarshaling JSON: %v", err)
		http.Error(w, "Invalid JSON from Alloha", http.StatusBadGateway)
		return
	}
	
	if allohaResponse.Status != "success" || allohaResponse.Data.Iframe == "" {
		log.Printf("Video not found or empty iframe")
		http.Error(w, "Video not found", http.StatusNotFound)
		return
	}
	
	iframeCode := allohaResponse.Data.Iframe
	if !strings.Contains(iframeCode, "<") {
		iframeCode = fmt.Sprintf(`<iframe src="%s" allowfullscreen style="border:none;width:100%%;height:100%%"></iframe>`, iframeCode)
	}
	
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Alloha Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframeCode)
	
	// Авто-исправление экранированных кавычек
	htmlDoc = strings.ReplaceAll(htmlDoc, `\"`, `"`)
	htmlDoc = strings.ReplaceAll(htmlDoc, `\'`, `'`)
	
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
	
	log.Printf("Successfully served Alloha player for imdb_id: %s", imdbID)
}

func (h *PlayersHandler) GetLumexPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetLumexPlayer called: %s %s", r.Method, r.URL.Path)
	
	vars := mux.Vars(r)
	log.Printf("Route vars: %+v", vars)
	
	imdbID := vars["imdb_id"]
	if imdbID == "" {
		log.Printf("Error: imdb_id is empty")
		http.Error(w, "imdb_id path param is required", http.StatusBadRequest)
		return
	}
	
	log.Printf("Processing imdb_id: %s", imdbID)
	
	if h.config.LumexURL == "" {
		log.Printf("Error: LUMEX_URL is missing")
		http.Error(w, "Server misconfiguration: LUMEX_URL missing", http.StatusInternalServerError)
		return
	}
	
	url := fmt.Sprintf("%s?imdb_id=%s", h.config.LumexURL, url.QueryEscape(imdbID))
	log.Printf("Generated Lumex URL: %s", url)
	
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, url)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Lumex Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)
	
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
	
	log.Printf("Successfully served Lumex player for imdb_id: %s", imdbID)
}

func (h *PlayersHandler) GetVibixPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetVibixPlayer called: %s %s", r.Method, r.URL.Path)
	
	vars := mux.Vars(r)
	log.Printf("Route vars: %+v", vars)
	
	imdbID := vars["imdb_id"]
	if imdbID == "" {
		log.Printf("Error: imdb_id is empty")
		http.Error(w, "imdb_id path param is required", http.StatusBadRequest)
		return
	}
	
	log.Printf("Processing imdb_id: %s", imdbID)

	if h.config.VibixToken == "" {
		log.Printf("Error: VIBIX_TOKEN is missing")
		http.Error(w, "Server misconfiguration: VIBIX_TOKEN missing", http.StatusInternalServerError)
		return
	}
	
	vibixHost := h.config.VibixHost
	if vibixHost == "" {
		vibixHost = "https://vibix.org"
	}

	apiURL := fmt.Sprintf("%s/api/v1/publisher/videos/imdb/%s", vibixHost, imdbID)
	log.Printf("Calling Vibix API: %s", apiURL)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		log.Printf("Error creating Vibix request: %v", err)
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.config.VibixToken)
	req.Header.Set("X-CSRF-TOKEN", "")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error calling Vibix API: %v", err)
		http.Error(w, "Failed to fetch from Vibix API", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	log.Printf("Vibix API response status: %d", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		log.Printf("Vibix API error: %d", resp.StatusCode)
		http.Error(w, fmt.Sprintf("Vibix API error: %d", resp.StatusCode), http.StatusBadGateway)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading Vibix response: %v", err)
		http.Error(w, "Failed to read Vibix response", http.StatusInternalServerError)
		return
	}
	
	log.Printf("Vibix API response body: %s", string(body))

	var vibixResponse struct {
		ID        interface{} `json:"id"`
		IframeURL string      `json:"iframe_url"`
	}
	
	if err := json.Unmarshal(body, &vibixResponse); err != nil {
		log.Printf("Error unmarshaling Vibix JSON: %v", err)
		http.Error(w, "Invalid JSON from Vibix", http.StatusBadGateway)
		return
	}
	
	if vibixResponse.ID == nil || vibixResponse.IframeURL == "" {
		log.Printf("Video not found or empty iframe_url")
		http.Error(w, "Video not found", http.StatusNotFound)
		return
	}

	log.Printf("Generated Vibix iframe URL: %s", vibixResponse.IframeURL)
	
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, vibixResponse.IframeURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Vibix Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)
	
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
	
	log.Printf("Successfully served Vibix player for imdb_id: %s", imdbID)
}