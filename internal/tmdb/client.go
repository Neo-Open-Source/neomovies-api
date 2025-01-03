package tmdb

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"path"
	"time"
)

const (
	baseURL     = "https://api.themoviedb.org/3"
	imageBaseURL = "https://image.tmdb.org/t/p"
	googleDNS   = "8.8.8.8:53"    // Google Public DNS
	cloudflareDNS = "1.1.1.1:53"  // Cloudflare DNS
)

// Client представляет клиент для работы с TMDB API
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient создает новый клиент TMDB API с кастомным DNS
func NewClient(apiKey string) *Client {
	// Создаем кастомный DNS резолвер с двумя DNS серверами
	dialer := &net.Dialer{
		Timeout: 5 * time.Second,
		Resolver: &net.Resolver{
			PreferGo: true,
			Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
				// Пробуем сначала Google DNS
				d := net.Dialer{Timeout: 5 * time.Second}
				conn, err := d.DialContext(ctx, "udp", googleDNS)
				if err != nil {
					log.Printf("Failed to connect to Google DNS, trying Cloudflare: %v", err)
					// Если Google DNS не отвечает, пробуем Cloudflare
					return d.DialContext(ctx, "udp", cloudflareDNS)
				}
				return conn, nil
			},
		},
	}

	// Создаем транспорт с кастомным диалером
	transport := &http.Transport{
		DialContext:           dialer.DialContext,
		TLSHandshakeTimeout:  5 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	}

	client := &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   10 * time.Second,
		},
	}

	// Проверяем работу DNS и API
	log.Println("Testing DNS resolution and TMDB API access...")
	
	// Тест 1: Проверяем резолвинг через DNS
	ips, err := net.LookupIP("api.themoviedb.org")
	if err != nil {
		log.Printf("Warning: DNS lookup failed: %v", err)
	} else {
		log.Printf("Successfully resolved api.themoviedb.org to: %v", ips)
	}

	// Тест 2: Проверяем наш IP
	resp, err := client.httpClient.Get("https://ipinfo.io/json")
	if err != nil {
		log.Printf("Warning: Failed to check our IP: %v", err)
	} else {
		defer resp.Body.Close()
		var ipInfo struct {
			IP       string `json:"ip"`
			City     string `json:"city"`
			Country  string `json:"country"`
			Org      string `json:"org"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&ipInfo); err != nil {
			log.Printf("Warning: Failed to decode IP info: %v", err)
		} else {
			log.Printf("Our IP info: IP=%s, City=%s, Country=%s, Org=%s",
				ipInfo.IP, ipInfo.City, ipInfo.Country, ipInfo.Org)
		}
	}

	// Тест 3: Проверяем доступ к TMDB API
	testURL := fmt.Sprintf("%s/movie/popular?api_key=%s", baseURL, apiKey)
	resp, err = client.httpClient.Get(testURL)
	if err != nil {
		log.Printf("Warning: TMDB API test failed: %v", err)
	} else {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			log.Println("Successfully connected to TMDB API!")
		} else {
			log.Printf("Warning: TMDB API returned status code: %d", resp.StatusCode)
		}
	}

	return client
}

// SetSOCKS5Proxy устанавливает SOCKS5 прокси для клиента
func (c *Client) SetSOCKS5Proxy(proxyAddr string) error {
	return fmt.Errorf("proxy support has been removed in favor of custom DNS resolvers")
}

// makeRequest выполняет HTTP запрос к TMDB API
func (c *Client) makeRequest(method, endpoint string, params url.Values) ([]byte, error) {
	// Создаем URL
	u, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse base URL: %v", err)
	}
	u.Path = path.Join(u.Path, endpoint)
	if params == nil {
		params = url.Values{}
	}
	u.RawQuery = params.Encode()

	// Создаем запрос
	req, err := http.NewRequest(method, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	// Добавляем заголовок авторизации
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json;charset=utf-8")

	log.Printf("Making request to TMDB: %s %s", method, u.String())

	// Выполняем запрос
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	// Проверяем статус ответа
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TMDB API error: status=%d body=%s", resp.StatusCode, string(body))
	}

	// Читаем тело ответа
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	return body, nil
}

// GetImageURL возвращает полный URL изображения
func (c *Client) GetImageURL(path string, size string) string {
	if path == "" {
		return ""
	}
	return fmt.Sprintf("%s/%s%s", imageBaseURL, size, path)
}

// GetPopular получает список популярных фильмов
func (c *Client) GetPopular(page string) (*MoviesResponse, error) {
	params := url.Values{}
	params.Set("page", page)

	body, err := c.makeRequest(http.MethodGet, "movie/popular", params)
	if err != nil {
		return nil, err
	}

	var response MoviesResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &response, nil
}

// GetMovie получает информацию о конкретном фильме
func (c *Client) GetMovie(id string) (*MovieDetails, error) {
	body, err := c.makeRequest(http.MethodGet, fmt.Sprintf("movie/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var movie MovieDetails
	if err := json.Unmarshal(body, &movie); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &movie, nil
}

// SearchMovies ищет фильмы по запросу с поддержкой русского языка
func (c *Client) SearchMovies(query string, page string) (*MoviesResponse, error) {
	params := url.Values{}
	params.Set("query", query)
	params.Set("page", page)
	params.Set("language", "ru-RU")      // Добавляем русский язык
	params.Set("region", "RU")           // Добавляем русский регион
	params.Set("include_adult", "false") // Исключаем взрослый контент

	body, err := c.makeRequest(http.MethodGet, "search/movie", params)
	if err != nil {
		return nil, err
	}

	var response MoviesResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	// Фильтруем результаты
	filteredResults := make([]Movie, 0)
	for _, movie := range response.Results {
		// Проверяем, что у фильма есть постер и описание
		if movie.PosterPath != "" && movie.Overview != "" {
			// Проверяем, что рейтинг больше 0
			if movie.VoteAverage > 0 {
				filteredResults = append(filteredResults, movie)
			}
		}
	}

	// Обновляем результаты
	response.Results = filteredResults
	response.TotalResults = len(filteredResults)

	return &response, nil
}

// GetTopRated получает список лучших фильмов
func (c *Client) GetTopRated(page string) (*MoviesResponse, error) {
	params := url.Values{}
	params.Set("page", page)

	body, err := c.makeRequest(http.MethodGet, "movie/top_rated", params)
	if err != nil {
		return nil, err
	}

	var response MoviesResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &response, nil
}

// GetUpcoming получает список предстоящих фильмов
func (c *Client) GetUpcoming(page string) (*MoviesResponse, error) {
	params := url.Values{}
	params.Set("page", page)

	body, err := c.makeRequest(http.MethodGet, "movie/upcoming", params)
	if err != nil {
		return nil, err
	}

	var response MoviesResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &response, nil
}

// DiscoverMovies получает список фильмов по фильтрам
func (c *Client) DiscoverMovies(page string) (*MoviesResponse, error) {
	params := url.Values{}
	params.Set("page", page)

	body, err := c.makeRequest(http.MethodGet, "discover/movie", params)
	if err != nil {
		return nil, err
	}

	var response MoviesResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &response, nil
}

// DiscoverTV получает список сериалов по фильтрам
func (c *Client) DiscoverTV(page string) (*MoviesResponse, error) {
	params := url.Values{}
	params.Set("page", page)

	body, err := c.makeRequest(http.MethodGet, "discover/tv", params)
	if err != nil {
		return nil, err
	}

	var response MoviesResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &response, nil
}

// ExternalIDs содержит внешние идентификаторы фильма/сериала
type ExternalIDs struct {
	ID          int    `json:"id"`
	IMDbID      string `json:"imdb_id"`
	FacebookID  string `json:"facebook_id"`
	InstagramID string `json:"instagram_id"`
	TwitterID   string `json:"twitter_id"`
}

// GetMovieExternalIDs возвращает внешние идентификаторы фильма
func (c *Client) GetMovieExternalIDs(id string) (*ExternalIDs, error) {
	body, err := c.makeRequest(http.MethodGet, fmt.Sprintf("movie/%s/external_ids", id), nil)
	if err != nil {
		return nil, err
	}

	var externalIDs ExternalIDs
	if err := json.Unmarshal(body, &externalIDs); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &externalIDs, nil
}

// GetTVExternalIDs возвращает внешние идентификаторы сериала
func (c *Client) GetTVExternalIDs(id string) (*ExternalIDs, error) {
	body, err := c.makeRequest(http.MethodGet, fmt.Sprintf("tv/%s/external_ids", id), nil)
	if err != nil {
		return nil, err
	}

	var externalIDs ExternalIDs
	if err := json.Unmarshal(body, &externalIDs); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &externalIDs, nil
}

// TVSearchResults содержит результаты поиска сериалов
type TVSearchResults struct {
	Page         int    `json:"page"`
	TotalResults int    `json:"total_results"`
	TotalPages   int    `json:"total_pages"`
	Results      []TV   `json:"results"`
}

// TV содержит информацию о сериале
type TV struct {
	ID               int       `json:"id"`
	Name             string    `json:"name"`
	OriginalName     string    `json:"original_name"`
	Overview         string    `json:"overview"`
	FirstAirDate     string    `json:"first_air_date"`
	PosterPath       string    `json:"poster_path"`
	BackdropPath     string    `json:"backdrop_path"`
	VoteAverage      float64   `json:"vote_average"`
	VoteCount        int       `json:"vote_count"`
	Popularity       float64   `json:"popularity"`
	OriginalLanguage string    `json:"original_language"`
	GenreIDs         []int     `json:"genre_ids"`
}

// SearchTV ищет сериалы в TMDB
func (c *Client) SearchTV(query string, page string) (*TVSearchResults, error) {
	params := url.Values{}
	params.Set("query", query)
	params.Set("page", page)

	body, err := c.makeRequest(http.MethodGet, "search/tv", params)
	if err != nil {
		return nil, err
	}

	var results TVSearchResults
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &results, nil
}
