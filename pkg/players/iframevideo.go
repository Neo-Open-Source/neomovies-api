package players

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"regexp"
	"strconv"
	"time"
)

// IframeVideoSearchResponse represents the search response from IframeVideo API
type IframeVideoSearchResponse struct {
	Results []struct {
		CID  int    `json:"cid"`
		Path string `json:"path"`
		Type string `json:"type"`
	} `json:"results"`
}

// IframeVideoResponse represents the video response from IframeVideo API
type IframeVideoResponse struct {
	Source string `json:"src"`
}

// IframeVideoPlayer implements the IframeVideo streaming service
type IframeVideoPlayer struct {
	APIHost string
	CDNHost string
	Client  *http.Client
}

// NewIframeVideoPlayer creates a new IframeVideo player instance
func NewIframeVideoPlayer() *IframeVideoPlayer {
	return &IframeVideoPlayer{
		APIHost: "https://iframe.video",
		CDNHost: "https://videoframe.space",
		Client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

// GetStream gets streaming URL by Kinopoisk ID and IMDB ID
func (i *IframeVideoPlayer) GetStream(kinopoiskID, imdbID string) (*StreamResult, error) {
	// First, search for content
	searchResult, err := i.searchContent(kinopoiskID, imdbID)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// Get iframe content to extract token
	token, err := i.extractToken(searchResult.Path)
	if err != nil {
		return nil, fmt.Errorf("token extraction failed: %w", err)
	}

	// Get video URL
	return i.getVideoURL(searchResult.CID, token, searchResult.Type)
}

// searchContent searches for content by Kinopoisk and IMDB IDs
func (i *IframeVideoPlayer) searchContent(kinopoiskID, imdbID string) (*struct {
	CID  int
	Path string
	Type string
}, error) {
	url := fmt.Sprintf("%s/api/v2/search?imdb=%s&kp=%s", i.APIHost, imdbID, kinopoiskID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36")

	resp, err := i.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch search results: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status: %d", resp.StatusCode)
	}

	var searchResp IframeVideoSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(searchResp.Results) == 0 {
		return nil, fmt.Errorf("content not found")
	}

	result := searchResp.Results[0]
	return &struct {
		CID  int
		Path string
		Type string
	}{
		CID:  result.CID,
		Path: result.Path,
		Type: result.Type,
	}, nil
}

// extractToken extracts token from iframe HTML content
func (i *IframeVideoPlayer) extractToken(path string) (string, error) {
	req, err := http.NewRequest("GET", path, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers similar to C# implementation
	req.Header.Set("DNT", "1")
	req.Header.Set("Referer", i.CDNHost+"/")
	req.Header.Set("Sec-Fetch-Dest", "iframe")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	req.Header.Set("Upgrade-Insecure-Requests", "1")
	req.Header.Set("sec-ch-ua", `"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"`)
	req.Header.Set("sec-ch-ua-mobile", "?0")
	req.Header.Set("sec-ch-ua-platform", `"Windows"`)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36")

	resp, err := i.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch iframe content: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("iframe returned status: %d", resp.StatusCode)
	}

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read iframe content: %w", err)
	}

	// Extract token using regex as in C# implementation
	re := regexp.MustCompile(`\/[^\/]+\/([^\/]+)\/iframe`)
	matches := re.FindStringSubmatch(string(content))
	if len(matches) < 2 {
		return "", fmt.Errorf("token not found in iframe content")
	}

	return matches[1], nil
}

// getVideoURL gets video URL using extracted token
func (i *IframeVideoPlayer) getVideoURL(cid int, token, mediaType string) (*StreamResult, error) {
	// Create multipart form data
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	writer.WriteField("token", token)
	writer.WriteField("type", mediaType)
	writer.WriteField("season", "")
	writer.WriteField("episode", "")
	writer.WriteField("mobile", "false")
	writer.WriteField("id", strconv.Itoa(cid))
	writer.WriteField("qt", "480")

	contentType := writer.FormDataContentType()
	writer.Close()

	req, err := http.NewRequest("POST", i.CDNHost+"/loadvideo", &buf)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Origin", i.CDNHost)
	req.Header.Set("Referer", i.CDNHost+"/")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36")

	resp, err := i.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch video URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("video API returned status: %d", resp.StatusCode)
	}

	var videoResp IframeVideoResponse
	if err := json.NewDecoder(resp.Body).Decode(&videoResp); err != nil {
		return nil, fmt.Errorf("failed to decode video response: %w", err)
	}

	if videoResp.Source == "" {
		return nil, fmt.Errorf("video URL not found")
	}

	return &StreamResult{
		Success:   true,
		StreamURL: videoResp.Source,
		Provider:  "IframeVideo",
		Type:      "direct",
	}, nil
}
