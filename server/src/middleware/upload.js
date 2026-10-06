const multer = require('multer');

// Store short audio sample in memory buffer for privacy and immediate processing
const storage = multer.memoryStorage();

const uploadAudio = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB max for 3-5s audio sample
  },
  fileFilter: (req, file, cb) => {
    // Accept audio formats: wav, mp4, m4a, 3gp, aac, ogg, webm
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/mp4' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio samples are allowed.'), false);
    }
  }
});

module.exports = {
  uploadAudio
};
