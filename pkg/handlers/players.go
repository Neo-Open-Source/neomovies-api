package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"neomovies-api/pkg/config"
	"neomovies-api/pkg/players"
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
		Data   struct {
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

	// Получаем параметры для сериалов
	season := r.URL.Query().Get("season")
	episode := r.URL.Query().Get("episode")
	translation := r.URL.Query().Get("translation")
	if translation == "" {
		translation = "66" // дефолтная озвучка
	}

	// Используем iframe URL из API
	iframeCode := allohaResponse.Data.Iframe
	
	// Если это не HTML код, а просто URL
	var playerURL string
	if !strings.Contains(iframeCode, "<") {
		playerURL = iframeCode
		// Добавляем параметры для сериалов
		if season != "" && episode != "" {
			separator := "?"
			if strings.Contains(playerURL, "?") {
				separator = "&"
			}
			playerURL = fmt.Sprintf("%s%sseason=%s&episode=%s&translation=%s", playerURL, separator, season, episode, translation)
		}
		iframeCode = fmt.Sprintf(`<iframe src="%s" allowfullscreen style="border:none;width:100%%;height:100%%"></iframe>`, playerURL)
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

	// Получаем параметры для сериалов
	season := r.URL.Query().Get("season")
	episode := r.URL.Query().Get("episode")

	playerURL := fmt.Sprintf("%s?imdb_id=%s", h.config.LumexURL, url.QueryEscape(imdbID))
	if season != "" && episode != "" {
		playerURL = fmt.Sprintf("%s&season=%s&episode=%s", playerURL, season, episode)
	}
	log.Printf("Generated Lumex URL: %s", playerURL)
	url := playerURL

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

	// Получаем параметры для сериалов
	season := r.URL.Query().Get("season")
	episode := r.URL.Query().Get("episode")

	// Строим итоговый URL плеера
	playerURL := vibixResponse.IframeURL
	if season != "" && episode != "" {
		// Добавляем параметры сезона и серии
		separator := "?"
		if strings.Contains(playerURL, "?") {
			separator = "&"
		}
		playerURL = fmt.Sprintf("%s%sseason=%s&episode=%s", playerURL, separator, season, episode)
	}

	log.Printf("Generated Vibix iframe URL: %s", playerURL)

	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, playerURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Vibix Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))

	log.Printf("Successfully served Vibix player for imdb_id: %s", imdbID)
}

// GetRgShowsPlayer handles RgShows streaming requests
func (h *PlayersHandler) GetRgShowsPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetRgShowsPlayer called: %s %s", r.Method, r.URL.Path)

	vars := mux.Vars(r)
	tmdbID := vars["tmdb_id"]
	if tmdbID == "" {
		log.Printf("Error: tmdb_id is empty")
		http.Error(w, "tmdb_id path param is required", http.StatusBadRequest)
		return
	}

	log.Printf("Processing tmdb_id: %s", tmdbID)

	pm := players.NewPlayersManager()
	result, err := pm.GetMovieStreamByProvider("rgshows", tmdbID)
	if err != nil {
		log.Printf("Error getting RgShows stream: %v", err)
		http.Error(w, "Failed to get stream", http.StatusInternalServerError)
		return
	}

	if !result.Success {
		log.Printf("RgShows stream not found: %s", result.Error)
		http.Error(w, "Stream not found", http.StatusNotFound)
		return
	}

	// Create iframe with the stream URL
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, result.StreamURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>RgShows Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))

	log.Printf("Successfully served RgShows player for tmdb_id: %s", tmdbID)
}

