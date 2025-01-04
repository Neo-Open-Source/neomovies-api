const express = require('express');
const router = express.Router();
const { formatDate } = require('../utils/date');

// Middleware для логирования запросов
router.use((req, res, next) => {
    console.log('Movies API Request:', {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params
    });
    next();
});

/**
 * @swagger
 * /movies/search:
 *   get:
 *     summary: Поиск фильмов
 *     description: Поиск фильмов по запросу с поддержкой русского языка
 *     tags: [movies]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         description: Поисковый запрос
 *         schema:
 *           type: string
 *         example: Матрица
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
 *                   description: Текущая страница
 *                 total_pages:
 *                   type: integer
 *                   description: Всего страниц
 *                 total_results:
 *                   type: integer
 *                   description: Всего результатов
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Movie'
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
        const { query, page = 1 } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        const response = await req.tmdb.searchMovies(query, page);
        
        if (!response || !response.data) {
            throw new Error('Failed to fetch data from TMDB');
        }

        const { results, ...rest } = response.data;
        
        const formattedResults = results.map(movie => ({
            ...movie,
            release_date: formatDate(movie.release_date)
        }));

        res.json({
            ...rest,
            results: formattedResults
        });
    } catch (error) {
        console.error('Search movies error:', error);
        res.status(500).json({ 
            error: 'Failed to search movies',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /movies/{id}:
 *   get:
 *     summary: Получить информацию о фильме
 *     description: Получает детальную информацию о фильме по ID
 *     tags: [movies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID фильма
 *         schema:
 *           type: integer
 *         example: 603
 *     responses:
 *       200:
 *         description: Информация о фильме
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Movie'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res) => {
    try {
        const movie = await req.tmdb.getMovie(req.params.id);
        res.json({
            ...movie,
            release_date: formatDate(movie.release_date)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /movies/popular:
 *   get:
 *     summary: Популярные фильмы
 *     description: Получает список популярных фильмов с русскими названиями и описаниями
 *     tags: [movies]
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
 *         description: Список популярных фильмов
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
 *                     $ref: '#/components/schemas/Movie'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/popular', async (req, res) => {
    try {
        console.log('Popular movies request:', { query: req.query });
        const { page = 1 } = req.query;
        const movies = await req.tmdb.getPopularMovies(page);
        console.log('Popular movies response:', {
            page: movies.page,
            totalPages: movies.total_pages,
            resultsCount: movies.results.length
        });
        res.json(movies);
    } catch (error) {
        console.error('Popular movies error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /movies/top-rated:
 *   get:
 *     summary: Лучшие фильмы
 *     description: Получает список лучших фильмов с русскими названиями и описаниями
 *     tags: [movies]
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
 *         description: Список лучших фильмов
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
 *                     $ref: '#/components/schemas/Movie'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/top-rated', async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const movies = await req.tmdb.getTopRatedMovies(page);
        res.json(movies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /movies/upcoming:
 *   get:
 *     summary: Предстоящие фильмы
 *     description: Получает список предстоящих фильмов с русскими названиями и описаниями
 *     tags: [movies]
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
 *         description: Список предстоящих фильмов
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
 *                     $ref: '#/components/schemas/Movie'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/upcoming', async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const movies = await req.tmdb.getUpcomingMovies(page);
        res.json(movies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /movies/{id}/external-ids:
 *   get:
 *     summary: Внешние ID фильма
 *     description: Получает внешние идентификаторы фильма (IMDb и др.)
 *     tags: [movies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID фильма
 *         schema:
 *           type: integer
 *         example: 603
 *     responses:
 *       200:
 *         description: Внешние ID фильма
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imdb_id:
 *                   type: string
 *                   description: ID на IMDb
 *                 facebook_id:
 *                   type: string
 *                   description: ID на Facebook
 *                 instagram_id:
 *                   type: string
 *                   description: ID на Instagram
 *                 twitter_id:
 *                   type: string
 *                   description: ID на Twitter
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/external-ids', async (req, res) => {
    try {
        const externalIds = await req.tmdb.getMovieExternalIDs(req.params.id);
        res.json(externalIds);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
