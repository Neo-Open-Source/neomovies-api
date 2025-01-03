const axios = require('axios');

class TMDBClient {
    constructor(accessToken) {
        this.client = axios.create({
            baseURL: 'https://api.themoviedb.org/3',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
    }

    async makeRequest(method, endpoint, params = {}) {
        try {
            const response = await this.client.request({
                method,
                url: endpoint,
                params: {
                    ...params,
                    language: 'ru-RU',
                    region: 'RU'
                }
            });
            return response.data;
        } catch (error) {
            console.error(`TMDB API Error: ${error.message}`);
            throw error;
        }
    }

    getImageURL(path, size = 'original') {
        if (!path) return null;
        return `https://image.tmdb.org/t/p/${size}${path}`;
    }

    async searchMovies(query, page = 1) {
        const data = await this.makeRequest('GET', '/search/movie', {
            query,
            page,
            include_adult: false
        });

        // Фильтруем результаты
        data.results = data.results.filter(movie => 
            movie.poster_path && 
            movie.overview && 
            movie.vote_average > 0
        );

        // Добавляем полные URL для изображений
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'w1280')
        }));

        return data;
    }

    async getMovie(id) {
        const movie = await this.makeRequest('GET', `/movie/${id}`);
        return {
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'w1280')
        };
    }

    async getPopularMovies(page = 1) {
        const data = await this.makeRequest('GET', '/movie/popular', { page });
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'w1280')
        }));
        return data;
    }

    async getTopRatedMovies(page = 1) {
        const data = await this.makeRequest('GET', '/movie/top_rated', { page });
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'w1280')
        }));
        return data;
    }

    async getUpcomingMovies(page = 1) {
        const data = await this.makeRequest('GET', '/movie/upcoming', { page });
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'w1280')
        }));
        return data;
    }

    async getMovieExternalIDs(id) {
        return await this.makeRequest('GET', `/movie/${id}/external_ids`);
    }
}

module.exports = TMDBClient;
