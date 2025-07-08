const { Router } = require('express');
const { getDb } = require('../db');
const authRequired = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: favorites
 *   description: Операции с избранным
 */
const router = Router();

// Apply auth middleware to all favorites routes
router.use(authRequired);

/**
 * @swagger
 * /favorites:
 *   get:
 *     tags: [favorites]
 *     summary: Получить список избранного пользователя
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.user.email || req.user.id;
    const items = await db
      .collection('favorites')
      .find({ userId })
      .toArray();
    res.json(items);
  } catch (err) {
    console.error('Get favorites error:', err);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

/**
 * @swagger
 * /favorites/check/{mediaId}:
 *   get:
 *     tags: [favorites]
 *     summary: Проверить, находится ли элемент в избранном
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/check/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const db = await getDb();
    const exists = await db
      .collection('favorites')
      .findOne({ userId: req.user.email || req.user.id, mediaId });
    res.json({ exists: !!exists });
  } catch (err) {
    console.error('Check favorite error:', err);
    res.status(500).json({ error: 'Failed to check favorite' });
  }
});

/**
 * @swagger
 * /favorites/{mediaId}:
 *   post:
 *     tags: [favorites]
 *     summary: Добавить элемент в избранное
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: mediaType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [movie, tv]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               posterPath:
 *                 type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { mediaType } = req.query;
    const { title, posterPath } = req.body;
    if (!mediaType) return res.status(400).json({ error: 'mediaType required' });

    const db = await getDb();
    await db.collection('favorites').insertOne({
      userId: req.user.email || req.user.id,
      mediaId,
      mediaType,
      title: title || '',
      posterPath: posterPath || '',
      createdAt: new Date()
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Already in favorites' });
    }
    console.error('Add favorite error:', err);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

/**
 * @swagger
 * /favorites/{mediaId}:
 *   delete:
 *     tags: [favorites]
 *     summary: Удалить элемент из избранного
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.delete('/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const db = await getDb();
    await db.collection('favorites').deleteOne({ userId: req.user.email || req.user.id, mediaId });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete favorite error:', err);
    res.status(500).json({ error: 'Failed to delete favorite' });
  }
});

module.exports = router;
