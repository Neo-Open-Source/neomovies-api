package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"neomovies-api/pkg/config"
	"neomovies-api/pkg/players"

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
	vars := mux.Vars(r)
	idType := vars["id_type"]
	id := vars["id"]

	if idType == "" || id == "" {
		http.Error(w, "id_type and id are required", http.StatusBadRequest)
		return
	}

	if idType == "kinopoisk_id" {
		idType = "kp"
	}
	if idType != "kp" && idType != "imdb" {
		http.Error(w, "id_type must be 'kp' (kinopoisk_id) or 'imdb'", http.StatusBadRequest)
		return
	}

	if h.config.AllohaToken == "" {
		http.Error(w, "Server misconfiguration: ALLOHA_TOKEN missing", http.StatusInternalServerError)
		return
	}

	idParam := fmt.Sprintf("%s=%s", idType, url.QueryEscape(id))
	apiURL := fmt.Sprintf("https://api.alloha.tv/?token=%s&%s", h.config.AllohaToken, idParam)

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		http.Error(w, "Failed to fetch from Alloha API", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Alloha API error: %d", resp.StatusCode), http.StatusBadGateway)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read Alloha response", http.StatusInternalServerError)
		return
	}

	var allohaResponse struct {
		Status string `json:"status"`
		Data   struct {
			Iframe string `json:"iframe"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &allohaResponse); err != nil {
		http.Error(w, "Invalid JSON from Alloha", http.StatusBadGateway)
		return
	}

	if allohaResponse.Status != "success" || allohaResponse.Data.Iframe == "" {
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
		iframeCode = fmt.Sprintf(`<iframe src="%s" allowfullscreen controlsList="nodownload" style="border:none;width:100%%;height:100%%"></iframe>`, playerURL)
	}

	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Alloha Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframeCode)

	// Авто-исправление экранированных кавычек
	htmlDoc = strings.ReplaceAll(htmlDoc, `\"`, `"`)
	htmlDoc = strings.ReplaceAll(htmlDoc, `\'`, `'`)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
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
					Episode     int `json:"episode"`
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
	vars := mux.Vars(r)
	idType := vars["id_type"]
	id := vars["id"]

	if idType == "" || id == "" {
		http.Error(w, "id_type and id are required", http.StatusBadRequest)
		return
	}

	// Поддержка алиаса
	if idType == "kinopoisk_id" {
		idType = "kp"
	}
	if idType != "kp" && idType != "imdb" {
		http.Error(w, "id_type must be 'kp' or 'imdb'", http.StatusBadRequest)
		return
	}

	if h.config.LumexURL == "" {
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

	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen controlsList="nodownload" loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, playerURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Lumex Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
}

func (h *PlayersHandler) GetVibixPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idType := vars["id_type"]
	id := vars["id"]

	if idType == "" || id == "" {
		http.Error(w, "id_type and id are required", http.StatusBadRequest)
		return
	}

	if idType != "kp" && idType != "imdb" {
		http.Error(w, "id_type must be 'kp' or 'imdb'", http.StatusBadRequest)
		return
	}

	if h.config.VibixToken == "" {
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

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", h.config.VibixToken)
	req.Header.Set("X-CSRF-TOKEN", "")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "Failed to fetch from Vibix API", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Vibix API error: %d", resp.StatusCode), http.StatusBadGateway)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read Vibix response", http.StatusInternalServerError)
		return
	}

	var vibixResponse struct {
		ID        interface{} `json:"id"`
		IframeURL string      `json:"iframe_url"`
	}

	if err := json.Unmarshal(body, &vibixResponse); err != nil {
		http.Error(w, "Invalid JSON from Vibix", http.StatusBadGateway)
		return
	}

	if vibixResponse.ID == nil || vibixResponse.IframeURL == "" {
		http.Error(w, "Video not found", http.StatusNotFound)
		return
	}

	// Vibix использует только iframe_url без season/episode
	playerURL := vibixResponse.IframeURL

	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen controlsList="nodownload" loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, playerURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Vibix Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
}

// GetRgShowsPlayer handles RgShows streaming requests
func (h *PlayersHandler) GetRgShowsPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tmdbID := vars["tmdb_id"]
	if tmdbID == "" {
		http.Error(w, "tmdb_id path param is required", http.StatusBadRequest)
		return
	}

	pm := players.NewPlayersManager()
	result, err := pm.GetMovieStreamByProvider("rgshows", tmdbID)
	if err != nil {
		http.Error(w, "Failed to get stream", http.StatusInternalServerError)
		return
	}

	if !result.Success {
		http.Error(w, "Stream not found", http.StatusNotFound)
		return
	}

	// Create iframe with the stream URL
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen controlsList="nodownload" loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, result.StreamURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>RgShows Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
}

// GetRgShowsTVPlayer handles RgShows TV show streaming requests
func (h *PlayersHandler) GetRgShowsTVPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tmdbID := vars["tmdb_id"]
	seasonStr := vars["season"]
	episodeStr := vars["episode"]

	if tmdbID == "" || seasonStr == "" || episodeStr == "" {
		http.Error(w, "tmdb_id, season, and episode path params are required", http.StatusBadRequest)
		return
	}

	season, err := strconv.Atoi(seasonStr)
	if err != nil {
		http.Error(w, "Invalid season number", http.StatusBadRequest)
		return
	}

	episode, err := strconv.Atoi(episodeStr)
	if err != nil {
		http.Error(w, "Invalid episode number", http.StatusBadRequest)
		return
	}

	pm := players.NewPlayersManager()
	result, err := pm.GetTVStreamByProvider("rgshows", tmdbID, season, episode)
	if err != nil {
		http.Error(w, "Failed to get stream", http.StatusInternalServerError)
		return
	}

	if !result.Success {
		http.Error(w, "Stream not found", http.StatusNotFound)
		return
	}

	// Create iframe with the stream URL
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen controlsList="nodownload" loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, result.StreamURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>RgShows TV Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
}

// GetIframeVideoPlayer handles IframeVideo streaming requests
func (h *PlayersHandler) GetIframeVideoPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	kinopoiskID := vars["kinopoisk_id"]
	imdbID := vars["imdb_id"]

	if kinopoiskID == "" && imdbID == "" {
		http.Error(w, "Either kinopoisk_id or imdb_id path param is required", http.StatusBadRequest)
		return
	}

	pm := players.NewPlayersManager()
	result, err := pm.GetStreamWithKinopoisk(kinopoiskID, imdbID)
	if err != nil {
		http.Error(w, "Failed to get stream", http.StatusInternalServerError)
		return
	}

	if !result.Success {
		http.Error(w, "Stream not found", http.StatusNotFound)
		return
	}

	// Create iframe with the stream URL
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen controlsList="nodownload" loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, result.StreamURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>IframeVideo Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
}

// GetStreamAPI returns stream information as JSON API
func (h *PlayersHandler) GetStreamAPI(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	provider := vars["provider"]
	tmdbID := vars["tmdb_id"]

	if provider == "" || tmdbID == "" {
		http.Error(w, "provider and tmdb_id path params are required", http.StatusBadRequest)
		return
	}

	// Check for TV show parameters
	seasonStr := r.URL.Query().Get("season")
	episodeStr := r.URL.Query().Get("episode")
	kinopoiskID := r.URL.Query().Get("kinopoisk_id")
	imdbID := r.URL.Query().Get("imdb_id")

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
		result = &players.StreamResult{
			Success:  false,
			Provider: provider,
			Error:    err.Error(),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetVidsrcPlayer handles Vidsrc.to player (uses IMDb ID for both movies and TV shows)
func (h *PlayersHandler) GetVidsrcPlayer(w http.ResponseWriter, r *http.Request) {
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

	// Используем общий шаблон с кастомными контролами
	htmlDoc := getPlayerWithControlsHTML(playerURL, "Vidsrc Player")

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
}

// GetVidlinkMoviePlayer handles vidlink.pro player for movies (uses IMDb ID)
func (h *PlayersHandler) GetVidlinkMoviePlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	imdbId := vars["imdb_id"]

	if imdbId == "" {
		http.Error(w, "imdb_id is required", http.StatusBadRequest)
		return
	}

	playerURL := fmt.Sprintf("https://vidlink.pro/movie/%s", imdbId)

	// Используем общий шаблон с кастомными контролами
	htmlDoc := getPlayerWithControlsHTML(playerURL, "Vidlink Player")

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
}

// GetVidlinkTVPlayer handles vidlink.pro player for TV shows (uses TMDB ID)
func (h *PlayersHandler) GetVidlinkTVPlayer(w http.ResponseWriter, r *http.Request) {
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

	// Используем общий шаблон с кастомными контролами
	htmlDoc := getPlayerWithControlsHTML(playerURL, "Vidlink Player")

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
}

// GetHDVBPlayer handles HDVB streaming requests
func (h *PlayersHandler) GetHDVBPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idType := vars["id_type"]
	id := vars["id"]

	if idType == "" || id == "" {
		http.Error(w, "id_type and id are required", http.StatusBadRequest)
		return
	}

	if idType != "kp" && idType != "imdb" {
		http.Error(w, "id_type must be 'kp' or 'imdb'", http.StatusBadRequest)
		return
	}

	if h.config.HDVBToken == "" {
		http.Error(w, "Server misconfiguration: HDVB_TOKEN missing", http.StatusInternalServerError)
		return
	}

	var apiURL string
	if idType == "kp" {
		apiURL = fmt.Sprintf("https://apivb.com/api/videos.json?id_kp=%s&token=%s", id, h.config.HDVBToken)
	} else {
		apiURL = fmt.Sprintf("https://apivb.com/api/videos.json?imdb_id=%s&token=%s", id, h.config.HDVBToken)
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		http.Error(w, "Failed to fetch player data", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read player data", http.StatusInternalServerError)
		return
	}

	var hdvbData []map[string]interface{}
	if err := json.Unmarshal(body, &hdvbData); err != nil {
		http.Error(w, "Failed to parse player data", http.StatusInternalServerError)
		return
	}

	if len(hdvbData) == 0 {
		http.Error(w, "No player data found", http.StatusNotFound)
		return
	}

	iframeURL, ok := hdvbData[0]["iframe_url"].(string)
	if !ok || iframeURL == "" {
		http.Error(w, "No player URL found", http.StatusNotFound)
		return
	}

	htmlDoc := getPlayerWithControlsHTML(iframeURL, "HDVB Player")

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
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

// GetCollapsPlayer handles Collaps streaming requests
func (h *PlayersHandler) GetCollapsPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idType := vars["id_type"]
	id := vars["id"]
	season := r.URL.Query().Get("season")
	episode := r.URL.Query().Get("episode")

	if idType == "" || id == "" {
		http.Error(w, "id_type and id are required", http.StatusBadRequest)
		return
	}

	if idType == "kinopoisk_id" {
		idType = "kp"
	}
	if idType != "kp" && idType != "imdb" && idType != "orid" {
		http.Error(w, "id_type must be 'kp', 'imdb', or 'orid'", http.StatusBadRequest)
		return
	}

	if h.config.CollapsAPIHost == "" || h.config.CollapsToken == "" {
		http.Error(w, "Server misconfiguration: COLLAPS_API_HOST or COLLAPS_TOKEN missing", http.StatusInternalServerError)
		return
	}

	client := &http.Client{Timeout: 8 * time.Second}

	// Используем /list endpoint для получения iframe_url
	var listURL string
	if idType == "kp" {
		listURL = fmt.Sprintf("%s/list?token=%s&kinopoisk_id=%s", h.config.CollapsAPIHost, h.config.CollapsToken, id)
	} else if idType == "imdb" {
		listURL = fmt.Sprintf("%s/list?token=%s&imdb_id=%s", h.config.CollapsAPIHost, h.config.CollapsToken, id)
	} else {
		// Для orid используем прямой embed
		listURL = fmt.Sprintf("%s/embed/movie/%s?token=%s", h.config.CollapsAPIHost, id, h.config.CollapsToken)
	}

	resp, err := client.Get(listURL)
	if err != nil {
		http.Error(w, "Failed to fetch from Collaps API", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Collaps API error: %d", resp.StatusCode), http.StatusBadGateway)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read Collaps response", http.StatusInternalServerError)
		return
	}

	content := string(body)

	// Если это прямой embed (для orid), проверяем на сезоны
	if idType == "orid" {
		if strings.Contains(content, "seasons:") {
			w.Header().Set("Content-Type", "text/html")
			w.Write(body)
			return
		}

		// Парсим HLS для фильмов
		hlsMatch := regexp.MustCompile(`hls:\s*"(https?://[^"]+\.m3u[^"]*)`).FindStringSubmatch(content)
		if len(hlsMatch) == 0 {
			http.Error(w, "Video not found", http.StatusNotFound)
			return
		}

		playerURL := hlsMatch[1]
		iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen controlsList="nodownload" loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, playerURL)
		htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Collaps Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(htmlDoc))
		return
	}

	// Парсим JSON ответ от /list
	var listResponse struct {
		Results []struct {
			ID        int    `json:"id"`
			Name      string `json:"name"`
			Type      string `json:"type"`
			IframeURL string `json:"iframe_url"`
			Seasons   []struct {
				Season   int `json:"season"`
				Episodes []struct {
					Episode   interface{} `json:"episode"` // может быть string или int
					IframeURL string      `json:"iframe_url"`
				} `json:"episodes"`
			} `json:"seasons"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &listResponse); err != nil {
		http.Error(w, "Invalid JSON from Collaps", http.StatusBadGateway)
		return
	}

	if len(listResponse.Results) == 0 {
		http.Error(w, "Video not found on Collaps", http.StatusNotFound)
		return
	}

	result := listResponse.Results[0]

	var iframeURL string

	// Helper функция для конвертации episode в число
	episodeToInt := func(ep interface{}) int {
		switch v := ep.(type) {
		case float64:
			return int(v)
		case string:
			num := 0
			fmt.Sscanf(v, "%d", &num)
			return num
		default:
			return 0
		}
	}

	// Если это сериал и запрошены сезон/эпизод
	if result.Type == "series" && season != "" && episode != "" {
		seasonNum := 0
		episodeNum := 0
		fmt.Sscanf(season, "%d", &seasonNum)
		fmt.Sscanf(episode, "%d", &episodeNum)

		for _, s := range result.Seasons {
			if s.Season == seasonNum {
				for _, e := range s.Episodes {
					if episodeToInt(e.Episode) == episodeNum {
						iframeURL = e.IframeURL
						break
					}
				}
				break
			}
		}

		if iframeURL == "" {
			http.Error(w, "Episode not found", http.StatusNotFound)
			return
		}
	} else if result.Type == "series" && season != "" {
		// Только сезон
		seasonNum := 0
		fmt.Sscanf(season, "%d", &seasonNum)

		for _, s := range result.Seasons {
			if s.Season == seasonNum {
				iframeURL = s.Episodes[0].IframeURL
				break
			}
		}

		if iframeURL == "" {
			http.Error(w, "Season not found", http.StatusNotFound)
			return
		}
	} else {
		// Фильм или первый эпизод сериала
		iframeURL = result.IframeURL
	}

	// Возвращаем HTML с iframe напрямую
	iframe := fmt.Sprintf(`<iframe src="%s" allowfullscreen controlsList="nodownload" loading="lazy" style="border:none;width:100%%;height:100%%;"></iframe>`, iframeURL)
	htmlDoc := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset='utf-8'/><title>Collaps Player</title><style>html,body{margin:0;height:100%%;}</style></head><body>%s</body></html>`, iframe)

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlDoc))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
