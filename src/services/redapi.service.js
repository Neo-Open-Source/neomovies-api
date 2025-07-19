const axios = require('axios');  
  
/**  
 * Клиент для работы с RedAPI (Lampac)  
 * Основан на коде Lampac ApiController.cs и RedApi.cs  
 */  
class RedApiClient {  
    constructor(baseUrl = 'http://redapi.cfhttp.top', apikey = '') {  
        this.baseUrl = baseUrl;  
        this.apikey = apikey;  
    }  
  
    /**  
     * Поиск торрентов через RedAPI с поддержкой сезонов  
     * @param {Object} params - параметры поиска  
     * @returns {Promise<Array>}  
     */  
    async searchTorrents(params) {  
        const {  
            query,           // поисковый запрос  
            title,           // название фильма/сериала  
            title_original,  // оригинальное название  
            year,            // год выпуска  
            is_serial,       // тип контента: 1-фильм, 2-сериал, 5-аниме  
            category,        // категория  
            imdb,            // IMDB ID  
            season           // номер сезона для сериалов  
        } = params;  
  
        const searchParams = new URLSearchParams();  
          
        if (query) searchParams.append('query', query);  
        if (title) searchParams.append('title', title);  
        if (title_original) searchParams.append('title_original', title_original);  
        if (year) searchParams.append('year', year);  
        if (is_serial) searchParams.append('is_serial', is_serial);  
        if (category) searchParams.append('category[]', category);  
        if (imdb) searchParams.append('imdb', imdb);  
        if (season) searchParams.append('season', season);  
        if (this.apikey) searchParams.append('apikey', this.apikey);  
  
        try {  
            console.log('RedAPI search params:', params);  
            console.log('Search URL:', `${this.baseUrl}/api/v2.0/indexers/all/results?${searchParams}`);  
              
            const response = await axios.get(  
                `${this.baseUrl}/api/v2.0/indexers/all/results?${searchParams}`,  
                { timeout: 8000 }  
            );  
  
            return this.parseResults(response.data);  
        } catch (error) {  
            console.error('RedAPI search error:', error.message);  
            return [];  
        }  
    }  
  
    /**  
     * Парсинг результатов поиска с поддержкой сезонов  
     * @param {Object} data - ответ от RedAPI  
     * @returns {Array}  
     */  
    parseResults(data) {  
        if (!data.Results || !Array.isArray(data.Results)) {  
            console.log('RedAPI: No results found or invalid response format');  
            return [];  
        }  
  
        console.log(`RedAPI: Found ${data.Results.length} results`);  
  
        return data.Results.map(torrent => ({  
            title: torrent.Title,  
            tracker: torrent.Tracker,  
            size: torrent.Size,  
            seeders: torrent.Seeders,  
            peers: torrent.Peers,  
            magnet: torrent.MagnetUri,  
            publishDate: torrent.PublishDate,  
            category: torrent.CategoryDesc,  
            quality: torrent.Info?.quality,  
            voice: torrent.Info?.voices,  
            details: torrent.Details,  
            types: torrent.Info?.types,  
            seasons: torrent.Info?.seasons,  
            source: 'RedAPI'  
        }));  
    }  
  
    /**  
     * Фильтрация результатов по типу контента на клиенте  
     * Решает проблему смешанных результатов от API  
     * @param {Array} results - результаты поиска  
     * @param {string} contentType - тип контента (movie/serial/anime)  
     * @returns {Array}  
     */  
    filterByContentType(results, contentType) {  
        return results.filter(torrent => {  
            // Фильтрация по полю types, если оно есть  
            if (torrent.types && Array.isArray(torrent.types)) {  
                switch (contentType) {  
                    case 'movie':  
                        return torrent.types.some(type =>   
                            ['movie', 'multfilm', 'documovie'].includes(type)  
                        );  
                    case 'serial':  
                        return torrent.types.some(type =>   
                            ['serial', 'multserial', 'docuserial', 'tvshow'].includes(type)  
                        );  
                    case 'anime':  
                        return torrent.types.includes('anime');  
                }  
            }  
  
            // Фильтрация по названию, если types недоступно  
            const title = torrent.title.toLowerCase();  
            switch (contentType) {  
                case 'movie':  
                    return !/(сезон|серии|series|season|эпизод)/i.test(title);  
                case 'serial':  
                    return /(сезон|серии|series|season|эпизод)/i.test(title);  
                case 'anime':  
                    return torrent.category === 'TV/Anime' || /anime/i.test(title);  
                default:  
                    return true;  
            }  
        });  
    }  
  
