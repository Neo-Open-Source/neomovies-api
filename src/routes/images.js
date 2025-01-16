const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');

// Базовый URL для изображений TMDB
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// Путь к placeholder изображению
const PLACEHOLDER_PATH = path.join(__dirname, '..', 'public', 'images', 'placeholder.jpg');

/**
 * @swagger
 * /images/{size}/{path}:
 *   get:
 *     summary: Прокси для изображений TMDB
 *     description: Получает изображения с TMDB и отдает их клиенту
 *     tags: [images]
 *     parameters:
 *       - in: path
 *         name: size
 *         required: true
 *         description: Размер изображения (w500, original и т.д.)
 *         schema:
 *           type: string
 *       - in: path
 *         name: path
 *         required: true
 *         description: Путь к изображению
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Изображение
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:size/:path(*)', async (req, res) => {
    try {
        const { size, path: imagePath } = req.params;
        
        // Если запрашивается placeholder, возвращаем локальный файл
        if (imagePath === 'placeholder.jpg') {
            return res.sendFile(PLACEHOLDER_PATH);
        }

        // Проверяем размер изображения
        const validSizes = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];
        const imageSize = validSizes.includes(size) ? size : 'original';

        // Формируем URL изображения
        const imageUrl = `${TMDB_IMAGE_BASE_URL}/${imageSize}/${imagePath}`;

        // Получаем изображение
        const response = await axios.get(imageUrl, {
            responseType: 'stream',
            validateStatus: status => status === 200
        });

        // Устанавливаем заголовки
        res.set('Content-Type', response.headers['content-type']);
        res.set('Cache-Control', 'public, max-age=31536000'); // кэшируем на 1 год

        // Передаем изображение клиенту
        response.data.pipe(res);
    } catch (error) {
        console.error('Image proxy error:', error.message);
        res.sendFile(PLACEHOLDER_PATH);
    }
});

module.exports = router;