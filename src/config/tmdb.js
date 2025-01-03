const axios = require('axios');

class TMDBClient {
    constructor(accessToken) {
        if (!accessToken) {
            throw new Error('TMDB access token is required');
        }

        this.client = axios.create({
            baseURL: 'https://api.themoviedb.org/3',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        this.client.interceptors.response.use(
            response => response,
            error => {
                console.error('TMDB API Error:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message
                });
                throw error;
            }
        );
    }

    async makeRequest(method, endpoint, params = {}) {
        try {
            const response = await this.client({
                method,
                url: endpoint,
                params: {
                    ...params,
                    language: 'ru-RU',
                    region: 'RU'
                }
            });
            return response;
        } catch (error) {
            if (error.response) {
                throw new Error(`TMDB API Error: ${error.response.data.status_message || error.message}`);
            }
            throw new Error(`Network Error: ${error.message}`);
        }
    }

    getImageURL(path, size = 'original') {
        if (!path) return null;
        return `https://image.tmdb.org/t/p/${size}${path}`;
    }

    async searchMovies(query, page = 1) {
        const response = await this.makeRequest('GET', '/search/movie', {
            query,
            page,
            include_adult: false
        });

        const data = response.data;
        data.results = data.results
            .filter(movie => movie.poster_path && movie.overview && movie.vote_average > 0)
            .map(movie => ({
                ...movie,
                poster_path: this.getImageURL(movie.poster_path, 'w500'),
                backdrop_path: this.getImageURL(movie.backdrop_path, 'original')
            }));

        return response;
    }

    async getMovie(id) {
        const response = await this.makeRequest('GET', `/movie/${id}`);
        const movie = response.data;
        return {
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'original')
        };
    }

    async getPopularMovies(page = 1) {
        const response = await this.makeRequest('GET', '/movie/popular', { page });
        const data = response.data;
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'original')
        }));
        return response;
    }

    async getTopRatedMovies(page = 1) {
        const response = await this.makeRequest('GET', '/movie/top_rated', { page });
        const data = response.data;
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'original')
        }));
        return response;
    }

    async getUpcomingMovies(page = 1) {
        const response = await this.makeRequest('GET', '/movie/upcoming', { page });
        const data = response.data;
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'original')
        }));
        return response;
    }

    async getMovieExternalIDs(id) {
        const response = await this.makeRequest('GET', `/movie/${id}/external_ids`);
        return response.data;
    }
}

module.exports = TMDBClient;
