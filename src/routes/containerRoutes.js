const express = require('express');
const router = express.Router();
const containerController = require('../controllers/containerController');
const { createContainerRules, containerParamRules } = require('../middleware/validationMiddleware');

// POST /api/containers - Create a new container
router.post('/', createContainerRules, containerController.createContainer);

// GET /api/containers/:tagId - Get container details
router.get('/:tagId', containerParamRules, containerController.getContainer);

// GET /api/containers/:tagId/history - Get container history
router.get('/:tagId/history', containerParamRules, containerController.getContainerHistory);

module.exports = router;
