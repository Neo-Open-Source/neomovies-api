package api

// Genre представляет жанр фильма
type Genre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// Movie представляет базовую информацию о фильме
type Movie struct {
	ID           int     `json:"id"`
	Title        string  `json:"title"`
	Overview     string  `json:"overview"`
	PosterPath   *string `json:"poster_path"`
	BackdropPath *string `json:"backdrop_path"`
	ReleaseDate  string  `json:"release_date"`
	VoteAverage  float64 `json:"vote_average"`
	Genres       []Genre `json:"genres"`
}

// MovieDetails представляет детальную информацию о фильме
type MovieDetails struct {
	Movie
	Runtime int    `json:"runtime"`
	Tagline string `json:"tagline"`
	Budget  int    `json:"budget"`
	Revenue int    `json:"revenue"`
	Status  string `json:"status"`
}

// MoviesResponse представляет ответ со списком фильмов
type MoviesResponse struct {
	Page         int     `json:"page"`
	TotalPages   int     `json:"total_pages"`
	TotalResults int     `json:"total_results"`
	Results      []Movie `json:"results"`
}

// TMDBMoviesResponse представляет ответ со списком фильмов от TMDB API
type TMDBMoviesResponse struct {
	Page         int     `json:"page"`
	TotalPages   int     `json:"total_pages"`
	TotalResults int     `json:"total_results"`
	Results      []Movie `json:"results"`
}

// SearchResponse представляет ответ на поисковый запрос
type SearchResponse struct {
	Page         int             `json:"page"`
	TotalPages   int             `json:"total_pages"`
	TotalResults int             `json:"total_results"`
	Results      []MovieResponse `json:"results"`
}

// MovieResponse представляет информацию о фильме в ответе API
type MovieResponse struct {
	ID           int     `json:"id"`
	Title        string  `json:"title"`
	Overview     string  `json:"overview"`
	ReleaseDate  string  `json:"release_date"`
	VoteAverage  float64 `json:"vote_average"`
	PosterPath   string  `json:"poster_path"`
	BackdropPath string  `json:"backdrop_path"`
}
