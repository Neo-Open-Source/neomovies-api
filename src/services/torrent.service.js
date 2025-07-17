const RedApiClient = require('./redapi.service');

class TorrentService {
    constructor() {
        this.redApiClient = new RedApiClient();
    }

    /**
     * Получить название фильма/сериала по IMDB ID
     * @param {object} tmdbClient - TMDB клиент
     * @param {string} imdbId - IMDB ID (например, 'tt1234567')
     * @param {string} type - 'movie' или 'tv'
     * @returns {Promise<{originalTitle: string, russianTitle: string, year: string}|null>}
     */
    async getTitleByImdbId(tmdbClient, imdbId, type) {
        try {
            const tmdbType = (type === 'serial' || type === 'tv') ? 'tv' : 'movie';

            const response = await tmdbClient.makeRequest('GET', `/find/${imdbId}`, {
                params: {
                    external_source: 'imdb_id',
                    language: 'ru-RU'
                }
            });
            
            const data = response.data;
            const results = tmdbType === 'movie' ? data.movie_results : data.tv_results;

            if (results && results.length > 0) {
                const item = results[0];
                const tmdbId = item.id;

                // Получаем детали для оригинального названия
                const detailsResponse = await tmdbClient.makeRequest('GET', 
                    tmdbType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`, 
                    {
                        params: {
                            language: 'en-US' // Получаем оригинальное название
                        }
                    }
                );

                const details = detailsResponse.data;
                const originalTitle = tmdbType === 'movie'
                    ? details.original_title || details.title
                    : details.original_name || details.name;

                const russianTitle = tmdbType === 'movie'
                    ? item.title || item.original_title
                    : item.name || item.original_name;

                return {
                    originalTitle: originalTitle,
                    russianTitle: russianTitle,
                    year: (item.release_date || item.first_air_date)?.split('-')[0]
                };
            }
            return null;
        } catch (error) {
            console.error(`Error getting title by IMDB ID: ${error.message}`);
            return null;
        }
    }

    /**
     * Поиск торрентов по IMDB ID через RedAPI с поддержкой сезонов
     * @param {object} tmdbClient - TMDB клиент
     * @param {string} imdbId - IMDB ID (tt1234567)
     * @param {string} type - 'movie' или 'tv'
     * @param {Object} options - дополнительные опции (например, season)
     * @returns {Promise<Array>}
     */
    async searchTorrentsByImdbId(tmdbClient, imdbId, type = 'movie', options = {}) {
        try {
            console.log(`Starting RedAPI torrent search for IMDB ID: ${imdbId}, type: ${type}, season: ${options.season || 'all'}`);
            
            const movieInfo = await this.getTitleByImdbId(tmdbClient, imdbId, type);
            if (!movieInfo) {
                console.log('No movie info found for IMDB ID:', imdbId);
                return [];
            }
            
            console.log('Movie info found:', movieInfo);
            
            let results = [];
            if (type === 'movie') {
                results = await this.redApiClient.searchMovies(
                    movieInfo.russianTitle,
                    movieInfo.originalTitle,
                    movieInfo.year
                );
            } else {
                // Для сериалов используем метод с поддержкой сезонов
                if (options.season) {
                    results = await this.redApiClient.searchSeriesSeason(
                        movieInfo.russianTitle,
                        movieInfo.originalTitle,
                        movieInfo.year,
                        options.season
                    );
                } else {
                    results = await this.redApiClient.searchSeries(
                        movieInfo.russianTitle,
                        movieInfo.originalTitle,
                        movieInfo.year
                    );
                }
            }

            if (results.length === 0) {
                console.log('No results found by titles, trying query search...');
                const query = movieInfo.originalTitle || movieInfo.russianTitle;
                let searchQuery = `${query} ${movieInfo.year}`;
                if (options.season && type === 'tv') {
                    searchQuery += ` season ${options.season}`;
                }
                results = await this.redApiClient.searchByQuery(searchQuery, type, movieInfo.year);
            }

            console.log(`Found ${results.length} torrent results via RedAPI`);
            return results.slice(0, 20);
        } catch (e) {
            console.error('Error searching torrents by IMDB ID:', e.message);
            return [];
        }
    }
}

module.exports = TorrentService;