    /**  
     * Поиск фильмов с дополнительной фильтрацией  
     * @param {string} title - название на русском  
     * @param {string} originalTitle - оригинальное название  
     * @param {number} year - год выпуска  
     * @returns {Promise<Array>}  
     */  
    async searchMovies(title, originalTitle, year) {  
        const results = await this.searchTorrents({  
            title,  
            title_original: originalTitle,  
            year,  
            is_serial: 1,  
            category: '2000'  
        });  
  
        return this.filterByContentType(results, 'movie');  
    }  
  
    /**  
     * Поиск сериалов с дополнительной фильтрацией  
     * @param {string} title - название на русском  
     * @param {string} originalTitle - оригинальное название  
     * @param {number} year - год выпуска  
     * @param {number} season - номер сезона (опционально)  
     * @returns {Promise<Array>}  
     */  
    async searchSeries(title, originalTitle, year, season = null) {  
        const searchParams = {
            title,  
            title_original: originalTitle,  
            year,  
            is_serial: 2,  
            category: '5000'
        };
        
        // Добавляем параметр season если он указан
        if (season) {
            searchParams.season = season;
        }
        
        const results = await this.searchTorrents(searchParams);  
  
        return this.filterByContentType(results, 'serial');  
    }  
  
    /**  
     * Поиск аниме  
     * @param {string} title - название на русском  
     * @param {string} originalTitle - оригинальное название  
     * @param {number} year - год выпуска  
     * @returns {Promise<Array>}  
     */  
    async searchAnime(title, originalTitle, year) {  
        const results = await this.searchTorrents({  
            title,  
            title_original: originalTitle,  
            year,  
            is_serial: 5,  
            category: '5070'  
        });  
  
        return this.filterByContentType(results, 'anime');  
    }  
  
    /**  
     * Поиск по общему запросу с фильтрацией качества  
     * @param {string} query - поисковый запрос  
     * @param {string} type - тип контента (movie/serial/anime)  
     * @param {number} year - год выпуска  
     * @returns {Promise<Array>}  
     */  
    async searchByQuery(query, type = 'movie', year = null) {  
        const params = { query };  
          
        if (year) params.year = year;  
          
        switch (type) {  
            case 'movie':  
                params.is_serial = 1;  
                params.category = '2000';  
                break;  
            case 'serial':  
                params.is_serial = 2;  
                params.category = '5000';  
                break;  
            case 'anime':  
                params.is_serial = 5;  
                params.category = '5070';  
                break;  
        }  
  
        const results = await this.searchTorrents(params);  
        return this.filterByContentType(results, type);  
    }  
  
    /**  
     * Получение информации о фильме по IMDB ID через Alloha API  
     * @param {string} imdbId - IMDB ID  
     * @returns {Promise<Object|null>}  
     */  
    async getMovieInfoByImdb(imdbId) {  
        try {  
            const response = await axios.get(  
                `https://api.alloha.tv/?token=04941a9a3ca3ac16e2b4327347bbc1&imdb=${imdbId}`,  
                { timeout: 10000 }  
            );  
  
            const data = response.data?.data;  
            return data ? {  
                name: data.name,  
                original_name: data.original_name  
            } : null;  
        } catch (error) {  
            console.error('Ошибка получения информации по IMDB:', error.message);  
            return null;  
        }  
    }  
  
