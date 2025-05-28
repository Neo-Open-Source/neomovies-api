const express = require('express');
const router = express.Router();
const { formatDate } = require('../utils/date');

// Middleware для логирования запросов
router.use((req, res, next) => {
  console.log('Categories API Request:', {
    method: req.method,
    path: req.path,
    query: req.query,
    params: req.params
  });
  next();
});

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Получение списка категорий
 *     description: Возвращает список всех доступных категорий фильмов (жанров)
 *     tags: [categories]
 *     responses:
 *       200:
 *         description: Список категорий
 *       500:
 *         description: Ошибка сервера
 */
router.get('/', async (req, res) => {
  try {
    console.log('Fetching categories (genres)...');
    
    // Получаем данные о всех жанрах из TMDB (фильмы и сериалы)
    const genresData = await req.tmdb.getAllGenres();
    
    if (!genresData?.genres || !Array.isArray(genresData.genres)) {
      console.error('Invalid genres response:', genresData);
      return res.status(500).json({ 
        error: 'Invalid response from TMDB',
        details: 'Genres data is missing or invalid'
      });
    }
    
    // Преобразуем жанры в категории
    const categories = genresData.genres.map(genre => ({
      id: genre.id,
      name: genre.name,
      slug: genre.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    }));
    
    // Сортируем категории по алфавиту
    categories.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    
    console.log('Categories response:', {
      count: categories.length,
      categories: categories.slice(0, 3) // логируем только первые 3 для краткости
    });
    
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch categories',
      details: error.response?.data?.status_message || error.message
    });
  }
});

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Получение категории по ID
 *     description: Возвращает информацию о категории по ее ID
 *     tags: [categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID категории (жанра)
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Категория найдена
 *       404:
 *         description: Категория не найдена
 *       500:
 *         description: Ошибка сервера
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching category (genre) with ID: ${id}`);
    
    // Получаем данные о всех жанрах (фильмы и сериалы)
    const genresData = await req.tmdb.getAllGenres();
    
    if (!genresData?.genres || !Array.isArray(genresData.genres)) {
      console.error('Invalid genres response:', genresData);
      return res.status(500).json({ 
        error: 'Invalid response from TMDB',
        details: 'Genres data is missing or invalid'
      });
    }
    
    // Находим жанр по ID
    const genre = genresData.genres.find(g => g.id === parseInt(id));
    
    if (!genre) {
      return res.status(404).json({ 
        error: 'Category not found',
        details: `No category with ID ${id}`
      });
    }
    
    // Преобразуем жанр в категорию
    const category = {
      id: genre.id,
      name: genre.name,
      slug: genre.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      moviesCount: null // Можно будет дополнительно получить количество фильмов по жанру
    };
    
    res.json(category);
  } catch (error) {
    console.error('Error fetching category by ID:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category',
      details: error.response?.data?.status_message || error.message
    });
  }
});

/**
 * @swagger
 * /categories/{id}/movies:
 *   get:
 *     summary: Получение фильмов по категории
 *     description: Возвращает список фильмов, принадлежащих указанной категории (жанру)
 *     tags: [categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID категории (жанра)
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         description: Номер страницы
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *     responses:
 *       200:
 *         description: Список фильмов по категории
 *       404:
 *         description: Категория не найдена
 *       500:
 *         description: Ошибка сервера
 */
router.get('/:id/movies', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1 } = req.query;
    
    console.log(`Fetching movies for category (genre) ID: ${id}, page: ${page}`);
    
    // Проверяем существование жанра в списке всех жанров
    const genresData = await req.tmdb.getAllGenres();
    const genreExists = genresData?.genres?.some(g => g.id === parseInt(id));
    
    if (!genreExists) {
      return res.status(404).json({ 
        error: 'Category not found',
        details: `No category with ID ${id}`
      });
    }
    
    // Получаем фильмы по жанру напрямую из TMDB
    console.log(`Making TMDB request for movies with genre ID: ${id}, page: ${page}`);
    
    // В URL параметрах напрямую указываем жанр, чтобы быть уверенными
    const endpoint = `/discover/movie?with_genres=${id}`;
    
    const requestParams = {
      page,
      language: 'ru-RU',
      include_adult: false,
      sort_by: 'popularity.desc'
    };
    
    // Дополнительно добавляем вариации для разных жанров
    if (parseInt(id) % 2 === 0) {
      requestParams['vote_count.gte'] = 50;
    } else {
      requestParams['vote_average.gte'] = 5;
    }
    
    console.log('Request params:', requestParams);
    console.log('Endpoint with genre:', endpoint);
    
    const response = await req.tmdb.makeRequest('get', endpoint, {
      params: requestParams
    });
    
    console.log(`TMDB response received, status: ${response.status}, has results: ${!!response?.data?.results}`);
    
    if (response?.data?.results?.length > 0) {
      console.log(`First few movie IDs: ${response.data.results.slice(0, 5).map(m => m.id).join(', ')}`);
    }
    
    if (!response?.data?.results) {
      console.error('Invalid movie response:', response);
      return res.status(500).json({ 
        error: 'Invalid response from TMDB',
        details: 'Movie data is missing'
      });
    }
    
    console.log('Movies by category response:', {
      page: response.data.page,
      total_results: response.data.total_results,
      results_count: response.data.results?.length
    });
    
    // Форматируем даты в результатах
    const formattedResults = response.data.results.map(movie => ({
      ...movie,
      release_date: movie.release_date ? formatDate(movie.release_date) : undefined,
      poster_path: req.tmdb.getImageURL(movie.poster_path, 'w500'),
      backdrop_path: req.tmdb.getImageURL(movie.backdrop_path, 'original')
    }));
    
    res.json({
      ...response.data,
      results: formattedResults
    });
  } catch (error) {
    console.error('Error fetching movies by category:', {
      message: error.message,
      response: error.response?.data
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch movies by category',
      details: error.response?.data?.status_message || error.message
    });
  }
});

/**
 * @swagger
 * /categories/{id}/tv:
 *   get:
 *     summary: Получение сериалов по категории
 *     description: Возвращает список сериалов, принадлежащих указанной категории (жанру)
 *     tags: [categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID категории (жанра)
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         description: Номер страницы
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *     responses:
 *       200:
 *         description: Список сериалов по категории
 *       404:
 *         description: Категория не найдена
 *       500:
 *         description: Ошибка сервера
 */
router.get('/:id/tv', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1 } = req.query;
    
    console.log(`Fetching TV shows for category (genre) ID: ${id}, page: ${page}`);
    
    // Проверяем существование жанра в списке всех жанров
    const genresData = await req.tmdb.getAllGenres();
    const genreExists = genresData?.genres?.some(g => g.id === parseInt(id));
    
    if (!genreExists) {
      return res.status(404).json({ 
        error: 'Category not found',
        details: `No category with ID ${id}`
      });
    }
    
    // Получаем сериалы по жанру напрямую из TMDB
    console.log(`Making TMDB request for TV shows with genre ID: ${id}, page: ${page}`);
    
    // В URL параметрах напрямую указываем жанр, чтобы быть уверенными
    const endpoint = `/discover/tv?with_genres=${id}`;
    
    const requestParams = {
      page,
      language: 'ru-RU',
      include_adult: false,
      include_null_first_air_dates: false,
      sort_by: 'popularity.desc'
    };
    
    // Дополнительно добавляем вариации для разных жанров
    if (parseInt(id) % 2 === 0) {
      requestParams['vote_count.gte'] = 20;
    } else {
      requestParams['first_air_date.gte'] = '2010-01-01';
    }
    
    console.log('TV Request params:', requestParams);
    console.log('TV Endpoint with genre:', endpoint);
    
    const response = await req.tmdb.makeRequest('get', endpoint, {
      params: requestParams
    });
    
    console.log(`TMDB response for TV genre ${id} received, status: ${response.status}, has results: ${!!response?.data?.results}`);
    if (response?.data?.results?.length > 0) {
      console.log(`First few TV show IDs: ${response.data.results.slice(0, 5).map(show => show.id).join(', ')}`);
    }
    
    if (!response?.data?.results) {
      console.error('Invalid TV shows response:', response);
      return res.status(500).json({ 
        error: 'Invalid response from TMDB',
        details: 'TV shows data is missing'
      });
    }
    
    console.log('TV shows by category response:', {
      page: response.data.page,
      total_results: response.data.total_results,
      results_count: response.data.results?.length
    });
    
    // Форматируем даты в результатах
    const formattedResults = response.data.results.map(tvShow => ({
      ...tvShow,
      first_air_date: tvShow.first_air_date ? formatDate(tvShow.first_air_date) : undefined,
      poster_path: req.tmdb.getImageURL(tvShow.poster_path, 'w500'),
      backdrop_path: req.tmdb.getImageURL(tvShow.backdrop_path, 'original')
    }));
    
    res.json({
      ...response.data,
      results: formattedResults
    });
  } catch (error) {
    console.error('Error fetching TV shows by category:', {
      message: error.message,
      response: error.response?.data
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch TV shows by category',
      details: error.response?.data?.status_message || error.message
    });
  }
});

module.exports = router;
