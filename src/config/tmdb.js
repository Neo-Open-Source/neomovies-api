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

    async makeRequest(method, endpoint, options = {}) {
        try {
            // Здесь была ошибка - если передать {params: {...}} в options,
            // то мы создаем вложенный объект params.params
            const clientOptions = {
                method,
                url: endpoint,
                ...options
            };
            
            // Если не передали params, добавляем базовые
            if (!clientOptions.params) {
                clientOptions.params = {};
            }
            
            // Добавляем базовые параметры, если их еще нет
            if (!clientOptions.params.language) {
                clientOptions.params.language = 'ru-RU';
            }
            
            if (!clientOptions.params.region) {
                clientOptions.params.region = 'RU';
            }

            console.log('TMDB Request:', { 
                method, 
                endpoint, 
                options: clientOptions 
            });

            const response = await this.client(clientOptions);

            return response;
        } catch (error) {
            console.error('TMDB Error:', {
                endpoint,
                params,
                error: error.message,
                response: error.response?.data
            });
            throw error;
        }
    }

    getImageURL(path, size = 'original') {
        if (!path) return null;
        return `https://image.tmdb.org/t/p/${size}${path}`;
    }

    isReleased(releaseDate) {
        if (!releaseDate) return false;

        // Если дата в будущем формате (с "г."), пропускаем фильм
        if (releaseDate.includes(' г.')) {
            const currentYear = new Date().getFullYear();
            const yearStr = releaseDate.split(' ')[2];
            const year = parseInt(yearStr, 10);
            return year <= currentYear;
        }

        // Для ISO дат
        const date = new Date(releaseDate);
        if (isNaN(date.getTime())) return true; // Если не смогли распарсить, пропускаем

        const currentDate = new Date();
        return date <= currentDate;
    }

    filterAndProcessResults(results, type = 'movie') {
        if (!Array.isArray(results)) {
            console.error('Expected results to be an array, got:', typeof results);
            return [];
        }

        console.log(`Filtering ${type}s, total before:`, results.length);
        
        const filteredResults = results.filter(item => {
            if (!item || typeof item !== 'object') {
                console.log('Skipping invalid item object');
                return false;
            }

            // Проверяем название (для фильмов - title, для сериалов - name)
            const title = type === 'movie' ? item.title : item.name;
            const isNumericTitle = /^\d+$/.test(title || '');
            const hasCyrillic = /[а-яА-ЯёЁ]/.test(title || '');
            const hasValidTitle = isNumericTitle || hasCyrillic;

            if (!hasValidTitle) {
                console.log(`Skipping ${type} - invalid title:`, title);
                return false;
            }

            // Проверяем рейтинг
            const hasValidRating = item.vote_average > 0;
            if (!hasValidRating) {
                console.log(`Skipping ${type} - no rating:`, title);
                return false;
            }

            return true;
        });

        console.log(`${type}s after filtering:`, filteredResults.length);

        return filteredResults.map(item => ({
            ...item,
            poster_path: this.getImageURL(item.poster_path, 'w500'),
            backdrop_path: this.getImageURL(item.backdrop_path, 'original')
        }));
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
        data.results = this.filterAndProcessResults(data.results, 'movie');
        return data;
    }

    async getPopularMovies(page = 1) {
        const pageNum = parseInt(page, 10) || 1;
        console.log('Getting popular movies:', { page: pageNum });
        
        const response = await this.makeRequest('GET', '/movie/popular', { 
            page: pageNum 
        });

        const data = response.data;
        data.results = this.filterAndProcessResults(data.results, 'movie');
        return data;
    }

    async getTopRatedMovies(page = 1) {
        const pageNum = parseInt(page, 10) || 1;
        const response = await this.makeRequest('GET', '/movie/top_rated', { 
            page: pageNum 
        });

        const data = response.data;
        data.results = this.filterAndProcessResults(data.results, 'movie');
        return data;
    }

    async getUpcomingMovies(page = 1) {
        const pageNum = parseInt(page, 10) || 1;
        const response = await this.makeRequest('GET', '/movie/upcoming', { 
            page: pageNum 
        });

        const data = response.data;
        data.results = this.filterAndProcessResults(data.results, 'movie');
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

    async getMovieExternalIDs(id) {
        const response = await this.makeRequest('GET', `/movie/${id}/external_ids`);
        return response.data;
    }

    async getMovieVideos(id) {
        const response = await this.makeRequest('GET', `/movie/${id}/videos`);
        return response.data;
    }

    // Получение жанров фильмов
    async getMovieGenres() {
        console.log('Getting movie genres');
        try {
            const response = await this.makeRequest('GET', '/genre/movie/list', {
                language: 'ru'
            });
            return response.data;
        } catch (error) {
            console.error('Error getting movie genres:', error.message);
            throw error;
        }
    }

    // Получение жанров сериалов
    async getTVGenres() {
        console.log('Getting TV genres');
        try {
            const response = await this.makeRequest('GET', '/genre/tv/list', {
                language: 'ru'
            });
            return response.data;
        } catch (error) {
            console.error('Error getting TV genres:', error.message);
            throw error;
        }
    }
    
    // Получение всех жанров (фильмы и сериалы)
    async getAllGenres() {
        console.log('Getting all genres (movies and TV)');
        try {
            const [movieGenres, tvGenres] = await Promise.all([
                this.getMovieGenres(),
                this.getTVGenres()
            ]);
            
            // Объединяем жанры, удаляя дубликаты по ID
            const allGenres = [...movieGenres.genres];
            
            // Добавляем жанры сериалов, которых нет в фильмах
            tvGenres.genres.forEach(tvGenre => {
                if (!allGenres.some(genre => genre.id === tvGenre.id)) {
                    allGenres.push(tvGenre);
                }
            });
            
            return { genres: allGenres };
        } catch (error) {
            console.error('Error getting all genres:', error.message);
            throw error;
        }
    }

    async getMoviesByGenre(genreId, page = 1) {
        return this.makeRequest('GET', '/discover/movie', {
            params: {
                with_genres: genreId,
                page,
                sort_by: 'popularity.desc',
                'vote_count.gte': 100,
                include_adult: false
            }
        });
    }

    async getPopularTVShows(page = 1) {
        const pageNum = parseInt(page, 10) || 1;
        console.log('Getting popular TV shows:', { page: pageNum });
        
        const response = await this.makeRequest('GET', '/tv/popular', { 
            page: pageNum 
        });

        return {
            ...response.data,
            results: this.filterAndProcessResults(response.data.results, 'tv')
        };
    }

    async searchTVShows(query, page = 1) {
        const pageNum = parseInt(page, 10) || 1;
        console.log('Searching TV shows:', { query, page: pageNum });
        
        const response = await this.makeRequest('GET', '/search/tv', {
            query,
            page: pageNum,
            include_adult: false
        });

        return {
            ...response.data,
            results: this.filterAndProcessResults(response.data.results, 'tv')
        };
    }

    async getTVShow(id) {
        const response = await this.makeRequest('GET', `/tv/${id}`, {
            append_to_response: 'credits,videos,similar,external_ids'
        });

        const show = response.data;
        return {
            ...show,
            poster_path: this.getImageURL(show.poster_path, 'w500'),
            backdrop_path: this.getImageURL(show.backdrop_path, 'original'),
            credits: show.credits || { cast: [], crew: [] },
            videos: show.videos || { results: [] }
        };
    }

    async getTVShowExternalIDs(id) {
        const response = await this.makeRequest('GET', `/tv/${id}/external_ids`);
        return response.data;
    }

    async getTVShowVideos(id) {
        const response = await this.makeRequest('GET', `/tv/${id}/videos`);
        return response.data;
    }
}

module.exports = TMDBClient;