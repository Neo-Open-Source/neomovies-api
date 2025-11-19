package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
    "sort"
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
    idType := vars["id_type"]
	id := vars["id"]

	if idType == "" || id == "" {
		log.Printf("Error: id_type or id is empty")
		http.Error(w, "id_type and id are required", http.StatusBadRequest)
		return
	}

    if idType == "kinopoisk_id" { idType = "kp" }
    if idType != "kp" && idType != "imdb" {
		log.Printf("Error: invalid id_type: %s", idType)
        http.Error(w, "id_type must be 'kp' (kinopoisk_id) or 'imdb'", http.StatusBadRequest)
		return
	}

	log.Printf("Processing %s ID: %s", idType, id)

	if h.config.AllohaToken == "" {
		log.Printf("Error: ALLOHA_TOKEN is missing")
		http.Error(w, "Server misconfiguration: ALLOHA_TOKEN missing", http.StatusInternalServerError)
		return
	}

	idParam := fmt.Sprintf("%s=%s", idType, url.QueryEscape(id))
	apiURL := fmt.Sprintf("https://api.alloha.tv/?token=%s&%s", h.config.AllohaToken, idParam)
	log.Printf("Calling Alloha API: %s", apiURL)

    client := &http.Client{Timeout: 8 * time.Second}
    resp, err := client.Get(apiURL)
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

	log.Printf("Successfully served Alloha player for %s: %s", idType, id)
}

// GetAllohaMetaByKP returns seasons/episodes meta for Alloha by kinopoisk_id
func (h *PlayersHandler) GetAllohaMetaByKP(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    kpID := vars["kp_id"]
    if strings.TrimSpace(kpID) == "" {
        http.Error(w, "kp_id is required", http.StatusBadRequest)
        return
    }
    if h.config.AllohaToken == "" {
        http.Error(w, "Server misconfiguration: ALLOHA_TOKEN missing", http.StatusInternalServerError)
        return
    }

    apiURL := fmt.Sprintf("https://api.alloha.tv/?token=%s&kp=%s", url.QueryEscape(h.config.AllohaToken), url.QueryEscape(kpID))
    client := &http.Client{Timeout: 8 * time.Second}
    resp, err := client.Get(apiURL)
    if err != nil {
        http.Error(w, "Failed to fetch from Alloha API", http.StatusBadGateway)
        return
    }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK {
        http.Error(w, fmt.Sprintf("Alloha API error: %d", resp.StatusCode), http.StatusBadGateway)
        return
    }
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        http.Error(w, "Failed to read Alloha response", http.StatusBadGateway)
        return
    }

    // Define only the parts we need (map-based structure as в примере)
    var raw struct {
        Status string `json:"status"`
        Data   struct {
            SeasonsCount int `json:"seasons_count"`
            Seasons      map[string]struct {
                Season   int `json:"season"`
                Episodes map[string]struct {
                    Episode     int                              `json:"episode"`
                    Translation map[string]struct {
                        Translation string `json:"translation"`
                        Name        string `json:"name"`
                    } `json:"translation"`
                } `json:"episodes"`
            } `json:"seasons"`
        } `json:"data"`
    }

    if err := json.Unmarshal(body, &raw); err != nil {
        http.Error(w, "Invalid JSON from Alloha", http.StatusBadGateway)
        return
    }

    type episodeMeta struct {
        Episode      int      `json:"episode"`
        Translations []string `json:"translations"`
    }
    type seasonMeta struct {
        Season   int           `json:"season"`
        Episodes []episodeMeta `json:"episodes"`
    }
    out := struct {
        Success bool         `json:"success"`
        Seasons []seasonMeta `json:"seasons"`
    }{Success: true, Seasons: make([]seasonMeta, 0)}

    if raw.Status == "success" && len(raw.Data.Seasons) > 0 {
        // sort seasons by numeric key
        seasonKeys := make([]int, 0, len(raw.Data.Seasons))
        for k := range raw.Data.Seasons {
            if n, err := strconv.Atoi(strings.TrimSpace(k)); err == nil {
                seasonKeys = append(seasonKeys, n)
            }
        }
        sort.Ints(seasonKeys)

        for _, sn := range seasonKeys {
            s := raw.Data.Seasons[strconv.Itoa(sn)]
            sm := seasonMeta{Season: sn}

            // sort episodes by numeric key
            epKeys := make([]int, 0, len(s.Episodes))
            for ek := range s.Episodes {
                if en, err := strconv.Atoi(strings.TrimSpace(ek)); err == nil {
                    epKeys = append(epKeys, en)
                }
            }
            sort.Ints(epKeys)

            for _, en := range epKeys {
                e := s.Episodes[strconv.Itoa(en)]
                em := episodeMeta{Episode: en}
                // collect translations
                for _, tr := range e.Translation {
                    t := strings.TrimSpace(tr.Translation)
                    if t == "" {
                        t = strings.TrimSpace(tr.Name)
                    }
                    if t != "" {
                        em.Translations = append(em.Translations, t)
                    }
                }
                sm.Episodes = append(sm.Episodes, em)
            }

            out.Seasons = append(out.Seasons, sm)
        }
    }

    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(out)
}

