package tmdb

// MoviesResponse представляет ответ от TMDB API со списком фильмов
type MoviesResponse struct {
	Page         int     `json:"page"`
	Results      []Movie `json:"results"`
	TotalPages   int     `json:"total_pages"`
	TotalResults int     `json:"total_results"`
}

// Movie представляет информацию о фильме
type Movie struct {
	Adult            bool     `json:"adult"`
	BackdropPath     string   `json:"backdrop_path"`
	GenreIDs         []int    `json:"genre_ids"`
	ID               int      `json:"id"`
	OriginalLanguage string   `json:"original_language"`
	OriginalTitle    string   `json:"original_title"`
	Overview         string   `json:"overview"`
	Popularity       float64  `json:"popularity"`
	PosterPath       string   `json:"poster_path"`
	ReleaseDate      string   `json:"release_date"`
	Title            string   `json:"title"`
	Video            bool     `json:"video"`
	VoteAverage      float64  `json:"vote_average"`
	VoteCount        int      `json:"vote_count"`
}

// Genre представляет жанр фильма
type Genre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// Collection представляет коллекцию фильмов
type Collection struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	PosterPath   string `json:"poster_path"`
	BackdropPath string `json:"backdrop_path"`
}

// ProductionCompany представляет компанию-производителя
type ProductionCompany struct {
	ID       int    `json:"id"`
	LogoPath string `json:"logo_path"`
	Name     string `json:"name"`
	Country  string `json:"origin_country"`
}

// MovieDetails представляет детальную информацию о фильме
type MovieDetails struct {
	Adult               bool                 `json:"adult"`
	BackdropPath        string              `json:"backdrop_path"`
	BelongsToCollection *Collection         `json:"belongs_to_collection"`
	Budget              int                 `json:"budget"`
	Genres             []Genre             `json:"genres"`
	Homepage           string              `json:"homepage"`
	ID                 int                 `json:"id"`
	IMDbID             string              `json:"imdb_id"`
	OriginalLanguage   string              `json:"original_language"`
	OriginalTitle      string              `json:"original_title"`
	Overview           string              `json:"overview"`
	Popularity         float64             `json:"popularity"`
	PosterPath         string              `json:"poster_path"`
	ProductionCompanies []ProductionCompany `json:"production_companies"`
	ReleaseDate        string              `json:"release_date"`
	Revenue            int                 `json:"revenue"`
	Runtime            int                 `json:"runtime"`
	Status             string              `json:"status"`
	Tagline            string              `json:"tagline"`
	Title              string              `json:"title"`
	Video              bool                `json:"video"`
	VoteAverage        float64             `json:"vote_average"`
	VoteCount          int                 `json:"vote_count"`
}
