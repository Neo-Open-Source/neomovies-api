const { Router } = require('express');
const { getDb } = require('../db');
const authRequired = require('../middleware/auth');
console.log('typeof authRequired:', typeof authRequired, authRequired);
const fetch = global.fetch || require('node-fetch');

const router = Router();

const CUB_API_URL = 'https://cub.rip/api';
const VALID_REACTIONS = ['fire', 'nice', 'think', 'bore', 'shit'];

// [PUBLIC] Получить все счетчики реакций для медиа
router.get('/:mediaType/:mediaId/counts', async (req, res) => {
    try {
        const { mediaType, mediaId } = req.params;
        const cubId = `${mediaType}_${mediaId}`;
        const response = await fetch(`${CUB_API_URL}/reactions/get/${cubId}`);
        if (!response.ok) {
            // Возвращаем пустой объект, если на CUB.RIP еще нет реакций
            return res.json({});
        }
        const data = await response.json();

        const counts = (data.result || []).reduce((acc, reaction) => {
            acc[reaction.type] = reaction.counter;
            return acc;
        }, {});

        res.json(counts);
    } catch (err) {
        console.error('Get reaction counts error:', err);
        res.status(500).json({ error: 'Failed to get reaction counts' });
    }
});

// [AUTH] Получить реакцию текущего пользователя для медиа
router.get('/:mediaType/:mediaId/my-reaction', authRequired, async (req, res) => {
    try {
        const db = await getDb();
        const { mediaType, mediaId } = req.params;
        const userId = req.user.id;
        const fullMediaId = `${mediaType}_${mediaId}`;

        const reaction = await db.collection('reactions').findOne({ userId, mediaId: fullMediaId });
        res.json(reaction);
    } catch (err) {
        console.error('Get user reaction error:', err);
        res.status(500).json({ error: 'Failed to get user reaction' });
    }
});

// [AUTH] Добавить, обновить или удалить реакцию
router.post('/', authRequired, async (req, res) => {
    try {
        const db = await getDb();
        const { mediaId, type } = req.body; // mediaId здесь это fullMediaId, например "movie_12345"
        const userId = req.user.id;

        if (!mediaId || !type) {
            return res.status(400).json({ error: 'mediaId and type are required' });
        }

        if (!VALID_REACTIONS.includes(type)) {
            return res.status(400).json({ error: 'Invalid reaction type' });
        }
        
        const existingReaction = await db.collection('reactions').findOne({ userId, mediaId });

        if (existingReaction) {
            // Если тип реакции тот же, удаляем ее (отмена реакции)
            if (existingReaction.type === type) {
                // Отправляем запрос на удаление в CUB API
                await fetch(`${CUB_API_URL}/reactions/remove/${mediaId}/${type}`);
                await db.collection('reactions').deleteOne({ _id: existingReaction._id });
                return res.status(204).send();
            } else {
                // Если тип другой, обновляем его
                // Атомарно выполняем операции с CUB API и базой данных
                await Promise.all([
                    // 1. Удаляем старую реакцию из CUB API
                    fetch(`${CUB_API_URL}/reactions/remove/${mediaId}/${existingReaction.type}`),
                    // 2. Добавляем новую реакцию в CUB API
                    fetch(`${CUB_API_URL}/reactions/add/${mediaId}/${type}`),
                    // 3. Обновляем реакцию в нашей базе данных
                    db.collection('reactions').updateOne(
                        { _id: existingReaction._id },
                        { $set: { type, createdAt: new Date() } }
                    )
                ]);

                const updatedReaction = await db.collection('reactions').findOne({ _id: existingReaction._id });
                return res.json(updatedReaction);
            }
        } else {
            // Если реакции не было, создаем новую
            const mediaType = mediaId.split('_')[0]; // Извлекаем 'movie' или 'tv'
            const newReaction = {
                userId,
                mediaId, // full mediaId, e.g., 'movie_12345'
                mediaType,
                type,
                createdAt: new Date()
            };
            const result = await db.collection('reactions').insertOne(newReaction);
            // Отправляем запрос в CUB API
            await fetch(`${CUB_API_URL}/reactions/add/${mediaId}/${type}`);
            const insertedDoc = await db.collection('reactions').findOne({ _id: result.insertedId });
            return res.status(201).json(insertedDoc);
        }
    } catch (err) {
        console.error('Set reaction error:', err);
        res.status(500).json({ error: 'Failed to set reaction' });
    }
});

module.exports = router; 