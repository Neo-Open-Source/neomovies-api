package players

// StreamResult represents the result of a streaming request
type StreamResult struct {
	Success   bool   `json:"success"`
	StreamURL string `json:"stream_url,omitempty"`
	Provider  string `json:"provider"`
	Type      string `json:"type"` // "direct", "iframe", "hls", etc.
	Error     string `json:"error,omitempty"`
}

// Player interface defines methods for streaming providers
type Player interface {
	GetMovieStream(tmdbID string) (*StreamResult, error)
	GetTVStream(tmdbID string, season, episode int) (*StreamResult, error)
}

// PlayersManager manages all available streaming players
type PlayersManager struct {
	rgshows     *RgShowsPlayer
	iframevideo *IframeVideoPlayer
}

// NewPlayersManager creates a new players manager
func NewPlayersManager() *PlayersManager {
	return &PlayersManager{
		rgshows:     NewRgShowsPlayer(),
		iframevideo: NewIframeVideoPlayer(),
	}
}

// GetMovieStreams tries to get movie streams from all available providers
func (pm *PlayersManager) GetMovieStreams(tmdbID string) []*StreamResult {
	var results []*StreamResult

	// Try RgShows
	if stream, err := pm.rgshows.GetMovieStream(tmdbID); err == nil {
		results = append(results, stream)
	} else {
		results = append(results, &StreamResult{
			Success:  false,
			Provider: "RgShows",
			Error:    err.Error(),
		})
	}

	return results
}

// GetTVStreams tries to get TV show streams from all available providers
func (pm *PlayersManager) GetTVStreams(tmdbID string, season, episode int) []*StreamResult {
	var results []*StreamResult

	// Try RgShows
	if stream, err := pm.rgshows.GetTVStream(tmdbID, season, episode); err == nil {
		results = append(results, stream)
	} else {
		results = append(results, &StreamResult{
			Success:  false,
			Provider: "RgShows",
			Error:    err.Error(),
		})
	}

	return results
}

// GetMovieStreamByProvider gets movie stream from specific provider
func (pm *PlayersManager) GetMovieStreamByProvider(provider, tmdbID string) (*StreamResult, error) {
	switch provider {
	case "rgshows":
		return pm.rgshows.GetMovieStream(tmdbID)
	default:
		return &StreamResult{
			Success:  false,
			Provider: provider,
			Error:    "provider not found",
		}, nil
	}
}

// GetTVStreamByProvider gets TV stream from specific provider
func (pm *PlayersManager) GetTVStreamByProvider(provider, tmdbID string, season, episode int) (*StreamResult, error) {
	switch provider {
	case "rgshows":
		return pm.rgshows.GetTVStream(tmdbID, season, episode)
	default:
		return &StreamResult{
			Success:  false,
			Provider: provider,
			Error:    "provider not found",
		}, nil
	}
}

// GetStreamWithKinopoisk gets stream using Kinopoisk ID and IMDB ID (for IframeVideo)
func (pm *PlayersManager) GetStreamWithKinopoisk(kinopoiskID, imdbID string) (*StreamResult, error) {
	return pm.iframevideo.GetStream(kinopoiskID, imdbID)
}