func (h *PlayersHandler) GetLumexPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetLumexPlayer called: %s %s", r.Method, r.URL.Path)

	vars := mux.Vars(r)
	idType := vars["id_type"]
	id := vars["id"]

	if idType == "" || id == "" {
		log.Printf("Error: id_type or id is empty")
		http.Error(w, "id_type and id are required", http.StatusBadRequest)
		return
	}

    // Поддержка алиаса
    if idType == "kinopoisk_id" { idType = "kp" }
    if idType != "kp" && idType != "imdb" {
		log.Printf("Error: invalid id_type: %s", idType)
		http.Error(w, "id_type must be 'kp' or 'imdb'", http.StatusBadRequest)
		return
	}

	log.Printf("Processing %s ID: %s", idType, id)

    if h.config.LumexURL == "" {
        log.Printf("Error: LUMEX_URL is missing")
        http.Error(w, "Server misconfiguration: LUMEX_URL missing", http.StatusInternalServerError)
        return
    }

    // Встраивание напрямую через p.lumex.cloud: <iframe src="//p.lumex.cloud/<code>?kp_id=...">
    // Ожидается, что LUMEX_URL задаёт базу вида: https://p.lumex.cloud/<code>
    var paramName string
    if idType == "kp" {
        paramName = "kp_id"
    } else {
        paramName = "imdb_id"
    }

    separator := "?"
    if strings.Contains(h.config.LumexURL, "?") {
        separator = "&"
    }
    playerURL := fmt.Sprintf("%s%s%s=%s", h.config.LumexURL, separator, paramName, url.QueryEscape(id))
	log.Printf("Lumex URL: %s", playerURL)

	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, playerURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Lumex Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))

	log.Printf("Successfully served Lumex player for %s: %s", idType, id)
}

func (h *PlayersHandler) GetVibixPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetVibixPlayer called: %s %s", r.Method, r.URL.Path)

	vars := mux.Vars(r)
	idType := vars["id_type"]
	id := vars["id"]

	if idType == "" || id == "" {
		log.Printf("Error: id_type or id is empty")
		http.Error(w, "id_type and id are required", http.StatusBadRequest)
		return
	}

	if idType != "kp" && idType != "imdb" {
		log.Printf("Error: invalid id_type: %s", idType)
		http.Error(w, "id_type must be 'kp' or 'imdb'", http.StatusBadRequest)
		return
	}

	log.Printf("Processing %s ID: %s", idType, id)

	if h.config.VibixToken == "" {
		log.Printf("Error: VIBIX_TOKEN is missing")
		http.Error(w, "Server misconfiguration: VIBIX_TOKEN missing", http.StatusInternalServerError)
		return
	}

	vibixHost := h.config.VibixHost
	if vibixHost == "" {
		vibixHost = "https://vibix.org"
	}

	var endpoint string
	if idType == "kp" {
		endpoint = "kinopoisk"
	} else {
		endpoint = "imdb"
	}

	apiURL := fmt.Sprintf("%s/api/v1/publisher/videos/%s/%s", vibixHost, endpoint, id)
	log.Printf("Calling Vibix API: %s", apiURL)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		log.Printf("Error creating Vibix request: %v", err)
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", h.config.VibixToken)
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

	// Vibix использует только iframe_url без season/episode
	playerURL := vibixResponse.IframeURL
	log.Printf("🔗 Vibix iframe URL: %s", playerURL)

	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, playerURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Vibix Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))

	log.Printf("Successfully served Vibix player for %s: %s", idType, id)
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

	// Используем общий шаблон с кастомными контролами
	htmlDoc := getPlayerWithControlsHTML(playerURL, "Vidsrc Player")

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

	// Используем общий шаблон с кастомными контролами
	htmlDoc := getPlayerWithControlsHTML(playerURL, "Vidlink Player")

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))

	log.Printf("Successfully served Vidlink movie player: %s", imdbId)
}

