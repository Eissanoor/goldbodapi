require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const prisma = require('./src/services/db');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Prisma client provided by singleton in ./src/services/db

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
const analyticsRoutes = require('./src/routes/analyticsRoutes');

// Use routes
app.use('/api/containers', containerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api', analyticsRoutes);

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
      // Check if we can connect to the blockchain
      const fs = require('fs');
      const path = require('path');
      
      // Try to load deployment info
      const deploymentInfoPath = path.join(__dirname, 'deployment-info.json');
      
      if (fs.existsSync(deploymentInfoPath)) {
        const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf8'));
        console.log(`Using contract deployed at: ${deploymentInfo.contractAddress}`);
        console.log(`Network: ${deploymentInfo.deploymentNetwork}`);
        
        // Start the event listener
        eventListenerService.startListening();
      } else {
        console.log('No deployment-info.json found. Using CONTRACT_ADDRESS from environment variables.');
        console.log(`Contract address: ${process.env.CONTRACT_ADDRESS}`);
        
        // Start the event listener
        eventListenerService.startListening();
      }
    } catch (error) {
      console.error('Failed to start blockchain event listener:', error);
      console.error('The server will continue running, but blockchain events will not be processed.');
    }
  } else {
    console.warn('CONTRACT_ADDRESS not set in environment variables. Blockchain event listener not started.');
    console.warn('The server will continue running, but blockchain events will not be processed.');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  
  // Stop the blockchain event listener
  try {
    eventListenerService.stopListening();
    console.log('Blockchain event listener stopped');
  } catch (error) {
    console.error('Error stopping blockchain event listener:', error);
  }
  
  server.close(() => {
    console.log('HTTP server closed');
    prisma.$disconnect();
  });
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  
  // Stop the blockchain event listener
  try {
    eventListenerService.stopListening();
    console.log('Blockchain event listener stopped');
  } catch (error) {
    console.error('Error stopping blockchain event listener:', error);
  }
  
  server.close(() => {
    console.log('HTTP server closed');
    prisma.$disconnect();
    process.exit(0);
  });
});

module.exports = app;