    /**  
     * Получение информации по Kinopoisk ID  
     * @param {string} kpId - Kinopoisk ID  
     * @returns {Promise<Object|null>}  
     */  
    async getMovieInfoByKinopoisk(kpId) {  
        try {  
            const response = await axios.get(  
                `https://api.alloha.tv/?token=04941a9a3ca3ac16e2b4327347bbc1&kp=${kpId}`,  //Данный токен для alloha является открытым(взят из Lampac)
                { timeout: 10000 }  
            );  
  
            const data = response.data?.data;  
            return data ? {  
                name: data.name,  
                original_name: data.original_name  
            } : null;  
        } catch (error) {  
            console.error('Ошибка получения информации по Kinopoisk ID:', error.message);  
            return null;  
        }  
    }  
  
    /**  
     * Поиск по IMDB ID  
     * @param {string} imdbId - IMDB ID (например, 'tt1234567')  
     * @param {string} type - 'movie', 'serial' или 'anime'  
     * @returns {Promise<Array>}  
     */  
    async searchByImdb(imdbId, type = 'movie') {  
        if (!imdbId || !imdbId.match(/^tt\d+$/)) {  
            throw new Error('Неверный формат IMDB ID. Должен быть в формате tt1234567');  
        }  
  
        console.log(`RedAPI search by IMDB ID: ${imdbId}`);  
          
        // Сначала получаем информацию о фильме  
        const movieInfo = await this.getMovieInfoByImdb(imdbId);  
          
        const params = { imdb: imdbId };  
          
        // Устанавливаем категорию и тип контента  
        switch (type) {  
            case 'movie':  
                params.is_serial = 1;  
                params.category = '2000';  
                break;  
            case 'serial':  
                params.is_serial = 2;  
                params.category = '5000';  
                break;  
            case 'anime':  
                params.is_serial = 5;  
                params.category = '5070';  
                break;  
            default:  
                params.is_serial = 1;  
                params.category = '2000';  
        }  
  
        // Если получили информацию о фильме, добавляем названия  
        if (movieInfo) {  
            params.title = movieInfo.name;  
            params.title_original = movieInfo.original_name;  
        }  
          
        const results = await this.searchTorrents(params);  
        return this.filterByContentType(results, type);  
    }  
  
    /**  
     * Поиск по Kinopoisk ID  
     * @param {string} kpId - Kinopoisk ID  
     * @param {string} type - 'movie', 'serial' или 'anime'  
     * @returns {Promise<Array>}  
     */  
    async searchByKinopoisk(kpId, type = 'movie') {  
        if (!kpId || !kpId.toString().match(/^\d+$/)) {  
            throw new Error('Неверный формат Kinopoisk ID');  
        }  
  
        console.log(`RedAPI search by Kinopoisk ID: ${kpId}`);  
          
        const movieInfo = await this.getMovieInfoByKinopoisk(kpId);  
          
        const params = { query: `kp${kpId}` };  
          
        switch (type) {  
            case 'movie':  
                params.is_serial = 1;  
                params.category = '2000';  
                break;  
            case 'serial':  
                params.is_serial = 2;  
                params.category = '5000';  
                break;  
            case 'anime':  
                params.is_serial = 5;  
                params.category = '5070';  
                break;  
        }  
  
        if (movieInfo) {  
            params.title = movieInfo.name;  
            params.title_original = movieInfo.original_name;  
        }  
          
        const results = await this.searchTorrents(params);  
        return this.filterByContentType(results, type);  
    }  
  