// GetVidlinkTVPlayer handles vidlink.pro player for TV shows (uses TMDB ID)
func (h *PlayersHandler) GetHDVBPlayer(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetHDVBPlayer called: %s %s", r.Method, r.URL.Path)

	vars := mux.Vars(r)
	idType := vars["id_type"]
	id := vars["id"]

	if idType == "" || id == "" {
		log.Printf("Error: id_type or id is empty")
		http.Error(w, "id_type and id are required", http.StatusBadRequest)
		return
	}

	if idType != "kp" && idType != "imdb" {
		log.Printf("Error: invalid id_type: %s", idType)
		http.Error(w, "id_type must be 'kp' or 'imdb'", http.StatusBadRequest)
		return
	}

	log.Printf("Processing %s ID: %s", idType, id)

	if h.config.HDVBToken == "" {
		log.Printf("Error: HDVB_TOKEN is missing")
		http.Error(w, "Server misconfiguration: HDVB_TOKEN missing", http.StatusInternalServerError)
		return
	}

	var apiURL string
	if idType == "kp" {
		apiURL = fmt.Sprintf("https://apivb.com/api/videos.json?id_kp=%s&token=%s", id, h.config.HDVBToken)
	} else {
		apiURL = fmt.Sprintf("https://apivb.com/api/videos.json?imdb_id=%s&token=%s", id, h.config.HDVBToken)
	}
	log.Printf("HDVB API URL: %s", apiURL)

    client := &http.Client{Timeout: 8 * time.Second}
    resp, err := client.Get(apiURL)
	if err != nil {
		log.Printf("Error fetching HDVB data: %v", err)
		http.Error(w, "Failed to fetch player data", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading HDVB response: %v", err)
		http.Error(w, "Failed to read player data", http.StatusInternalServerError)
		return
	}

	var hdvbData []map[string]interface{}
	if err := json.Unmarshal(body, &hdvbData); err != nil {
		log.Printf("Error parsing HDVB JSON: %v, body: %s", err, string(body))
		http.Error(w, "Failed to parse player data", http.StatusInternalServerError)
		return
	}

	if len(hdvbData) == 0 {
		log.Printf("No HDVB data found for ID: %s", id)
		http.Error(w, "No player data found", http.StatusNotFound)
		return
	}

	iframeURL, ok := hdvbData[0]["iframe_url"].(string)
	if !ok || iframeURL == "" {
		log.Printf("No iframe_url in HDVB response for ID: %s", id)
		http.Error(w, "No player URL found", http.StatusNotFound)
		return
	}

	log.Printf("HDVB iframe URL: %s", iframeURL)

	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, iframeURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>HDVB Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))

	log.Printf("Successfully served HDVB player for %s: %s", idType, id)
}

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

	// Используем общий шаблон с кастомными контролами
	htmlDoc := getPlayerWithControlsHTML(playerURL, "Vidlink Player")

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))

	log.Printf("Successfully served Vidlink TV player: %s S%sE%s", tmdbId, season, episode)
}

// getPlayerWithControlsHTML возвращает HTML с плеером и overlay для блокировки кликов
func getPlayerWithControlsHTML(playerURL, title string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'/>
<title>%s</title>
<style>
html,body{margin:0;height:100%%;overflow:hidden;background:#000;font-family:Arial,sans-serif;}
#container{position:relative;width:100%%;height:100%%;}
#player-iframe{position:absolute;top:0;left:0;width:100%%;height:100%%;border:none;}
#overlay{position:absolute;top:0;left:0;width:100%%;height:100%%;z-index:10;pointer-events:none;}
#controls{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.8));padding:20px;opacity:0;transition:opacity 0.3s;pointer-events:auto;z-index:20;}
#container:hover #controls{opacity:1;}
.btn{background:rgba(255,255,255,0.2);border:none;color:#fff;padding:12px 20px;margin:0 5px;border-radius:5px;cursor:pointer;font-size:16px;transition:background 0.2s;}
.btn:hover{background:rgba(255,255,255,0.4);}
.btn:active{background:rgba(255,255,255,0.6);}
</style>
</head>
<body>
<div id="container">
  <iframe id="player-iframe" src="%s" allowfullscreen allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>
  <div id="overlay"></div>
  <div id="controls">
    <button class="btn" id="btn-fullscreen" title="Fullscreen">⛶ Fullscreen</button>
  </div>
</div>
<script>
const overlay=document.getElementById('overlay');

// Блокируем клики на iframe (защита от рекламы)
overlay.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();});
overlay.addEventListener('mousedown',(e)=>{e.preventDefault();e.stopPropagation();});

// Fullscreen
document.getElementById('btn-fullscreen').addEventListener('click',()=>{
  if(!document.fullscreenElement){
    document.getElementById('container').requestFullscreen();
  }else{
    document.exitFullscreen();
  }
});
</script>
</body>
</html>`, title, playerURL)
}
