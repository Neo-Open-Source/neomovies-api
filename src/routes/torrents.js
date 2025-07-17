const express = require('express');
const router = express.Router();
const TorrentService = require('../services/torrent.service');

// Создаем экземпляр сервиса
const torrentService = new TorrentService();

// Middleware для логирования запросов
router.use((req, res, next) => {
    console.log('Torrents API Request:', {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params
    });
    next();
});

/**
 * @swagger
 * /torrents/search/{imdbId}:
 *   get:
 *     summary: Поиск торрентов по IMDB ID
 *     description: Поиск торрентов для фильма или сериала по его IMDB ID через bitru.org
 *     tags: [torrents]
 *     parameters:
 *       - in: path
 *         name: imdbId
 *         required: true
 *         description: IMDB ID фильма/сериала (например, tt1234567)
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         required: false
 *         description: Тип контента (movie или tv)
 *         schema:
 *           type: string
 *           enum: [movie, tv]
 *           default: movie
 *       - in: query
 *         name: quality
 *         required: false
 *         description: Желаемое качество (например, 1080p, 4K). Можно указать несколько.
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *       - in: query
 *         name: minQuality
 *         required: false
 *         description: Минимальное качество.
 *         schema:
 *           type: string
 *           enum: ['360p', '480p', '720p', '1080p', '1440p', '2160p']
 *       - in: query
 *         name: maxQuality
 *         required: false
 *         description: Максимальное качество.
 *         schema:
 *           type: string
 *           enum: ['360p', '480p', '720p', '1080p', '1440p', '2160p']
 *       - in: query
 *         name: excludeQualities
 *         required: false
 *         description: Исключить качества. Можно указать несколько.
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *       - in: query
 *         name: hdr
 *         required: false
 *         description: Фильтр по наличию HDR.
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: hevc
 *         required: false
 *         description: Фильтр по наличию HEVC/H.265.
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         required: false
 *         description: Поле для сортировки.
 *         schema:
 *           type: string
 *           enum: [seeders, size, date]
 *           default: seeders
 *       - in: query
 *         name: sortOrder
 *         required: false
 *         description: Порядок сортировки.
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: groupByQuality
 *         required: false
 *         description: Группировать результаты по качеству.
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: season
 *         required: false
 *         description: Номер сезона для сериалов.
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: groupBySeason
 *         required: false
 *         description: Группировать результаты по сезону (только для сериалов).
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Успешный ответ с результатами поиска.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imdbId:
 *                   type: string
 *                 type:
 *                   type: string
 *                 total:
 *                   type: integer
 *                 grouped:
 *                   type: boolean
 *                 results:
 *                   oneOf:
 *                     - type: array
 *                       items:
 *                         $ref: '#/components/schemas/Torrent'
 *                     - type: object
 *                       properties:
 *                         '4K':
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Torrent'
 *                         '1080p':
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Torrent'
 *                         '720p':
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Torrent'
 *       400:
 *         description: Неверный запрос
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Описание ошибки
 *       404:
 *         description: Контент не найден
 *       500:
 *         description: Ошибка сервера
 */
