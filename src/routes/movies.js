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
        const { query, page } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be greater than 0' });
        }

        const response = await req.tmdb.searchMovies(query, pageNum);
        
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
            details: error.message
        });
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
        const { page } = req.query;
        const pageNum = parseInt(page, 10) || 1;

        console.log('Popular movies request:', { 
            requestedPage: page,
            parsedPage: pageNum,
            rawQuery: req.query 
        });

        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be greater than 0' });
        }

        const movies = await req.tmdb.getPopularMovies(pageNum);
        
        console.log('Popular movies response:', {
            requestedPage: pageNum,
            returnedPage: movies.page,
            totalPages: movies.total_pages,
            resultsCount: movies.results?.length
        });

        if (!movies || !movies.results) {
            throw new Error('Invalid response from TMDB');
        }

        const formattedResults = movies.results.map(movie => ({
            ...movie,
            release_date: formatDate(movie.release_date)
        }));

        res.json({
            ...movies,
            results: formattedResults
        });
    } catch (error) {
        console.error('Popular movies error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch popular movies',
            details: error.message
        });
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
        const { page } = req.query;
        const pageNum = parseInt(page, 10) || 1;

        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be greater than 0' });
        }

        const movies = await req.tmdb.getTopRatedMovies(pageNum);
        
        if (!movies || !movies.results) {
            throw new Error('Invalid response from TMDB');
        }

        const formattedResults = movies.results.map(movie => ({
            ...movie,
            release_date: formatDate(movie.release_date)
        }));

        res.json({
            ...movies,
            results: formattedResults
        });
    } catch (error) {
        console.error('Top rated movies error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch top rated movies',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /movies/{id}:
 *   get:
 *     summary: Детали фильма
 *     description: Получает подробную информацию о фильме по его ID
 *     tags: [movies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID фильма
 *         schema:
 *           type: integer
 *         example: 550
 *     responses:
 *       200:
 *         description: Детали фильма
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Movie'
 *       404:
 *         description: Фильм не найден
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
        const movie = await req.tmdb.getMovie(id);
        
        if (!movie) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        res.json({
            ...movie,
            release_date: formatDate(movie.release_date)
        });
    } catch (error) {
        console.error('Get movie error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch movie details',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /movies/{id}/external-ids:
 *   get:
 *     summary: Внешние ID фильма
 *     description: Получает внешние идентификаторы фильма (IMDb, и т.д.)
 *     tags: [movies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID фильма
 *         schema:
 *           type: integer
 *         example: 550
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
 *                 facebook_id:
 *                   type: string
 *                 instagram_id:
 *                   type: string
 *                 twitter_id:
 *                   type: string
 *       404:
 *         description: Фильм не найден
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
        const externalIds = await req.tmdb.getMovieExternalIDs(id);
        
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
        const { page } = req.query;
        const pageNum = parseInt(page, 10) || 1;

        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be greater than 0' });
        }

        const movies = await req.tmdb.getUpcomingMovies(pageNum);
        
        if (!movies || !movies.results) {
            throw new Error('Invalid response from TMDB');
        }

        const formattedResults = movies.results.map(movie => ({
            ...movie,
            release_date: formatDate(movie.release_date)
        }));

        res.json({
            ...movies,
            results: formattedResults
        });
    } catch (error) {
        console.error('Upcoming movies error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch upcoming movies',
            details: error.message
        });
    }
});

// TV Shows Routes
router.get('/tv/search', async (req, res) => {
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
        
        if (!response || !response.data) {
            throw new Error('Failed to fetch data from TMDB');
        }

        const { results, ...rest } = response.data;
        
        const formattedResults = results.map(show => ({
            ...show,
            first_air_date: formatDate(show.first_air_date)
        }));

        res.json({
            ...rest,
            results: formattedResults
        });
    } catch (error) {
        console.error('Error searching TV shows:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/tv/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const show = await req.tmdb.getTVShow(id);
        show.first_air_date = formatDate(show.first_air_date);
        res.json(show);
    } catch (error) {
        console.error('Error fetching TV show:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/tv/popular', async (req, res) => {
    try {
        const { page } = req.query;
        const pageNum = parseInt(page, 10) || 1;

        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be greater than 0' });
        }

        const response = await req.tmdb.getPopularTVShows(pageNum);
        
        if (!response || !response.data) {
            throw new Error('Failed to fetch data from TMDB');
        }

        const { results, ...rest } = response.data;
        
        const formattedResults = results.map(show => ({
            ...show,
            first_air_date: formatDate(show.first_air_date)
        }));

        res.json({
            ...rest,
            results: formattedResults
        });
    } catch (error) {
        console.error('Error fetching popular TV shows:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/tv/top-rated', async (req, res) => {
    try {
        const { page } = req.query;
        const pageNum = parseInt(page, 10) || 1;

        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be greater than 0' });
        }

        const response = await req.tmdb.getTopRatedTVShows(pageNum);
        
        if (!response || !response.data) {
            throw new Error('Failed to fetch data from TMDB');
        }

        const { results, ...rest } = response.data;
        
        const formattedResults = results.map(show => ({
            ...show,
            first_air_date: formatDate(show.first_air_date)
        }));

        res.json({
            ...rest,
            results: formattedResults
        });
    } catch (error) {
        console.error('Error fetching top rated TV shows:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