// GetRgShowsTVPlayer handles RgShows TV show streaming requests
func (h *PlayersHandler) GetRgShowsTVPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetRgShowsTVPlayer called: %s %s", r.Method, r.URL.Path)

	vars := mux.Vars(r)
	tmdbID := vars["tmdb_id"]
	seasonStr := vars["season"]
	episodeStr := vars["episode"]

	if tmdbID == "" || seasonStr == "" || episodeStr == "" {
		log.Printf("Error: missing required parameters")
		http.Error(w, "tmdb_id, season, and episode path params are required", http.StatusBadRequest)
		return
	}

	season, err := strconv.Atoi(seasonStr)
	if err != nil {
		log.Printf("Error parsing season: %v", err)
		http.Error(w, "Invalid season number", http.StatusBadRequest)
		return
	}

	episode, err := strconv.Atoi(episodeStr)
	if err != nil {
		log.Printf("Error parsing episode: %v", err)
		http.Error(w, "Invalid episode number", http.StatusBadRequest)
		return
	}

	log.Printf("Processing tmdb_id: %s, season: %d, episode: %d", tmdbID, season, episode)

	pm := players.NewPlayersManager()
	result, err := pm.GetTVStreamByProvider("rgshows", tmdbID, season, episode)
	if err != nil {
		log.Printf("Error getting RgShows TV stream: %v", err)
		http.Error(w, "Failed to get stream", http.StatusInternalServerError)
		return
	}

	if !result.Success {
		log.Printf("RgShows TV stream not found: %s", result.Error)
		http.Error(w, "Stream not found", http.StatusNotFound)
		return
	}

	// Create iframe with the stream URL
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, result.StreamURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>RgShows TV Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))

	log.Printf("Successfully served RgShows TV player for tmdb_id: %s, S%dE%d", tmdbID, season, episode)
}

// GetIframeVideoPlayer handles IframeVideo streaming requests
func (h *PlayersHandler) GetIframeVideoPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetIframeVideoPlayer called: %s %s", r.Method, r.URL.Path)

	vars := mux.Vars(r)
	kinopoiskID := vars["kinopoisk_id"]
	imdbID := vars["imdb_id"]

	if kinopoiskID == "" && imdbID == "" {
		log.Printf("Error: both kinopoisk_id and imdb_id are empty")
		http.Error(w, "Either kinopoisk_id or imdb_id path param is required", http.StatusBadRequest)
		return
	}

	log.Printf("Processing kinopoisk_id: %s, imdb_id: %s", kinopoiskID, imdbID)

	pm := players.NewPlayersManager()
	result, err := pm.GetStreamWithKinopoisk(kinopoiskID, imdbID)
	if err != nil {
		log.Printf("Error getting IframeVideo stream: %v", err)
		http.Error(w, "Failed to get stream", http.StatusInternalServerError)
		return
	}

	if !result.Success {
		log.Printf("IframeVideo stream not found: %s", result.Error)
		http.Error(w, "Stream not found", http.StatusNotFound)
		return
	}

	// Create iframe with the stream URL
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, result.StreamURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>IframeVideo Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))

	log.Printf("Successfully served IframeVideo player for kinopoisk_id: %s, imdb_id: %s", kinopoiskID, imdbID)
}