    /**
     * Расширенная фильтрация по качеству
     * @param {Array} results - результаты поиска
     * @param {Object} qualityFilter - объект с параметрами фильтрации качества
     * @returns {Array}
     */
    filterByQuality(results, qualityFilter = {}) {
        if (!qualityFilter || Object.keys(qualityFilter).length === 0) {
            return results;
        }

        const {
            qualities = [],      // ['1080p', '720p', '4K', '2160p']
            minQuality = null,   // минимальное качество
            maxQuality = null,   // максимальное качество
            excludeQualities = [], // исключить качества
            hdr = null,          // true/false для HDR
            hevc = null          // true/false для HEVC/H.265
        } = qualityFilter;

        // Порядок качества от низкого к высокому
        const qualityOrder = ['360p', '480p', '720p', '1080p', '1440p', '2160p', '4K'];
        
        return results.filter(torrent => {
            const title = torrent.title.toLowerCase();
            
            // Определяем качество из названия
            const detectedQuality = this.detectQuality(title);
            
            // Фильтрация по конкретным качествам
            if (qualities.length > 0) {
                const hasQuality = qualities.some(q => 
                    title.includes(q.toLowerCase()) || 
                    (q === '4K' && title.includes('2160p'))
                );
                if (!hasQuality) return false;
            }

            // Фильтрация по минимальному качеству
            if (minQuality && detectedQuality) {
                const minIndex = qualityOrder.indexOf(minQuality);
                const currentIndex = qualityOrder.indexOf(detectedQuality);
                if (currentIndex !== -1 && minIndex !== -1 && currentIndex < minIndex) {
                    return false;
                }
            }

            // Фильтрация по максимальному качеству
            if (maxQuality && detectedQuality) {
                const maxIndex = qualityOrder.indexOf(maxQuality);
                const currentIndex = qualityOrder.indexOf(detectedQuality);
                if (currentIndex !== -1 && maxIndex !== -1 && currentIndex > maxIndex) {
                    return false;
                }
            }

            // Исключение определенных качеств
            if (excludeQualities.length > 0) {
                const hasExcluded = excludeQualities.some(q => 
                    title.includes(q.toLowerCase())
                );
                if (hasExcluded) return false;
            }

            // Фильтрация по HDR
            if (hdr !== null) {
                const hasHDR = /hdr|dolby.vision|dv/i.test(title);
                if (hdr && !hasHDR) return false;
                if (!hdr && hasHDR) return false;
            }

            // Фильтрация по HEVC
            if (hevc !== null) {
                const hasHEVC = /hevc|h\.265|x265/i.test(title);
                if (hevc && !hasHEVC) return false;
                if (!hevc && hasHEVC) return false;
            }

            return true;
        });
    }

    /**
     * Определение качества из названия торрента
     * @param {string} title - название торрента
     * @returns {string|null}
     */
    detectQuality(title) {
        const qualityPatterns = [
            { pattern: /2160p|4k/i, quality: '2160p' },
            { pattern: /1440p/i, quality: '1440p' },
            { pattern: /1080p/i, quality: '1080p' },
            { pattern: /720p/i, quality: '720p' },
            { pattern: /480p/i, quality: '480p' },
            { pattern: /360p/i, quality: '360p' }
        ];

        for (const { pattern, quality } of qualityPatterns) {
            if (pattern.test(title)) {
                return quality;
            }
        }

        return null;
    }

    /**
     * Получение статистики по качеству
     * @param {Array} results - результаты поиска
     * @returns {Object}
     */
    getQualityStats(results) {
        const stats = {};
        
        results.forEach(torrent => {
            const quality = this.detectQuality(torrent.title.toLowerCase());
            if (quality) {
                stats[quality] = (stats[quality] || 0) + 1;
            }
        });

        return stats;
    }

    /**
     * Группировка результатов по качеству
     * @param {Array} results - результаты поиска
     * @returns {Object} - объект с группами качества
     */
    groupByQuality(results) {
        const groups = {
            '4K': [],
            '2160p': [],
            '1440p': [],
            '1080p': [],
            '720p': [],
            '480p': [],
            '360p': [],
            'unknown': []
        };

        results.forEach(torrent => {
            const quality = this.detectQuality(torrent.title.toLowerCase());
            
            if (quality) {
                // Объединяем 4K и 2160p в одну группу
                if (quality === '2160p') {
                    groups['4K'].push(torrent);
                } else {
                    groups[quality].push(torrent);
                }
            } else {
                groups['unknown'].push(torrent);
            }
        });

        // Удаляем пустые группы и сортируем по качеству (от высокого к низкому)
        const sortedGroups = {};
        const qualityOrder = ['4K', '1440p', '1080p', '720p', '480p', '360p', 'unknown'];
        
        qualityOrder.forEach(quality => {
            if (groups[quality].length > 0) {
                // Сортируем торренты внутри группы по сидам
                groups[quality].sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
                sortedGroups[quality] = groups[quality];
            }
        });

        return sortedGroups;
    }

