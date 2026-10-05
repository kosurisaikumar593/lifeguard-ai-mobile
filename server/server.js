const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('./db');

const app = express();
const server = http.createServer(app);

// Configure CORS for web client
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://kosurisaikumar593.github.io',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.github.io')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev/staging
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Socket.io Connection & Room Handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Client joins user-specific room
  socket.on('join_user_channel', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`[Socket.io] Socket ${socket.id} joined room user_${userId}`);
  });

  // Client manual SOS broadcast
  socket.on('trigger_sos', (payload) => {
    console.log(`[Socket.io] Emergency SOS received from ${payload.senderName}`);
    io.emit('emergency_alert_broadcast', payload);
  });

  // Client acknowledgment
  socket.on('acknowledge_alert', (payload) => {
    console.log(`[Socket.io] Alert acknowledged by contact:`, payload);
    io.emit('alert_acknowledged', payload);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Mount Routes
const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const incidentsRoutes = require('./routes/incidents')(io);
const locationRoutes = require('./routes/location')(io);

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/location', locationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'LifeGuard AI Backend Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    realtime: 'Socket.io Active',
  });
});

const PORT = process.env.PORT || 5000;

// Initialize Database & Start Listening
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🛡️  LifeGuard AI Backend Server listening on port ${PORT}`);
    console.log(`📡 WebSocket Realtime Engine (Socket.io) Active`);
    console.log(`🔗 REST Endpoints: /api/auth, /api/contacts, /api/incidents, /api/location`);
    console.log(`=======================================================`);
  });
});
