package players

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// RgShowsResponse represents the response from RgShows API
type RgShowsResponse struct {
	Stream *struct {
		URL string `json:"url"`
	} `json:"stream"`
}

// RgShowsPlayer implements the RgShows streaming service
type RgShowsPlayer struct {
	BaseURL string
	Client  *http.Client
}

// NewRgShowsPlayer creates a new RgShows player instance
func NewRgShowsPlayer() *RgShowsPlayer {
	return &RgShowsPlayer{
		BaseURL: "https://rgshows.com",
		Client: &http.Client{
			Timeout: 40 * time.Second,
		},
	}
}

// GetMovieStream gets streaming URL for a movie by TMDB ID
func (r *RgShowsPlayer) GetMovieStream(tmdbID string) (*StreamResult, error) {
	url := fmt.Sprintf("%s/main/movie/%s", r.BaseURL, tmdbID)
	return r.fetchStream(url)
}

// GetTVStream gets streaming URL for a TV show episode by TMDB ID, season and episode
func (r *RgShowsPlayer) GetTVStream(tmdbID string, season, episode int) (*StreamResult, error) {
	url := fmt.Sprintf("%s/main/tv/%s/%d/%d", r.BaseURL, tmdbID, season, episode)
	return r.fetchStream(url)
}

// fetchStream makes HTTP request to RgShows API and extracts stream URL
func (r *RgShowsPlayer) fetchStream(url string) (*StreamResult, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers similar to the C# implementation
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36")

	resp, err := r.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch stream: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status: %d", resp.StatusCode)
	}

	var rgResp RgShowsResponse
	if err := json.NewDecoder(resp.Body).Decode(&rgResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if rgResp.Stream == nil || rgResp.Stream.URL == "" {
		return nil, fmt.Errorf("stream not found")
	}

	return &StreamResult{
		Success:   true,
		StreamURL: rgResp.Stream.URL,
		Provider:  "RgShows",
		Type:      "direct",
	}, nil
}