    /**
     * Расширенный поиск с поддержкой сезонов
     * @param {Object} searchParams - параметры поиска
     * @param {Object} qualityFilter - фильтр качества
     * @returns {Promise<Array>}
     */
    async searchWithQualityFilter(searchParams, qualityFilter = {}) {
        const results = await this.searchTorrents(searchParams);
        
        // Применяем фильтрацию по типу контента
        let filteredResults = results;
        if (searchParams.contentType) {
            filteredResults = this.filterByContentType(results, searchParams.contentType);
        }
        
        // Применяем фильтрацию по сезону (дополнительная на клиенте)
        if (searchParams.season && !searchParams.seasonFromAPI) {
            filteredResults = this.filterBySeason(filteredResults, searchParams.season);
        }
        
        // Применяем фильтрацию по качеству
        filteredResults = this.filterByQuality(filteredResults, qualityFilter);
        
        // Сортируем результаты
        if (qualityFilter.sortBy) {
            filteredResults = this.sortTorrents(filteredResults, qualityFilter.sortBy, qualityFilter.sortOrder);
        }
        
        return filteredResults;
    }

    /**
     * Сортировка результатов
     * @param {Array} results - результаты поиска
     * @param {string} sortBy - поле для сортировки (seeders/size/date)
     * @param {string} order - порядок сортировки (asc/desc)
     * @returns {Array}
     */
    sortTorrents(results, sortBy = 'seeders', order = 'desc') {
        return results.sort((a, b) => {
            let valueA, valueB;
            
            switch (sortBy) {
                case 'seeders':
                    valueA = a.seeders || 0;
                    valueB = b.seeders || 0;
                    break;
                case 'size':
                    valueA = a.size || 0;
                    valueB = b.size || 0;
                    break;
                case 'date':
                    valueA = new Date(a.publishDate || 0);
                    valueB = new Date(b.publishDate || 0);
                    break;
                default:
                    return 0;
            }
            
            if (order === 'asc') {
                return valueA - valueB;
            } else {
                return valueB - valueA;
            }
        });
    }

    /**
     * Поиск сериалов с поддержкой выбора сезона
     * @param {string} title - название на русском
     * @param {string} originalTitle - оригинальное название
     * @param {number} year - год выпуска
     * @param {number} season - номер сезона (опционально)
     * @param {Object} qualityFilter - фильтр качества
     * @returns {Promise<Array>}
     */
    async searchSeries(title, originalTitle, year, season = null, qualityFilter = {}) {
        const params = {
            title,
            title_original: originalTitle,
            year,
            is_serial: 2,
            category: '5000',
            contentType: 'serial'
        };

        if (season) {
            params.season = season;
        }

        return this.searchWithQualityFilter(params, qualityFilter);
    }

    /**
     * Получение доступных сезонов для сериала
     * @param {string} title - название сериала
     * @param {string} originalTitle - оригинальное название
     * @param {number} year - год выпуска
     * @returns {Promise<Array>} - массив номеров сезонов
     */
    async getAvailableSeasons(title, originalTitle, year) {
        const results = await this.searchSeries(title, originalTitle, year);
        const seasons = new Set();

        results.forEach(torrent => {
            // Extract from the dedicated field
            if (torrent.seasons && Array.isArray(torrent.seasons)) {
                torrent.seasons.forEach(s => seasons.add(parseInt(s)));
            }

            // Extract from title
            const title = torrent.title;
            const seasonRegex = /(?:s|сезон)[\s:]*(\d+)|(\d+)\s*сезон/gi;
            for (const match of title.matchAll(seasonRegex)) {
                const seasonNumber = parseInt(match[1] || match[2]);
                if (!isNaN(seasonNumber)) {
                    seasons.add(seasonNumber);
                }
            }
        });

        return Array.from(seasons).sort((a, b) => a - b);
    }

