package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"neomovies-api/internal/tmdb"
)

// GetPopularMovies возвращает список популярных фильмов
// @Summary     Get popular movies
// @Description Get a list of popular movies
// @Tags        movies
// @Accept      json
// @Produce     json
// @Param       page query    int false "Page number (default: 1)"
// @Success     200  {object} MoviesResponse
// @Router      /movies/popular [get]
func GetPopularMovies(c *gin.Context) {
	page := c.DefaultQuery("page", "1")

	movies, err := tmdbClient.GetPopular(page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Добавляем полные URL для изображений
	for i := range movies.Results {
		if movies.Results[i].PosterPath != "" {
			movies.Results[i].PosterPath = tmdbClient.GetImageURL(movies.Results[i].PosterPath, "w500")
		}
		if movies.Results[i].BackdropPath != "" {
			movies.Results[i].BackdropPath = tmdbClient.GetImageURL(movies.Results[i].BackdropPath, "w1280")
		}
	}

	c.JSON(http.StatusOK, movies)
}

// GetMovie возвращает информацию о фильме
// @Summary     Get movie details
// @Description Get detailed information about a specific movie
// @Tags        movies
// @Accept      json
// @Produce     json
// @Param       id  path     int true "Movie ID"
// @Success     200 {object} MovieDetails
// @Router      /movies/{id} [get]
func GetMovie(c *gin.Context) {
	id := c.Param("id")

	movie, err := tmdbClient.GetMovie(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Добавляем полные URL для изображений
	if movie.PosterPath != "" {
		movie.PosterPath = tmdbClient.GetImageURL(movie.PosterPath, "original")
	}
	if movie.BackdropPath != "" {
		movie.BackdropPath = tmdbClient.GetImageURL(movie.BackdropPath, "original")
	}

	// Обрабатываем изображения для коллекции
	if movie.BelongsToCollection != nil {
		if movie.BelongsToCollection.PosterPath != "" {
			movie.BelongsToCollection.PosterPath = tmdbClient.GetImageURL(movie.BelongsToCollection.PosterPath, "w500")
		}
		if movie.BelongsToCollection.BackdropPath != "" {
			movie.BelongsToCollection.BackdropPath = tmdbClient.GetImageURL(movie.BelongsToCollection.BackdropPath, "w1280")
		}
	}

	// Обрабатываем логотипы компаний
	for i := range movie.ProductionCompanies {
		if movie.ProductionCompanies[i].LogoPath != "" {
			movie.ProductionCompanies[i].LogoPath = tmdbClient.GetImageURL(movie.ProductionCompanies[i].LogoPath, "w185")
		}
	}

	c.JSON(http.StatusOK, movie)
}

// SearchMovies ищет фильмы
// @Summary     Поиск фильмов
// @Description Поиск фильмов по запросу
// @Tags        movies
// @Accept      json
// @Produce     json
// @Param       query query    string true  "Поисковый запрос"
// @Param       page  query    string false "Номер страницы (по умолчанию 1)"
// @Success     200   {object} SearchResponse
// @Router      /movies/search [get]
func SearchMovies(c *gin.Context) {
	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter is required"})
		return
	}

	page := c.DefaultQuery("page", "1")

	// Получаем результаты поиска
	results, err := tmdbClient.SearchMovies(query, page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Преобразуем результаты в формат ответа
	response := SearchResponse{
		Page:         results.Page,
		TotalPages:   results.TotalPages,
		TotalResults: results.TotalResults,
		Results:      make([]MovieResponse, 0),
	}

	// Преобразуем каждый фильм
	for _, movie := range results.Results {
		// Форматируем дату
		releaseDate := formatDate(movie.ReleaseDate)

		// Добавляем фильм в результаты
		response.Results = append(response.Results, MovieResponse{
			ID:           movie.ID,
			Title:        movie.Title,
			Overview:     movie.Overview,
			ReleaseDate:  releaseDate,
			VoteAverage:  movie.VoteAverage,
			PosterPath:   tmdbClient.GetImageURL(movie.PosterPath, "w500"),
			BackdropPath: tmdbClient.GetImageURL(movie.BackdropPath, "w1280"),
		})
	}

	c.JSON(http.StatusOK, response)
}

// GetTopRatedMovies возвращает список лучших фильмов
// @Summary     Get top rated movies
// @Description Get a list of top rated movies
// @Tags        movies
// @Accept      json
// @Produce     json
// @Param       page query    int false "Page number (default: 1)"
// @Success     200  {object} MoviesResponse
// @Router      /movies/top-rated [get]
func GetTopRatedMovies(c *gin.Context) {
	page := c.DefaultQuery("page", "1")

	movies, err := tmdbClient.GetTopRated(page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Добавляем полные URL для изображений
	for i := range movies.Results {
		if movies.Results[i].PosterPath != "" {
			movies.Results[i].PosterPath = tmdbClient.GetImageURL(movies.Results[i].PosterPath, "w500")
		}
		if movies.Results[i].BackdropPath != "" {
			movies.Results[i].BackdropPath = tmdbClient.GetImageURL(movies.Results[i].BackdropPath, "w1280")
		}
	}

	c.JSON(http.StatusOK, movies)
}

// GetUpcomingMovies возвращает список предстоящих фильмов
// @Summary     Get upcoming movies
// @Description Get a list of upcoming movies
// @Tags        movies
// @Accept      json
// @Produce     json
// @Param       page query    int false "Page number (default: 1)"
// @Success     200  {object} MoviesResponse
// @Router      /movies/upcoming [get]
func GetUpcomingMovies(c *gin.Context) {
	page := c.DefaultQuery("page", "1")

	movies, err := tmdbClient.GetUpcoming(page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Добавляем полные URL для изображений
	for i := range movies.Results {
		if movies.Results[i].PosterPath != "" {
			movies.Results[i].PosterPath = tmdbClient.GetImageURL(movies.Results[i].PosterPath, "w500")
		}
		if movies.Results[i].BackdropPath != "" {
			movies.Results[i].BackdropPath = tmdbClient.GetImageURL(movies.Results[i].BackdropPath, "w1280")
		}
	}

	c.JSON(http.StatusOK, movies)
}

// GetTMDBPopularMovies возвращает список популярных фильмов из TMDB
// @Summary     Get TMDB popular movies
// @Description Get a list of popular movies directly from TMDB
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       page query    int false "Page number (default: 1)"
// @Success     200  {object} TMDBMoviesResponse
// @Router      /bridge/tmdb/movie/popular [get]
func GetTMDBPopularMovies(c *gin.Context) {
	page := c.DefaultQuery("page", "1")

	movies, err := tmdbClient.GetPopular(page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Добавляем полные URL для изображений
	for i := range movies.Results {
		if movies.Results[i].PosterPath != "" {
			movies.Results[i].PosterPath = tmdbClient.GetImageURL(movies.Results[i].PosterPath, "w500")
		}
		if movies.Results[i].BackdropPath != "" {
			movies.Results[i].BackdropPath = tmdbClient.GetImageURL(movies.Results[i].BackdropPath, "w1280")
		}
	}

	c.JSON(http.StatusOK, movies)
}

// GetTMDBMovie возвращает информацию о фильме из TMDB
// @Summary     Get TMDB movie details
// @Description Get detailed information about a specific movie directly from TMDB
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       id  path     int true "Movie ID"
// @Success     200 {object} tmdb.Movie
// @Router      /bridge/tmdb/movie/{id} [get]
func GetTMDBMovie(c *gin.Context) {
	id := c.Param("id")

	movie, err := tmdbClient.GetMovie(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movie)
}

// GetTMDBTopRatedMovies возвращает список лучших фильмов из TMDB
// @Summary     Get TMDB top rated movies
// @Description Get a list of top rated movies directly from TMDB
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       page query    int false "Page number (default: 1)"
// @Success     200  {object} TMDBMoviesResponse
// @Router      /bridge/tmdb/movie/top_rated [get]
func GetTMDBTopRatedMovies(c *gin.Context) {
	page := c.DefaultQuery("page", "1")

	movies, err := tmdbClient.GetTopRated(page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Добавляем полные URL для изображений
	for i := range movies.Results {
		if movies.Results[i].PosterPath != "" {
			movies.Results[i].PosterPath = tmdbClient.GetImageURL(movies.Results[i].PosterPath, "w500")
		}
		if movies.Results[i].BackdropPath != "" {
			movies.Results[i].BackdropPath = tmdbClient.GetImageURL(movies.Results[i].BackdropPath, "w1280")
		}
	}

	c.JSON(http.StatusOK, movies)
}

// GetTMDBUpcomingMovies возвращает список предстоящих фильмов из TMDB
// @Summary     Get TMDB upcoming movies
// @Description Get a list of upcoming movies directly from TMDB
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       page query    int false "Page number (default: 1)"
// @Success     200  {object} TMDBMoviesResponse
// @Router      /bridge/tmdb/movie/upcoming [get]
func GetTMDBUpcomingMovies(c *gin.Context) {
	page := c.DefaultQuery("page", "1")

	movies, err := tmdbClient.GetUpcoming(page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Добавляем полные URL для изображений
	for i := range movies.Results {
		if movies.Results[i].PosterPath != "" {
			movies.Results[i].PosterPath = tmdbClient.GetImageURL(movies.Results[i].PosterPath, "w500")
		}
		if movies.Results[i].BackdropPath != "" {
			movies.Results[i].BackdropPath = tmdbClient.GetImageURL(movies.Results[i].BackdropPath, "w1280")
		}
	}

	c.JSON(http.StatusOK, movies)
}

// SearchTMDBMovies ищет фильмы в TMDB
// @Summary     Search TMDB movies
// @Description Search for movies directly in TMDB
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       query query    string true  "Search query"
// @Param       page  query    int    false "Page number (default: 1)"
// @Success     200   {object} tmdb.MoviesResponse
// @Router      /bridge/tmdb/search/movie [get]
func SearchTMDBMovies(c *gin.Context) {
	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter is required"})
		return
	}

	page := c.DefaultQuery("page", "1")
	movies, err := tmdbClient.SearchMovies(query, page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movies)
}

// SearchTMDBTV ищет сериалы в TMDB
// @Summary     Search TMDB TV shows
// @Description Search for TV shows directly in TMDB
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       query query    string true  "Search query"
// @Param       page  query    int    false "Page number (default: 1)"
// @Success     200   {object} tmdb.TVSearchResults
// @Router      /bridge/tmdb/search/tv [get]
func SearchTMDBTV(c *gin.Context) {
	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter is required"})
		return
	}

	page := c.DefaultQuery("page", "1")
	tv, err := tmdbClient.SearchTV(query, page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tv)
}

// DiscoverMovies возвращает список фильмов по фильтрам
// @Summary     Discover movies
// @Description Get a list of movies based on filters
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       page query    int false "Page number (default: 1)"
// @Success     200  {object} TMDBMoviesResponse
// @Router      /bridge/tmdb/discover/movie [get]
func DiscoverMovies(c *gin.Context) {
	page := c.DefaultQuery("page", "1")
	movies, err := tmdbClient.DiscoverMovies(page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, movies)
}

// DiscoverTV возвращает список сериалов по фильтрам
// @Summary     Discover TV shows
// @Description Get a list of TV shows based on filters
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       page query    int false "Page number (default: 1)"
// @Success     200  {object} TMDBMoviesResponse
// @Router      /bridge/tmdb/discover/tv [get]
func DiscoverTV(c *gin.Context) {
	page := c.DefaultQuery("page", "1")
	shows, err := tmdbClient.DiscoverTV(page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, shows)
}

// GetTMDBMovieExternalIDs возвращает внешние идентификаторы фильма
// @Summary     Get TMDB movie external IDs
// @Description Get external IDs (IMDb, Facebook, Instagram, Twitter) for a specific movie
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       id  path     int true "Movie ID"
// @Success     200 {object} tmdb.ExternalIDs
// @Router      /bridge/tmdb/movie/{id}/external_ids [get]
func GetTMDBMovieExternalIDs(c *gin.Context) {
	id := c.Param("id")

	externalIDs, err := tmdbClient.GetMovieExternalIDs(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, externalIDs)
}

// GetTMDBTVExternalIDs возвращает внешние идентификаторы сериала
// @Summary     Get TMDB TV show external IDs
// @Description Get external IDs (IMDb, Facebook, Instagram, Twitter) for a specific TV show
// @Tags        tmdb
// @Accept      json
// @Produce     json
// @Param       id  path     int true "TV Show ID"
// @Success     200 {object} tmdb.ExternalIDs
// @Router      /bridge/tmdb/tv/{id}/external_ids [get]
func GetTMDBTVExternalIDs(c *gin.Context) {
	id := c.Param("id")

	externalIDs, err := tmdbClient.GetTVExternalIDs(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, externalIDs)
}

// HealthCheck godoc
// @Summary Проверка работоспособности API
// @Description Проверяет, что API работает
// @Tags health
// @Produce json
// @Success 200 {object} map[string]string
// @Router /health [get]
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

// InitTMDBClientWithProxy инициализирует TMDB клиент с прокси
func InitTMDBClientWithProxy(apiKey string, proxyAddr string) error {
	tmdbClient = tmdb.NewClient(apiKey)
	return tmdbClient.SetSOCKS5Proxy(proxyAddr)
}

// Admin handlers

// GetAdminMovies возвращает список фильмов для админа
func GetAdminMovies(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Admin movies list"})
}

// ToggleMovieVisibility переключает видимость фильма
func ToggleMovieVisibility(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Movie visibility toggled"})
}

// GetUsers возвращает список пользователей
func GetUsers(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Users list"})
}

// CreateUser создает нового пользователя
func CreateUser(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "User created"})
}

// ToggleAdmin переключает права администратора
func ToggleAdmin(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Admin status toggled"})
}

// SendVerification отправляет код верификации
func SendVerification(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Verification code sent"})
}

// VerifyCode проверяет код верификации
func VerifyCode(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Code verified"})
}
