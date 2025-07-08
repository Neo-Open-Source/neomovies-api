const { Router } = require('express');
const { getDb } = require('../db');
const authRequired = require('../middleware/auth');
console.log('typeof authRequired:', typeof authRequired, authRequired);
const fetch = global.fetch || require('node-fetch');

const router = Router();

const CUB_API_URL = 'https://cub.rip/api';
const VALID_REACTIONS = ['fire', 'nice', 'think', 'bore', 'shit'];

// --- PUBLIC ROUTE ---
// Получить общее количество реакций для медиа
router.get('/counts/:mediaType/:mediaId', async (req, res) => {
    try {
        const { mediaType, mediaId } = req.params;
        const cubId = `${mediaType}_${mediaId}`;

        const response = await fetch(`${CUB_API_URL}/reactions/get/${cubId}`);
        if (!response.ok) {
            // Если CUB API возвращает ошибку, считаем, что реакций нет
            console.error(`CUB API error for ${cubId}:`, response.statusText);
            return res.json({ total: 0 });
        }

        const data = await response.json();
        if (!data.secuses || !Array.isArray(data.result)) {
            return res.json({ total: 0 });
        }
        
        const total = data.result.reduce((sum, reaction) => sum + (reaction.counter || 0), 0);
        res.json({ total });

    } catch (err) {
        console.error('Get total reactions error:', err);
        res.status(500).json({ error: 'Failed to get total reactions' });
    }
});


// --- AUTH REQUIRED ROUTES ---
router.use(authRequired);

// Получить реакцию текущего пользователя для медиа
router.get('/:mediaType/:mediaId', async (req, res) => {
    try {
        const db = await getDb();
        const { mediaType, mediaId } = req.params;
        const userId = req.user.id;

        const reaction = await db.collection('reactions').findOne({ userId, mediaId, mediaType });
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
        const { mediaId, mediaType, type } = req.body;
        const userId = req.user.id;

        if (!mediaId || !mediaType || !type) {
            return res.status(400).json({ error: 'mediaId, mediaType, and type are required' });
        }

        if (!VALID_REACTIONS.includes(type)) {
            return res.status(400).json({ error: 'Invalid reaction type' });
        }
        
        const cubId = `${mediaType}_${mediaId}`;
        const existingReaction = await db.collection('reactions').findOne({ userId, mediaId, mediaType });

        if (existingReaction) {
            if (existingReaction.type === type) {
                await db.collection('reactions').deleteOne({ _id: existingReaction._id });
                return res.status(204).send();
            } else {
                await db.collection('reactions').updateOne(
                    { _id: existingReaction._id },
                    { $set: { type, createdAt: new Date() } }
                );
                await fetch(`${CUB_API_URL}/reactions/add/${cubId}/${type}`);
                const updatedReaction = await db.collection('reactions').findOne({ _id: existingReaction._id });
                return res.json(updatedReaction);
            }
        } else {
            const newReaction = {
                userId,
                mediaId,
                mediaType,
                type,
                createdAt: new Date()
            };
            const result = await db.collection('reactions').insertOne(newReaction);
            await fetch(`${CUB_API_URL}/reactions/add/${cubId}/${type}`);
            
            const insertedDoc = await db.collection('reactions').findOne({ _id: result.insertedId });
            return res.status(201).json(insertedDoc);
        }
    } catch (err) {
        console.error('Set reaction error:', err);
        res.status(500).json({ error: 'Failed to set reaction' });
    }
});

module.exports = router; 