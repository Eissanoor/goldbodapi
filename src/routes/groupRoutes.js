const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { createGroupRules, groupParamRules } = require('../middleware/validationMiddleware');

// POST /api/groups - Create a new group
router.post('/', createGroupRules, groupController.createGroup);

// GET /api/groups/:groupHash - Get group details and containers
router.get('/:groupHash', groupParamRules, groupController.getGroup);

module.exports = router;