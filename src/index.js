require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const TMDBClient = require('./config/tmdb');
const healthCheck = require('./utils/health');

const app = express();
const port = process.env.PORT || 3000;

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
                url: 'https://github.com/yourusername/neomovies-api'
            }
        },
        servers: [
            {
                url: `http://localhost:${port}`,
                description: 'Development server',
            },
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
                },
                Health: {
                    type: 'object',
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['healthy', 'unhealthy'],
                            description: 'Общий статус API'
                        },
                        version: {
                            type: 'string',
                            description: 'Версия API'
                        },
                        uptime: {
                            type: 'object',
                            properties: {
                                seconds: {
                                    type: 'integer',
                                    description: 'Время работы в секундах'
                                },
                                formatted: {
                                    type: 'string',
                                    description: 'Отформатированное время работы'
                                }
                            }
                        },
                        tmdb: {
                            type: 'object',
                            properties: {
                                status: {
                                    type: 'string',
                                    enum: ['ok', 'error'],
                                    description: 'Статус подключения к TMDB'
                                },
                                responseTime: {
                                    type: 'integer',
                                    description: 'Время ответа TMDB в мс'
                                },
                                error: {
                                    type: 'string',
                                    description: 'Сообщение об ошибке, если есть'
                                }
                            }
                        },
                        memory: {
                            type: 'object',
                            properties: {
                                heapTotal: {
                                    type: 'integer',
                                    description: 'Общий размер кучи (MB)'
                                },
                                heapUsed: {
                                    type: 'integer',
                                    description: 'Использованный размер кучи (MB)'
                                },
                                rss: {
                                    type: 'integer',
                                    description: 'Resident Set Size (MB)'
                                },
                                memoryUsage: {
                                    type: 'integer',
                                    description: 'Процент использования памяти'
                                },
                                system: {
                                    type: 'object',
                                    properties: {
                                        total: {
                                            type: 'integer',
                                            description: 'Общая память системы (MB)'
                                        },
                                        free: {
                                            type: 'integer',
                                            description: 'Свободная память системы (MB)'
                                        },
                                        usage: {
                                            type: 'integer',
                                            description: 'Процент использования системной памяти'
                                        }
                                    }
                                }
                            }
                        },
                        system: {
                            type: 'object',
                            properties: {
                                platform: {
                                    type: 'string',
                                    description: 'Операционная система'
                                },
                                arch: {
                                    type: 'string',
                                    description: 'Архитектура процессора'
                                },
                                nodeVersion: {
                                    type: 'string',
                                    description: 'Версия Node.js'
                                },
                                cpuUsage: {
                                    type: 'number',
                                    description: 'Загрузка CPU'
                                }
                            }
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Время проверки'
                        }
                    }
                }
            }
        }
    },
    apis: ['./src/routes/*.js', './src/index.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Custom CSS для Swagger UI
const swaggerCustomOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Neo Movies API Documentation",
    customfavIcon: "https://www.themoviedb.org/favicon.ico"
};

// Middleware
app.use(cors());
app.use(express.json());

// TMDB client middleware
app.use((req, res, next) => {
    if (!process.env.TMDB_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'TMDB_ACCESS_TOKEN is not set' });
    }
    req.tmdb = new TMDBClient(process.env.TMDB_ACCESS_TOKEN);
    next();
});

// Routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, swaggerCustomOptions));
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
 *               $ref: '#/components/schemas/Health'
 */
app.get('/health', async (req, res) => {
    const health = await healthCheck.getFullHealth(req.tmdb);
    res.json(health);
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Documentation available at http://localhost:${port}/api-docs`);
});
