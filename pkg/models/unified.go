package models

import "time"

// Unified entities and response envelopes for prefixed-source API

type UnifiedGenre struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}

type UnifiedCastMember struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    Character string `json:"character,omitempty"`
}

type UnifiedExternalIDs struct {
    KP   *int   `json:"kp"`
    TMDB *int   `json:"tmdb"`
    IMDb string `json:"imdb"`
}

type UnifiedContent struct {
    ID            string              `json:"id"`
    SourceID      string              `json:"sourceId"`
    Title         string              `json:"title"`
    OriginalTitle string              `json:"originalTitle"`
    Description   string              `json:"description"`
    ReleaseDate   string              `json:"releaseDate"`
    EndDate       *string             `json:"endDate"`
    Type          string              `json:"type"` // movie | tv
    Genres        []UnifiedGenre      `json:"genres"`
    Rating        float64             `json:"rating"`
    PosterURL     string              `json:"posterUrl"`
    BackdropURL   string              `json:"backdropUrl"`
    Director      string              `json:"director"`
    Cast          []UnifiedCastMember `json:"cast"`
    Duration      int                 `json:"duration"`
    Country       string              `json:"country"`
    Language      string              `json:"language"`
    Budget        *int64              `json:"budget"`
    Revenue       *int64              `json:"revenue"`
    IMDbID        string              `json:"imdbId"`
    ExternalIDs   UnifiedExternalIDs  `json:"externalIds"`
    // For TV shows
    Seasons       []UnifiedSeason     `json:"seasons,omitempty"`
}

type UnifiedSeason struct {
    ID           string           `json:"id"`
    SourceID     string           `json:"sourceId"`
    Name         string           `json:"name"`
    SeasonNumber int              `json:"seasonNumber"`
    EpisodeCount int              `json:"episodeCount"`
    ReleaseDate  string           `json:"releaseDate"`
    PosterURL    string           `json:"posterUrl"`
    Episodes     []UnifiedEpisode `json:"episodes,omitempty"`
}

type UnifiedEpisode struct {
    ID           string `json:"id"`
    SourceID     string `json:"sourceId"`
    Name         string `json:"name"`
    EpisodeNumber int   `json:"episodeNumber"`
    SeasonNumber  int   `json:"seasonNumber"`
    AirDate      string `json:"airDate"`
    Duration     int    `json:"duration"`
    Description  string `json:"description"`
    StillURL     string `json:"stillUrl"`
}

type UnifiedSearchItem struct {
    ID          string             `json:"id"`
    SourceID    string             `json:"sourceId"`
    Title       string             `json:"title"`
    Type        string             `json:"type"`
    OriginalType string            `json:"originalType,omitempty"`
    ReleaseDate string             `json:"releaseDate"`
    PosterURL   string             `json:"posterUrl"`
    Rating      float64            `json:"rating"`
    Description string             `json:"description"`
    ExternalIDs UnifiedExternalIDs `json:"externalIds"`
}

type UnifiedPagination struct {
    Page         int `json:"page"`
    TotalPages   int `json:"totalPages"`
    TotalResults int `json:"totalResults"`
    PageSize     int `json:"pageSize"`
}

type UnifiedMetadata struct {
    FetchedAt    time.Time `json:"fetchedAt"`
    APIVersion   string    `json:"apiVersion"`
    ResponseTime int64     `json:"responseTime"`
    Query        string    `json:"query,omitempty"`
}

type UnifiedAPIResponse struct {
    Success  bool            `json:"success"`
    Data     interface{}     `json:"data,omitempty"`
    Error    string          `json:"error,omitempty"`
    Source   string          `json:"source,omitempty"`
    Metadata UnifiedMetadata `json:"metadata"`
}

type UnifiedSearchResponse struct {
    Success    bool                `json:"success"`
    Data       []UnifiedSearchItem `json:"data"`
    Source     string              `json:"source"`
    Pagination UnifiedPagination   `json:"pagination"`
    Metadata   UnifiedMetadata     `json:"metadata"`
}
