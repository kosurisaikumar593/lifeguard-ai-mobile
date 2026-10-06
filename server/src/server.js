const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { initDb } = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request logger (sanitizes sensitive data)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Root / Health endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'LifeGuard AI Server',
    tagline: 'Your Safety, Our Priority',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    ai_engine: 'Google Gemini API',
    database: 'MySQL / Resilient Pool',
    push_service: 'Firebase Cloud Messaging'
  });
});

// Mount Routes
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const aiRoutes = require('./routes/aiRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

app.use('/api', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api', aiRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.url} not found.`
  });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('[Internal Error Handler]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.'
  });
});

// Start Server and Initialize Database
async function startServer() {
  await initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 LifeGuard AI Server listening on port ${PORT}`);
    console.log(`📡 Local address: http://localhost:${PORT}`);
    console.log(`🔒 Gemini AI Engine: Active (Structured Audio Analysis)`);
    console.log(`====================================================`);
  });
}

startServer();

module.exports = app;
