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
            // Убедимся, что параметры запроса корректны
            const requestParams = {
                ...params,
                language: 'ru-RU',
                region: 'RU'
            };

            console.log('TMDB Request:', { 
                method, 
                endpoint, 
                params: requestParams 
            });

            const response = await this.client({
                method,
                url: endpoint,
                params: requestParams
            });

            console.log('TMDB Response:', {
                endpoint,
                requestParams,
                status: response.status,
                page: response.data.page,
                totalPages: response.data.total_pages,
                resultsCount: response.data.results?.length
            });

            return response;
        } catch (error) {
            console.error('TMDB Error:', {
                endpoint,
                params,
                error: error.message,
                response: error.response?.data
            });
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
        const pageNum = parseInt(page, 10) || 1;
        console.log('Searching movies:', { query, page: pageNum });
        
        const response = await this.makeRequest('GET', '/search/movie', {
            query,
            page: pageNum,
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

        return data;
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
        const pageNum = parseInt(page, 10) || 1;
        console.log('Getting popular movies:', { page: pageNum });
        
        const response = await this.makeRequest('GET', '/movie/popular', { 
            page: pageNum 
        });

        console.log('Popular movies response:', {
            requestedPage: pageNum,
            returnedPage: response.data.page,
            totalPages: response.data.total_pages,
            resultsCount: response.data.results.length
        });

        const data = response.data;
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'original')
        }));

        return data;
    }

    async getTopRatedMovies(page = 1) {
        const pageNum = parseInt(page, 10) || 1;
        const response = await this.makeRequest('GET', '/movie/top_rated', { 
            page: pageNum 
        });

        const data = response.data;
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'original')
        }));

        return data;
    }

    async getUpcomingMovies(page = 1) {
        const pageNum = parseInt(page, 10) || 1;
        const response = await this.makeRequest('GET', '/movie/upcoming', { 
            page: pageNum 
        });

        const data = response.data;
        data.results = data.results.map(movie => ({
            ...movie,
            poster_path: this.getImageURL(movie.poster_path, 'w500'),
            backdrop_path: this.getImageURL(movie.backdrop_path, 'original')
        }));

        return data;
    }

    async getMovieExternalIDs(id) {
        const response = await this.makeRequest('GET', `/movie/${id}/external_ids`);
        return response.data;
    }
}

module.exports = TMDBClient;
