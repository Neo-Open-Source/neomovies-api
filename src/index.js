require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const TMDBClient = require('./config/tmdb');
const healthCheck = require('./utils/health');

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
                        },
                        overview: {
                            type: 'string',
                            description: 'Описание фильма'
                        },
                        release_date: {
                            type: 'string',
                            format: 'date',
                            description: 'Дата выхода'
                        },
                        vote_average: {
                            type: 'number',
                            description: 'Средняя оценка'
                        },
                        poster_path: {
                            type: 'string',
                            description: 'URL постера'
                        },
                        backdrop_path: {
                            type: 'string',
                            description: 'URL фонового изображения'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Сообщение об ошибке'
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
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['X-Requested-With', 'Content-Type', 'Authorization', 'Accept']
}));

// Handle preflight requests
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// TMDB client middleware
app.use((req, res, next) => {
    const token = process.env.TMDB_ACCESS_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkOWRlZTY5ZjYzNzYzOGU2MjY5OGZhZGY0ZjhhYTNkYyIsInN1YiI6IjY1OTVkNmM5ODY5ZTc1NzJmOTY1MjZiZiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Wd_tBYGkAoGPVHq3A5DwV1iLs_eGvH3RRz86ghJTmU8';
    if (!token) {
        return res.status(500).json({ error: 'TMDB_ACCESS_TOKEN is not set' });
    }
    req.tmdb = new TMDBClient(token);
    next();
});

// API Documentation routes
app.get('/api-docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'api-docs', 'index.html'));
});

app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocs);
});

// API routes
app.use('/movies', require('./routes/movies'));

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
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
        console.log(`Documentation available at http://localhost:${port}/api-docs`);
    });
}
