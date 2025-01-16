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

        console.log('Search request:', { query, page });

        const data = await req.tmdb.searchMovies(query, page);

        console.log('Search response:', {
            page: data.page,
            total_results: data.total_results,
            total_pages: data.total_pages,
            results_count: data.results?.length
        });

        // Форматируем даты в результатах
        const formattedResults = data.results.map(movie => ({
            ...movie,
            release_date: formatDate(movie.release_date)
        }));

        res.json({
            ...data,
            results: formattedResults
        });
    } catch (error) {
        console.error('Error searching movies:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /search/multi:
 *   get:
 *     summary: Мультипоиск
 *     description: Поиск фильмов и сериалов по запросу
 *     tags: [search]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         description: Поисковый запрос
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         description: Номер страницы
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       name:
 *                         type: string
 *                       media_type:
 *                         type: string
 *                         enum: [movie, tv]
 */
router.get('/search/multi', async (req, res) => {
    try {
        const { query, page = 1 } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        console.log('Multi search request:', { query, page });

        // Параллельный поиск фильмов и сериалов
        const [moviesData, tvData] = await Promise.all([
            req.tmdb.searchMovies(query, page),
            req.tmdb.searchTVShows(query, page)
        ]);

        // Объединяем и сортируем результаты по популярности
        const combinedResults = [
            ...moviesData.results.map(movie => ({
                ...movie,
                media_type: 'movie',
                release_date: formatDate(movie.release_date)
            })),
            ...tvData.results.map(show => ({
                ...show,
                media_type: 'tv',
                first_air_date: formatDate(show.first_air_date)
            }))
        ].sort((a, b) => b.popularity - a.popularity);

        // Пагинация результатов
        const itemsPerPage = 20;
        const startIndex = (parseInt(page) - 1) * itemsPerPage;
        const paginatedResults = combinedResults.slice(startIndex, startIndex + itemsPerPage);

        res.json({
            page: parseInt(page),
            results: paginatedResults,
            total_pages: Math.ceil(combinedResults.length / itemsPerPage),
            total_results: combinedResults.length
        });
    } catch (error) {
        console.error('Error in multi search:', error);
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

/**
 * @swagger
 * /movies/{id}/videos:
 *   get:
 *     summary: Видео фильма
 *     description: Получает список видео для фильма (трейлеры, тизеры и т.д.)
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
 *         description: Список видео
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       key:
 *                         type: string
 *                       name:
 *                         type: string
 *                       site:
 *                         type: string
 *                       type:
 *                         type: string
 *       404:
 *         description: Видео не найдены
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
router.get('/:id/videos', async (req, res) => {
    try {
        const { id } = req.params;
        const videos = await req.tmdb.getMovieVideos(id);
        
        if (!videos || !videos.results) {
            return res.status(404).json({ error: 'Videos not found' });
        }

        res.json(videos);
    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch videos',
            details: error.message
        });
    }
});

/**
 * @swagger
 * /movies/genre/{id}:
 *   get:
 *     summary: Фильмы по жанру
 *     description: Получает список фильмов определенного жанра
 *     tags: [movies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID жанра
 *         schema:
 *           type: integer
 *         example: 28
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
 *         description: Список фильмов
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
 *       404:
 *         description: Жанр не найден
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
router.get('/genre/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { page } = req.query;
        const pageNum = parseInt(page, 10) || 1;

        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be greater than 0' });
        }

        const movies = await req.tmdb.getMoviesByGenre(id, pageNum);
        
        if (!movies || !movies.results) {
            return res.status(404).json({ error: 'Movies not found for this genre' });
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
        console.error('Get movies by genre error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch movies by genre',
            details: error.message
        });
    }
});

module.exports = router;