    /**
     * Фильтрация результатов по сезону на клиенте
     * Показываем только те торренты, где в названии найден номер сезона
     * @param {Array} results - результаты поиска
     * @param {number} season - номер сезона
     * @returns {Array}
     */
    filterBySeason(results, season) {
        if (!season) return results;

        return results.filter(torrent => {
            // Используем точную регулярку для поиска сезона в названии
            const title = torrent.title;
            const seasonRegex = /(?:s|сезон)[\s:]*(\d+)|(\d+)\s*сезон/gi;
            
            // Проверяем, есть ли в названии нужный сезон
            let foundSeason = false;
            for (const match of title.matchAll(seasonRegex)) {
                const seasonNumber = parseInt(match[1] || match[2]);
                if (!isNaN(seasonNumber) && seasonNumber === season) {
                    foundSeason = true;
                    break;
                }
            }
            
            return foundSeason;
        });
    }

    /**
     * Поиск конкретного сезона сериала
     * @param {string} title - название сериала
     * @param {string} originalTitle - оригинальное название
     * @param {number} year - год выпуска
     * @param {number} season - номер сезона
     * @param {Object} qualityFilter - фильтр качества
     * @returns {Promise<Array>}
     */
    async searchSeriesSeason(title, originalTitle, year, season, qualityFilter = {}) {
        // Сначала пробуем поиск с параметром season
        let results = await this.searchSeries(title, originalTitle, year, season, qualityFilter);

        // Если результатов мало, делаем общий поиск и фильтруем на клиенте
        if (results.length < 5) {
            const allResults = await this.searchSeries(title, originalTitle, year, null, qualityFilter);
            const filteredResults = this.filterBySeason(allResults, season);
            
            // Объединяем результаты и убираем дубликаты
            const combined = [...results, ...filteredResults];
            const unique = combined.filter((torrent, index, self) => 
                index === self.findIndex(t => t.magnet === torrent.magnet)
            );
            
            results = unique;
        }

        return results;
    }

    /**
     * Группировка результатов по сезону
     * @param {Array} results - результаты поиска
     * @returns {Object} - объект с группами по сезонам
     */
    groupBySeason(results) {
        const grouped = {};
        
        results.forEach(torrent => {
            const seasons = new Set();
            
            // Extract seasons from the dedicated field
            if (torrent.seasons && Array.isArray(torrent.seasons)) {
                torrent.seasons.forEach(s => seasons.add(parseInt(s)));
            }
            
            // Extract from title as a fallback or supplement
            const title = torrent.title;
            const seasonRegex = /(?:s|сезон)[\s:]*(\d+)|(\d+)\s*сезон/gi;
            for (const match of title.matchAll(seasonRegex)) {
                const seasonNumber = parseInt(match[1] || match[2]);
                if (!isNaN(seasonNumber)) {
                    seasons.add(seasonNumber);
                }
            }

            const seasonsArray = Array.from(seasons);
            
            // If no season is found, group as 'unknown'
            if (seasonsArray.length === 0) {
                seasonsArray.push('unknown');
            }
            
            // Add torrent to all relevant season groups
            seasonsArray.forEach(season => {
                const seasonKey = season === 'unknown' ? 'Неизвестно' : `Сезон ${season}`;
                if (!grouped[seasonKey]) {
                    grouped[seasonKey] = [];
                }
                // Ensure torrent is not added to the same group twice
                if (!grouped[seasonKey].find(t => t.magnet === torrent.magnet)) {
                    grouped[seasonKey].push(torrent);
                }
            });
        });
        
        // Sort torrents within each group by seeders
        Object.keys(grouped).forEach(season => {
            grouped[season].sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
        });
        
        return grouped;
    }
}  
  
module.exports = RedApiClient;