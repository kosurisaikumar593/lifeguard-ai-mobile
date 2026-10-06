const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'lifeguard_ai_secure_jwt_token_secret_2026_xyz';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authorization token provided.'
    });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, mobile, name }
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired authorization token.'
    });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, mobile: user.mobile, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

module.exports = {
  verifyToken,
  generateToken,
  JWT_SECRET
};