router.get('/search/:imdbId', async (req, res) => {
    try {
        const { imdbId } = req.params;
        const { 
            type = 'movie',
            quality,
            minQuality,
            maxQuality,
            excludeQualities,
            hdr,
            hevc,
            sortBy = 'seeders',
            sortOrder = 'desc',
            groupByQuality = false,
            season,
            groupBySeason = false
        } = req.query;

        // Валидация IMDB ID
        if (!imdbId || !imdbId.match(/^tt\d+$/)) {
            return res.status(400).json({ 
                error: 'Invalid IMDB ID format. Expected format: tt1234567' 
            });
        }

        // Валидация типа контента
        if (!['movie', 'tv'].includes(type)) {
            return res.status(400).json({ 
                error: 'Invalid type. Must be "movie" or "tv"' 
            });
        }

        console.log('Torrent search request:', { imdbId, type, quality, season, groupByQuality, groupBySeason });

        // Поиск торрентов с учетом сезона для сериалов
        const searchOptions = { season: season ? parseInt(season) : null };
        const results = await torrentService.searchTorrentsByImdbId(req.tmdb, imdbId, type, searchOptions);
        console.log(`Found ${results.length} torrents for IMDB ID: ${imdbId}`);

        // Если результатов нет, возвращаем 404
        if (results.length === 0) {
            return res.status(404).json({
                error: 'No torrents found for this IMDB ID',
                imdbId,
                type
            });
        }

        // Применяем фильтрацию по качеству, если указаны параметры
        let filteredResults = results;
        const qualityFilter = {};
        
        if (quality) {
            qualityFilter.qualities = Array.isArray(quality) ? quality : [quality];
        }
        if (minQuality) qualityFilter.minQuality = minQuality;
        if (maxQuality) qualityFilter.maxQuality = maxQuality;
        if (excludeQualities) {
            qualityFilter.excludeQualities = Array.isArray(excludeQualities) ? excludeQualities : [excludeQualities];
        }
        if (hdr !== undefined) qualityFilter.hdr = hdr === 'true';
        if (hevc !== undefined) qualityFilter.hevc = hevc === 'true';
        
        // Применяем фильтрацию, если есть параметры качества
        if (Object.keys(qualityFilter).length > 0) {
            const redApiClient = torrentService.redApiClient;
            filteredResults = redApiClient.filterByQuality(results, qualityFilter);
            console.log(`Filtered to ${filteredResults.length} torrents by quality`);
        }

        // Группировка или обычная сортировка
        let responseData;
        const redApiClient = torrentService.redApiClient;
        
        if (groupBySeason === 'true' || groupBySeason === true) {
            // Группируем по сезону (только для сериалов)
            if (type === 'tv') {
                const groupedResults = redApiClient.groupBySeason(filteredResults);
                responseData = {
                    imdbId,
                    type,
                    total: filteredResults.length,
                    grouped: true,
                    groupedBy: 'season',
                    results: groupedResults
                };
            } else {
                return res.status(400).json({ 
                    error: 'Season grouping is only available for TV series (type=tv)' 
                });
            }
        } else if (groupByQuality === 'true' || groupByQuality === true) {
            // Группируем по качеству
            const groupedResults = redApiClient.groupByQuality(filteredResults);
            
            responseData = {
                imdbId,
                type,
                total: filteredResults.length,
                grouped: true,
                groupedBy: 'quality',
                results: groupedResults
            };
        } else {
            // Обычная сортировка
            const redApiClient = torrentService.redApiClient;
            const sortedResults = redApiClient.sortTorrents(filteredResults, sortBy, sortOrder);
            
            responseData = {
                imdbId,
                type,
                total: filteredResults.length,
                grouped: false,
                season: season ? parseInt(season) : null,
                results: sortedResults
            };
        }

        console.log('Torrent search response:', {
            imdbId,
            type,
            results_count: filteredResults.length,
            grouped: responseData.grouped
        });

        res.json(responseData);
    } catch (error) {
        console.error('Error searching torrents:', error);
        
        // Проверяем, является ли это ошибкой "не найдено"
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Movie/TV show not found',
                details: error.message
            });
        }

        res.status(500).json({ 
            error: 'Failed to search torrents',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /torrents/search:
 *   get:
 *     summary: Поиск торрентов по названию
 *     description: Прямой поиск торрентов по названию на bitru.org
 *     tags: [torrents]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         description: Поисковый запрос
 *         schema:
 *           type: string
 *         example: Матрица
 *       - in: query
 *         name: category
 *         description: Категория поиска (1 - фильмы, 2 - сериалы)
 *         schema:
 *           type: string
 *           enum: ['1', '2']
 *           default: '1'
 *         example: '1'
 *     responses:
 *       200:
 *         description: Результаты поиска
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                   description: Поисковый запрос
 *                 category:
 *                   type: string
 *                   description: Категория поиска
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       url:
 *                         type: string
 *                       size:
 *                         type: string
 *                       seeders:
 *                         type: integer
 *                       leechers:
 *                         type: integer
 *                       source:
 *                         type: string
 *       400:
 *         description: Неверный запрос
 *       500:
 *         description: Ошибка сервера
 */
router.get('/search', async (req, res) => {
    try {
        const { query, category = '1' } = req.query;

        if (!query) {
            return res.status(400).json({ 
                error: 'Query parameter is required' 
            });
        }

        if (!['1', '2'].includes(category)) {
            return res.status(400).json({ 
                error: 'Invalid category. Must be "1" (movies) or "2" (tv shows)' 
            });
        }

        console.log('Direct torrent search request:', { query, category });

        const results = await torrentService.searchTorrents(query, category);

        console.log('Direct torrent search response:', {
            query,
            category,
            results_count: results.length
        });

        res.json({
            query,
            category,
            results
        });
    } catch (error) {
        console.error('Error in direct torrent search:', error);
        res.status(500).json({ 
            error: 'Failed to search torrents',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /torrents/health:
 *   get:
 *     summary: Проверка работоспособности торрент-сервиса
 *     description: Проверяет доступность bitru.org
 *     tags: [torrents]
 *     responses:
 *       200:
 *         description: Сервис работает
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 source:
 *                   type: string
 *                   example: bitru.org
 *       500:
 *         description: Сервис недоступен
 */
router.get('/health', async (req, res) => {
    try {
        const axios = require('axios');
        
        // Проверяем доступность bitru.org
        const response = await axios.get('https://bitru.org', {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            source: 'bitru.org',
            statusCode: response.status
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            source: 'bitru.org',
            error: error.message
        });
    }
});

module.exports = router;
