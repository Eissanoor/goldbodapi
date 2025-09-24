const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// 1. BLOCKCHAIN VISUALIZATION DATA
router.get('/blockchain/visualization', analyticsController.getBlockchainVisualization);

// 2. ALL BLOCKS ENDPOINT
router.get('/blocks', analyticsController.getBlocks);

// 3. DASHBOARD STATISTICS
router.get('/dashboard/stats', analyticsController.getDashboardStats);

module.exports = router;


