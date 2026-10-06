const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { uploadAudio } = require('../middleware/upload');
const { verifyToken } = require('../middleware/auth');

// Sound analysis route (optionally authenticated or open for client device stream)
router.post('/analyze-sound', uploadAudio.single('audio'), aiController.analyzeSound);

module.exports = router;
