require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma client
const prisma = new PrismaClient();

// Import services
const eventListenerService = require('./src/services/eventListenerService');

// Middleware
app.use(helmet()); // Security headers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const containerRoutes = require('./src/routes/containerRoutes');
const transactionRoutes = require('./src/routes/transactionRoutes');
const groupRoutes = require('./src/routes/groupRoutes');

// Use routes
app.use('/api/containers', containerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/groups', groupRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: true,
    message: err.message || 'An unexpected error occurred',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  
  // Start blockchain event listener if contract address is set
  if (process.env.CONTRACT_ADDRESS) {
    try {
      eventListenerService.startListening();
      console.log('Blockchain event listener started');
    } catch (error) {
      console.error('Failed to start blockchain event listener:', error);
    }
  } else {
    console.warn('CONTRACT_ADDRESS not set in environment variables. Blockchain event listener not started.');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    prisma.$disconnect();
  });
});

module.exports = app;
