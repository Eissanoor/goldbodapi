const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { transferTokensRules, paginationRules } = require('../middleware/validationMiddleware');

// POST /api/transactions/transfer - Transfer tokens between containers
router.post('/transfer', transferTokensRules, transactionController.transferTokens);

// GET /api/transactions - List all transactions with pagination
router.get('/', paginationRules, transactionController.getAllTransactions);

module.exports = router;
