require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const TMDBClient = require('./config/tmdb');
const healthCheck = require('./utils/health');
const { formatDate } = require('./utils/date');

const app = express();

// Определяем базовый URL для документации
const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://neomovies-api.vercel.app'
  : 'http://localhost:3000';

// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Neo Movies API',
            version: '1.0.0',
            description: 'API для поиска и получения информации о фильмах с поддержкой русского языка',
            contact: {
                name: 'API Support',
                url: 'https://gitlab.com/foxixus/neomovies-api'
            }
        },
        servers: [
            {
                url: BASE_URL,
                description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            }
        ],
        tags: [
            {
                name: 'movies',
                description: 'Операции с фильмами'
            },
            {
                name: 'tv',
                description: 'Операции с сериалами'
            },
            {
                name: 'health',
                description: 'Проверка работоспособности API'
            }
        ],
        components: {
            schemas: {
                Movie: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'ID фильма'
                        },
                        title: {
                            type: 'string',
                            description: 'Название фильма'
                        }
                    }
                }
            }
        }
    },
    apis: [path.join(__dirname, 'routes', '*.js'), __filename]
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://neo-movies.vercel.app',
    /\.vercel\.app$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// TMDB client middleware
app.use((req, res, next) => {
    try {
        const token = process.env.TMDB_ACCESS_TOKEN;
        if (!token) {
            console.error('TMDB_ACCESS_TOKEN is not set');
            return res.status(500).json({ 
                error: 'Server configuration error',
                details: 'API token is not configured'
            });
        }

        console.log('Initializing TMDB client...');
        req.tmdb = new TMDBClient(token);
        next();
    } catch (error) {
        console.error('Failed to initialize TMDB client:', error);
        res.status(500).json({ 
            error: 'Server initialization error',
            details: error.message
        });
    }
});

// API Documentation routes
app.get('/api-docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'api-docs', 'index.html'));
});

app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocs);
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
app.get('/search/multi', async (req, res) => {
    try {
        const { query, page = 1 } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        console.log('Multi-search request:', { query, page });

        const response = await req.tmdb.makeRequest('get', '/search/multi', {
            query,
            page,
            include_adult: false,
            language: 'ru-RU'
        });

        if (!response.data || !response.data.results) {
            console.error('Invalid response from TMDB:', response);
            return res.status(500).json({ error: 'Invalid response from TMDB API' });
        }

        console.log('Multi-search response:', {
            page: response.data.page,
            total_results: response.data.total_results,
            total_pages: response.data.total_pages,
            results_count: response.data.results?.length
        });

        // Форматируем даты в результатах
        const formattedResults = response.data.results.map(item => ({
            ...item,
            release_date: item.release_date ? formatDate(item.release_date) : undefined,
            first_air_date: item.first_air_date ? formatDate(item.first_air_date) : undefined
        }));

        res.json({
            ...response.data,
            results: formattedResults
        });
    } catch (error) {
        console.error('Error in multi-search:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to search',
            details: error.response?.data?.status_message || error.message
        });
    }
});

// API routes
const moviesRouter = require('./routes/movies');
const tvRouter = require('./routes/tv');
const imagesRouter = require('./routes/images');
const categoriesRouter = require('./routes/categories');

app.use('/movies', moviesRouter);
app.use('/tv', tvRouter);
app.use('/images', imagesRouter);
app.use('/categories', categoriesRouter);

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [health]
 *     summary: Проверка работоспособности API
 *     description: Возвращает подробную информацию о состоянии API, включая статус TMDB, использование памяти и системную информацию
 *     responses:
 *       200:
 *         description: API работает нормально
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, error]
 *                 tmdb:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [ok, error]
 */
app.get('/health', async (req, res) => {
    try {
        const health = await healthCheck.getFullHealth(req.tmdb);
        res.json(health);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Export the Express API
module.exports = app;

// Start server only in development
if (process.env.NODE_ENV !== 'production') {
    // Проверяем аргументы командной строки
    const args = process.argv.slice(2);
    // Используем порт из аргументов командной строки, переменной окружения или по умолчанию 3000
    const port = args[0] || process.env.PORT || 3000;
    
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
        console.log(`Documentation available at http://localhost:${port}/api-docs`);
    });
}