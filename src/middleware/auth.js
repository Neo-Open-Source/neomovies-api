const jwt = require('jsonwebtoken');

/**
 * Express middleware to protect routes with JWT authentication.
 * Attaches the decoded token to req.user on success.
 */
function authRequired(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Invalid Authorization header format' });
    }

    const token = parts[1];
    const secret = process.env.JWT_SECRET || process.env.jwt_secret;
    if (!secret) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT auth error:', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authRequired;