// GetStreamAPI returns stream information as JSON API
func (h *PlayersHandler) GetStreamAPI(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetStreamAPI called: %s %s", r.Method, r.URL.Path)

	vars := mux.Vars(r)
	provider := vars["provider"]
	tmdbID := vars["tmdb_id"]

	if provider == "" || tmdbID == "" {
		log.Printf("Error: missing required parameters")
		http.Error(w, "provider and tmdb_id path params are required", http.StatusBadRequest)
		return
	}

	// Check for TV show parameters
	seasonStr := r.URL.Query().Get("season")
	episodeStr := r.URL.Query().Get("episode")
	kinopoiskID := r.URL.Query().Get("kinopoisk_id")
	imdbID := r.URL.Query().Get("imdb_id")

	log.Printf("Processing provider: %s, tmdb_id: %s", provider, tmdbID)

	pm := players.NewPlayersManager()
	var result *players.StreamResult
	var err error

	switch provider {
	case "iframevideo":
		if kinopoiskID == "" && imdbID == "" {
			http.Error(w, "kinopoisk_id or imdb_id query param is required for IframeVideo", http.StatusBadRequest)
			return
		}
		result, err = pm.GetStreamWithKinopoisk(kinopoiskID, imdbID)
	case "rgshows":
		if seasonStr != "" && episodeStr != "" {
			season, err1 := strconv.Atoi(seasonStr)
			episode, err2 := strconv.Atoi(episodeStr)
			if err1 != nil || err2 != nil {
				http.Error(w, "Invalid season or episode number", http.StatusBadRequest)
				return
			}
			result, err = pm.GetTVStreamByProvider("rgshows", tmdbID, season, episode)
		} else {
			result, err = pm.GetMovieStreamByProvider("rgshows", tmdbID)
		}
	default:
		http.Error(w, "Unsupported provider", http.StatusBadRequest)
		return
	}

	if err != nil {
		log.Printf("Error getting stream from %s: %v", provider, err)
		result = &players.StreamResult{
			Success:  false,
			Provider: provider,
			Error:    err.Error(),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)

	log.Printf("Successfully served stream API for provider: %s, tmdb_id: %s", provider, tmdbID)
}

// GetVidsrcPlayer handles Vidsrc.to player (uses IMDb ID for both movies and TV shows)
func (h *PlayersHandler) GetVidsrcPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetVidsrcPlayer called: %s %s", r.Method, r.URL.Path)
	
	vars := mux.Vars(r)
	imdbId := vars["imdb_id"]
	mediaType := vars["media_type"] // "movie" or "tv"
	
	if imdbId == "" || mediaType == "" {
		http.Error(w, "imdb_id and media_type are required", http.StatusBadRequest)
		return
	}
	
	var playerURL string
	if mediaType == "movie" {
		playerURL = fmt.Sprintf("https://vidsrc.to/embed/movie/%s", imdbId)
	} else if mediaType == "tv" {
		season := r.URL.Query().Get("season")
		episode := r.URL.Query().Get("episode")
		if season == "" || episode == "" {
			http.Error(w, "season and episode are required for TV shows", http.StatusBadRequest)
			return
		}
		playerURL = fmt.Sprintf("https://vidsrc.to/embed/tv/%s/%s/%s", imdbId, season, episode)
	} else {
		http.Error(w, "Invalid media_type. Use 'movie' or 'tv'", http.StatusBadRequest)
		return
	}
	
	log.Printf("Generated Vidsrc URL: %s", playerURL)
	
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, playerURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Vidsrc Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)
	
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
	
	log.Printf("Successfully served Vidsrc player for %s: %s", mediaType, imdbId)
}

// GetVidlinkMoviePlayer handles vidlink.pro player for movies (uses IMDb ID)
func (h *PlayersHandler) GetVidlinkMoviePlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetVidlinkMoviePlayer called: %s %s", r.Method, r.URL.Path)
	
	vars := mux.Vars(r)
	imdbId := vars["imdb_id"]
	
	if imdbId == "" {
		http.Error(w, "imdb_id is required", http.StatusBadRequest)
		return
	}
	
	playerURL := fmt.Sprintf("https://vidlink.pro/movie/%s", imdbId)
	
	log.Printf("Generated Vidlink Movie URL: %s", playerURL)
	
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, playerURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Vidlink Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)
	
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
	
	log.Printf("Successfully served Vidlink movie player: %s", imdbId)
}

// GetVidlinkTVPlayer handles vidlink.pro player for TV shows (uses TMDB ID)
func (h *PlayersHandler) GetVidlinkTVPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetVidlinkTVPlayer called: %s %s", r.Method, r.URL.Path)
	
	vars := mux.Vars(r)
	tmdbId := vars["tmdb_id"]
	
	if tmdbId == "" {
		http.Error(w, "tmdb_id is required", http.StatusBadRequest)
		return
	}
	
	season := r.URL.Query().Get("season")
	episode := r.URL.Query().Get("episode")
	if season == "" || episode == "" {
		http.Error(w, "season and episode are required for TV shows", http.StatusBadRequest)
		return
	}
	
	playerURL := fmt.Sprintf("https://vidlink.pro/tv/%s/%s/%s", tmdbId, season, episode)
	
	log.Printf("Generated Vidlink TV URL: %s", playerURL)
	
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, playerURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Vidlink Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)
	
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
	
	log.Printf("Successfully served Vidlink TV player: %s S%sE%s", tmdbId, season, episode)
}
