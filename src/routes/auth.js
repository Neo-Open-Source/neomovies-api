const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const { sendVerificationEmail } = require('../utils/mailer');
const authRequired = require('../middleware/auth');
const fetch = require('node-fetch');

/**
 * @swagger
 * tags:
 *   name: auth
 *   description: Операции авторизации
 */
const router = Router();

// Helper to generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register
/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [auth]
 *     summary: Регистрация пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = await getDb();
    const existing = await db.collection('users').findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const code = generateCode();
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000);

    await db.collection('users').insertOne({
      email,
      password: hashed,
      name: name || email,
      verified: false,
      verificationCode: code,
      verificationExpires: codeExpires,
      isAdmin: false,
      adminVerified: false,
      createdAt: new Date()
    });

    await sendVerificationEmail(email, code);
    res.json({ success: true, message: 'Registered. Check email for code.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify email
/**
 * @swagger
 * /auth/verify:
 *   post:
 *     tags: [auth]
 *     summary: Подтверждение email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });
    if (user.verified) return res.json({ success: true, message: 'Already verified' });
    if (user.verificationCode !== code || user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    await db.collection('users').updateOne({ email }, { $set: { verified: true }, $unset: { verificationCode: '', verificationExpires: '' } });
    res.json({ success: true });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend code
/**
 * @swagger
 * /auth/resend-code:
 *   post:
 *     tags: [auth]
 *     summary: Повторная отправка кода подтверждения
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });
    const code = generateCode();
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000);
    await db.collection('users').updateOne({ email }, { $set: { verificationCode: code, verificationExpires: codeExpires } });
    await sendVerificationEmail(email, code);
    res.json({ success: true });
  } catch (err) {
    console.error('Resend code error:', err);
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

// Login
/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [auth]
 *     summary: Логин пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *
 *     responses:
 *       200:
 *         description: JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });
    if (!user.verified) {
      return res.status(403).json({ error: 'Account not activated. Please verify your email.' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });
    const payload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name || '',
      verified: user.verified,
      isAdmin: user.isAdmin,
      adminVerified: user.adminVerified
    };
    const secret = process.env.JWT_SECRET || process.env.jwt_secret;
    const token = jwt.sign(payload, secret, { expiresIn: '7d', jwtid: uuidv4() });

    res.json({ token, user: { name: user.name || '', email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Delete account
/**
 * @swagger
 * /auth/profile:
 *   delete:
 *     tags: [auth]
 *     summary: Удаление аккаунта пользователя
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Аккаунт успешно удален
 *       500:
 *         description: Ошибка сервера
 */
router.delete('/profile', authRequired, async (req, res) => {
    try {
        const db = await getDb();
        const userId = req.user.id;

        // 1. Найти все реакции пользователя, чтобы уменьшить счетчики в cub.rip
        const userReactions = await db.collection('reactions').find({ userId }).toArray();
        if (userReactions.length > 0) {
            const CUB_API_URL = process.env.CUB_API_URL || 'https://cub.rip/api';
            const removalPromises = userReactions.map(reaction => 
                fetch(`${CUB_API_URL}/reactions/remove/${reaction.mediaId}/${reaction.type}`, {
                    method: 'POST' // или 'DELETE', в зависимости от API
                })
            );
            await Promise.all(removalPromises);
        }

        // 2. Удалить все данные пользователя
        await db.collection('users').deleteOne({ _id: new ObjectId(userId) });
        await db.collection('favorites').deleteMany({ userId });
        await db.collection('reactions').deleteMany({ userId });

        res.status(200).json({ success: true, message: 'Account deleted successfully.' });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Failed to delete account.' });
    }
});

module.exports = router;
