const { Router } = require('express');
const { getDb } = require('../db');
const authRequired = require('../middleware/auth');

const router = Router();
router.use(authRequired);

const CUB_API_URL = 'https://cub.rip/api';
const VALID_REACTIONS = ['fire', 'nice', 'think', 'bore', 'shit'];

// Получить реакцию текущего пользователя для медиа
router.get('/:mediaId', async (req, res) => {
    try {
        const db = await getDb();
        const { mediaId } = req.params;
        const userId = req.user.id;

        const reaction = await db.collection('reactions').findOne({ userId, mediaId });
        res.json(reaction);
    } catch (err) {
        console.error('Get user reaction error:', err);
        res.status(500).json({ error: 'Failed to get user reaction' });
    }
});

// Добавить, обновить или удалить реакцию
router.post('/', async (req, res) => {
    try {
        const db = await getDb();
        const { mediaId, type } = req.body;
        const userId = req.user.id;

        if (!mediaId || !type) {
            return res.status(400).json({ error: 'mediaId and type are required' });
        }

        if (!VALID_REACTIONS.includes(type)) {
            return res.status(400).json({ error: 'Invalid reaction type' });
        }

        const existingReaction = await db.collection('reactions').findOne({ userId, mediaId });

        if (existingReaction) {
            // Если реакция та же - удаляем (пользователь "отжал" кнопку)
            if (existingReaction.type === type) {
                await db.collection('reactions').deleteOne({ _id: existingReaction._id });
                // Не вызываем CUB API, так как у него нет эндпоинта для удаления
                return res.status(204).send();
            } else {
                // Если реакция другая - обновляем
                await db.collection('reactions').updateOne(
                    { _id: existingReaction._id },
                    { $set: { type, createdAt: new Date() } }
                );
                // Вызываем CUB API для новой реакции
                await fetch(`${CUB_API_URL}/reactions/add/${mediaId}/${type}`);
                const updatedReaction = await db.collection('reactions').findOne({ _id: existingReaction._id });
                return res.json(updatedReaction);
            }
        } else {
            // Если реакции нет - создаем новую
            const newReaction = {
                userId,
                mediaId,
                type,
                createdAt: new Date()
            };
            const result = await db.collection('reactions').insertOne(newReaction);
            // Вызываем CUB API
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