const express = require('express');
const router = express.Router();
const { formatDate } = require('../utils/date');

// Middleware для логирования запросов
router.use((req, res, next) => {
    console.log('TV Shows API Request:', {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params
    });
    next();
});

/**
 * @swagger
 * /tv/popular:
 *   get:
 *     summary: Популярные сериалы
 *     description: Получает список популярных сериалов с русскими названиями и описаниями
 *     tags: [tv]
 *     parameters:
 *       - in: query
 *         name: page
 *         description: Номер страницы
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *     responses:
 *       200:
 *         description: Список популярных сериалов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TVShow'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/popular', async (req, res) => {
    try {
        const { page } = req.query;
        const pageNum = parseInt(page, 10) || 1;

        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be greater than 0' });
        }

        const response = await req.tmdb.getPopularTVShows(pageNum);
        
        if (!response || !response.results) {
            throw new Error('Invalid response from TMDB');
        }

        const formattedResults = response.results.map(show => ({
            ...show,
            first_air_date: formatDate(show.first_air_date)
        }));

        res.json({
            ...response,
            results: formattedResults
        });
    } catch (error) {
        console.error('Popular TV shows error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch popular TV shows',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /tv/search:
 *   get:
 *     summary: Поиск сериалов
 *     description: Поиск сериалов по запросу с поддержкой русского языка
 *     tags: [tv]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         description: Поисковый запрос
 *         schema:
 *           type: string
 *         example: Игра престолов
 *       - in: query
 *         name: page
 *         description: Номер страницы (по умолчанию 1)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *     responses:
 *       200:
 *         description: Успешный поиск
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TVShow'
 *       400:
 *         description: Неверный запрос
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/search', async (req, res) => {
    try {
        const { query, page } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be greater than 0' });
        }

        const response = await req.tmdb.searchTVShows(query, pageNum);
        
        if (!response || !response.results) {
            throw new Error('Failed to fetch data from TMDB');
        }

        const formattedResults = response.results.map(show => ({
            ...show,
            first_air_date: formatDate(show.first_air_date)
        }));

        res.json({
            ...response,
            results: formattedResults
        });
    } catch (error) {
        console.error('Search TV shows error:', error);
        res.status(500).json({ 
            error: 'Failed to search TV shows',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /tv/{id}:
 *   get:
 *     summary: Детали сериала
 *     description: Получает подробную информацию о сериале по его ID
 *     tags: [tv]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID сериала
 *         schema:
 *           type: integer
 *         example: 1399
 *     responses:
 *       200:
 *         description: Детали сериала
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TVShow'
 *       404:
 *         description: Сериал не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const show = await req.tmdb.getTVShow(id);
        
        if (!show) {
            return res.status(404).json({ error: 'TV show not found' });
        }

        // Ensure all required fields are present and formatted correctly
        const formattedShow = {
            id: show.id,
            name: show.name,
            overview: show.overview,
            poster_path: show.poster_path,
            backdrop_path: show.backdrop_path,
            first_air_date: formatDate(show.first_air_date),
            vote_average: show.vote_average,
            vote_count: show.vote_count,
            number_of_seasons: show.number_of_seasons,
            number_of_episodes: show.number_of_episodes,
            genres: show.genres || [],
            genre_ids: show.genre_ids || show.genres?.map(g => g.id) || [],
            credits: show.credits || { cast: [], crew: [] },
            videos: show.videos || { results: [] }
        };

        res.json(formattedShow);
    } catch (error) {
        console.error('Get TV show error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch TV show details',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /tv/{id}/external-ids:
 *   get:
 *     summary: Внешние ID сериала
 *     description: Получает внешние идентификаторы сериала (IMDb, и т.д.)
 *     tags: [tv]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID сериала
 *         schema:
 *           type: integer
 *         example: 1399
 *     responses:
 *       200:
 *         description: Внешние ID сериала
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imdb_id:
 *                   type: string
 *                 tvdb_id:
 *                   type: integer
 *                 facebook_id:
 *                   type: string
 *                 instagram_id:
 *                   type: string
 *                 twitter_id:
 *                   type: string
 *       404:
 *         description: Сериал не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/external-ids', async (req, res) => {
    try {
        const { id } = req.params;
        const externalIds = await req.tmdb.getTVShowExternalIDs(id);
        
        if (!externalIds) {
            return res.status(404).json({ error: 'External IDs not found' });
        }

        res.json(externalIds);
    } catch (error) {
        console.error('Get external IDs error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch external IDs',
            details: error.message
        });
    }
});

module.exports = router;